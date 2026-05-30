const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable, Transform } = require("stream");
const sevenZip = require("7zip-bin");
const paths = require("./runtimePaths");

const releaseApiUrl = "https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases/latest";

let installTask = null;
const status = {
  error: "",
  executable: "",
  installing: false,
  message: "",
  progress: 0,
  sourceUrl: releaseApiUrl,
  status: "idle",
};

function bundledMpvDir() {
  return path.join(paths.playerDir, "mpv");
}

function bundledMpvPath() {
  return path.join(bundledMpvDir(), process.platform === "win32" ? "mpv.exe" : "mpv");
}

async function existingBundledPlayer() {
  const executable = bundledMpvPath();
  try {
    const stat = await fsp.stat(executable);
    if (stat.isFile()) return executable;
  } catch {
    // Not installed yet.
  }
  return "";
}

function getInstallStatus() {
  return { ...status };
}

function setStatus(next) {
  Object.assign(status, next);
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(new Error(errorOutput || `${command} exited with code ${code}`));
    });
  });
}

async function fetchJsonWithCurl(url) {
  const output = await runCapture("curl.exe", [
    "-fsSL",
    "--connect-timeout",
    "20",
    "--max-time",
    "60",
    "-H",
    "User-Agent: Bilibiliwith163",
    url,
  ]);
  return JSON.parse(output);
}

async function fetchLatestMpvAsset() {
  let release;
  try {
    const response = await fetch(releaseApiUrl, {
      headers: {
        "User-Agent": "Bilibiliwith163",
      },
    });
    if (!response.ok) {
      throw new Error(`读取 mpv 发布信息失败：${response.status} ${response.statusText}`);
    }
    release = await response.json();
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }
    setStatus({
      message: "Node 下载链路证书校验失败，正在改用 Windows curl 下载...",
    });
    release = await fetchJsonWithCurl(releaseApiUrl);
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const asset =
    assets.find((item) => /^mpv-x86_64-v3-.*\.7z$/i.test(item.name)) ||
    assets.find((item) => /^mpv-x86_64-.*\.7z$/i.test(item.name));
  if (!asset?.browser_download_url) {
    throw new Error("未找到适合 Windows x64 的 mpv 发布包");
  }
  return asset;
}

async function downloadFileWithCurl(url, targetPath) {
  await runCapture("curl.exe", [
    "-fL",
    "--retry",
    "2",
    "--connect-timeout",
    "20",
    "--max-time",
    "600",
    "-H",
    "User-Agent: Bilibiliwith163",
    "-o",
    targetPath,
    url,
  ]);
  setStatus({ progress: 92 });
}

async function downloadFile(url, targetPath) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Bilibiliwith163",
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`下载 mpv 失败：${response.status} ${response.statusText}`);
    }
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }
    setStatus({
      message: "Node 下载 mpv 失败，正在改用 Windows curl 下载...",
      progress: 8,
    });
    await downloadFileWithCurl(url, targetPath);
    return;
  }

  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  const progressStream = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.byteLength;
      if (total > 0) {
        setStatus({
          progress: Math.max(1, Math.min(92, Math.round((received / total) * 88))),
        });
      }
      callback(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(response.body), progressStream, fs.createWriteStream(targetPath));
}

function run7za(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(sevenZip.path7za, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `7z exited with code ${code}`));
    });
  });
}

async function findFile(root, fileName) {
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = await findFile(fullPath, fileName);
      if (found) return found;
    }
  }
  return "";
}

async function installMpv() {
  if (process.platform !== "win32") {
    throw new Error("自动安装当前只支持 Windows；其他系统请通过包管理器安装 mpv。");
  }

  const existing = await existingBundledPlayer();
  if (existing) {
    setStatus({
      error: "",
      executable: existing,
      installing: false,
      message: "本地 mpv 已安装",
      progress: 100,
      status: "ready",
    });
    return getInstallStatus();
  }

  if (installTask) return installTask;

  installTask = (async () => {
    await fsp.mkdir(paths.playerDir, { recursive: true });
    const asset = await fetchLatestMpvAsset();
    const archivePath = path.join(paths.playerDir, asset.name);
    const extractDir = path.join(paths.playerDir, "mpv-extract");
    const targetDir = bundledMpvDir();

    setStatus({
      error: "",
      executable: "",
      installing: true,
      message: `正在下载 mpv：${asset.name}`,
      progress: 1,
      sourceUrl: asset.browser_download_url,
      status: "installing",
    });

    try {
      await fsp.rm(extractDir, { force: true, recursive: true }).catch(() => {});
      await downloadFile(asset.browser_download_url, archivePath);
      setStatus({ message: "正在解压 mpv...", progress: 94 });
      await fsp.mkdir(extractDir, { recursive: true });
      await run7za(["x", archivePath, `-o${extractDir}`, "-y"]);

      const mpvExe = await findFile(extractDir, "mpv.exe");
      if (!mpvExe) {
        throw new Error("下载包内未找到 mpv.exe");
      }

      await fsp.rm(targetDir, { force: true, recursive: true }).catch(() => {});
      await fsp.mkdir(path.dirname(targetDir), { recursive: true });
      await fsp.cp(path.dirname(mpvExe), targetDir, { recursive: true });
      await fsp.rm(extractDir, { force: true, recursive: true }).catch(() => {});
      await fsp.unlink(archivePath).catch(() => {});

      const executable = bundledMpvPath();
      setStatus({
        error: "",
        executable,
        installing: false,
        message: "mpv 已安装",
        progress: 100,
        status: "ready",
      });
      return getInstallStatus();
    } catch (error) {
      await fsp.rm(extractDir, { force: true, recursive: true }).catch(() => {});
      await fsp.unlink(archivePath).catch(() => {});
      setStatus({
        error: error.message,
        executable: "",
        installing: false,
        message: "mpv 安装失败",
        status: "error",
      });
      throw error;
    } finally {
      installTask = null;
    }
  })();

  return installTask;
}

module.exports = {
  bundledMpvPath,
  existingBundledPlayer,
  getInstallStatus,
  installMpv,
};
