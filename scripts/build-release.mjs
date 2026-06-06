import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { ZipArchive } from "archiver";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const releaseName = `Bilibiliwith163-v${packageJson.version}-windows-x64`;
const releaseDir = path.join(distDir, "release", releaseName);
const exeSource = path.join(distDir, "bilibiliwith163-caxa.exe");
const zipPath = path.join(distDir, `${releaseName}.zip`);
const shaPath = path.join(distDir, `${releaseName}.sha256`);

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...args] : args;
    const child = spawn(command, commandArgs, {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function zipDirectory(sourceDir, outputPath) {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("warning", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, releaseName);
    archive.finalize();
  });
}

async function copyFileIntoRelease(source, targetName) {
  await fs.promises.copyFile(source, path.join(releaseDir, targetName));
}

async function writeReleaseDocs() {
  const runningDoc = `# Bilibiliwith163 Windows 发布包

## 快速启动

1. 复制 .env.example 为 .env。
2. 编辑 .env，至少设置 PORT、BILI_ROOM_ID 和 BILI_COOKIE。
3. 双击 Bilibiliwith163.exe，或在 PowerShell 中运行：

\`\`\`powershell
.\\Bilibiliwith163.exe
\`\`\`

默认地址：

- 控制台：http://localhost:3888/dashboard.html
- OBS / 直播姬浏览器源：http://localhost:3888/

音频由后端本地播放器输出。没有 mpv 或 ffplay 时，可以在控制台点击“一键安装播放器”，便携版 mpv 会安装到当前目录的 .cache/player/mpv/，不会修改系统 PATH。

运行期文件会写入当前目录的 .cache/ 和 .env。不要把 .env 发给别人。
`;

  const releaseNotes = `# Bilibiliwith163 v${packageJson.version}

这是 Windows x64 发布包，包含自解压 exe、默认配置模板和运行说明。

主要能力：

- B 站直播弹幕点歌。
- 网易云搜索、登录和播放地址解析。
- 播放队列、历史、冷却和重复控制。
- 后端本地 mpv/ffplay 播放，浏览器源只显示状态。
- OBS / 直播姬浏览器源和 Web 控制台。
- 音频缓存复用、可读缓存文件名和退出队列自动回收。

构建命令：

\`\`\`powershell
npm run build:release
\`\`\`
`;

  await fs.promises.writeFile(path.join(releaseDir, "RUNNING.md"), runningDoc, "utf8");
  await fs.promises.writeFile(path.join(releaseDir, "RELEASE_NOTES.md"), releaseNotes, "utf8");
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function main() {
  const skipExeBuild = process.argv.includes("--skip-exe");

  if (!skipExeBuild) {
    await runNpm(["run", "build:exe:caxa"]);
  }

  if (!fs.existsSync(exeSource)) {
    throw new Error(`Missing exe: ${exeSource}`);
  }

  await fs.promises.rm(releaseDir, { recursive: true, force: true });
  await fs.promises.mkdir(releaseDir, { recursive: true });
  await copyFileIntoRelease(exeSource, "Bilibiliwith163.exe");
  await copyFileIntoRelease(path.join(rootDir, ".env.example"), ".env.example");
  await copyFileIntoRelease(path.join(rootDir, "README.md"), "README.md");
  await copyFileIntoRelease(path.join(rootDir, "LICENSE"), "LICENSE");
  await writeReleaseDocs();

  await fs.promises.rm(zipPath, { force: true });
  await fs.promises.rm(shaPath, { force: true });
  await zipDirectory(releaseDir, zipPath);

  const digest = await sha256File(zipPath);
  await fs.promises.writeFile(shaPath, `${digest}  ${path.basename(zipPath)}\n`, "utf8");

  const zipSizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`Release package: ${zipPath}`);
  console.log(`SHA256: ${digest}`);
  console.log(`Size: ${zipSizeMb} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
