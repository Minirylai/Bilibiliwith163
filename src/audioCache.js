const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const config = require("./config");

const cacheDir = path.resolve(__dirname, "..", ".cache", "audio");
const registry = new Map();
const downloads = new Map();

function createRequestId() {
  return crypto.randomUUID();
}

function extensionFor(item) {
  const type = item.playback?.type || "";
  if (/flac/i.test(type)) return "flac";
  if (/m4a|aac/i.test(type)) return "m4a";
  return "mp3";
}

function registerSong(item) {
  if (!item?.requestId || !item?.playback?.url) return;

  const extension = extensionFor(item);
  const filePath = path.join(cacheDir, `${item.requestId}.${extension}`);
  const contentType = extension === "flac" ? "audio/flac" : extension === "m4a" ? "audio/mp4" : "audio/mpeg";

  registry.set(item.requestId, {
    contentType,
    filePath,
    remoteUrl: item.playback.url,
  });

  warmSong(item.requestId).catch(() => {});
}

async function warmSong(requestId) {
  const entry = registry.get(requestId);
  if (!entry) {
    throw new Error("Unknown audio request");
  }

  if (downloads.has(requestId)) {
    return downloads.get(requestId);
  }

  const task = download(entry).finally(() => {
    downloads.delete(requestId);
  });
  downloads.set(requestId, task);
  return task;
}

async function download(entry) {
  await fsp.mkdir(cacheDir, {
    recursive: true,
  });

  try {
    const stat = await fsp.stat(entry.filePath);
    if (stat.size > 0) return entry.filePath;
  } catch {
    // Cache miss.
  }

  const tmpPath = `${entry.filePath}.tmp`;
  const response = await fetch(entry.remoteUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Audio download failed: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tmpPath));
  await fsp.rename(tmpPath, entry.filePath);
  await cleanupCache();
  return entry.filePath;
}

async function listCacheFiles() {
  await fsp.mkdir(cacheDir, {
    recursive: true,
  });

  const names = await fsp.readdir(cacheDir);
  const files = [];

  for (const name of names) {
    if (name.endsWith(".tmp")) continue;

    const filePath = path.join(cacheDir, name);
    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) continue;
      files.push({
        filePath,
        mtimeMs: stat.mtimeMs,
        name,
        requestId: name.split(".")[0],
        size: stat.size,
      });
    } catch {
      // Ignore files removed during the scan.
    }
  }

  return files;
}

async function cacheStats() {
  const files = await listCacheFiles();
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return {
    cacheDir,
    fileCount: files.length,
    maxBytes: config.audioCacheMaxMb * 1024 * 1024,
    maxFiles: config.audioCacheMaxFiles,
    totalBytes,
    totalMb: Number((totalBytes / 1024 / 1024).toFixed(2)),
  };
}

async function cleanupCache(options = {}) {
  const maxBytes = Math.max(0, options.maxBytes ?? config.audioCacheMaxMb * 1024 * 1024);
  const maxFiles = Math.max(0, options.maxFiles ?? config.audioCacheMaxFiles);
  const files = (await listCacheFiles()).sort((a, b) => a.mtimeMs - b.mtimeMs);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let removedBytes = 0;
  let removedFiles = 0;

  while (files.length > 0 && (totalBytes > maxBytes || files.length > maxFiles)) {
    const file = files.shift();
    if (downloads.has(file.requestId)) {
      files.push(file);
      if (files.every((item) => downloads.has(item.requestId))) break;
      continue;
    }

    try {
      await fsp.unlink(file.filePath);
      totalBytes -= file.size;
      removedBytes += file.size;
      removedFiles += 1;
    } catch {
      // The player may have the file open on Windows; skip it for this pass.
    }
  }

  return {
    maxBytes,
    maxFiles,
    removedBytes,
    removedFiles,
    totalBytes,
    totalMb: Number((totalBytes / 1024 / 1024).toFixed(2)),
  };
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }

  return {
    end: Math.min(end, size - 1),
    start,
  };
}

async function handleAudioRequest(req, res) {
  const requestId = req.params.requestId;
  const entry = registry.get(requestId);
  if (!entry) {
    res.status(404).json({ error: "Unknown audio request" });
    return;
  }

  try {
    await warmSong(requestId);
    const stat = await fsp.stat(entry.filePath);
    const range = parseRange(req.headers.range, stat.size);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", entry.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader("Content-Length", range.end - range.start + 1);
      fs.createReadStream(entry.filePath, range).pipe(res);
      return;
    }

    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(entry.filePath).pipe(res);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}

module.exports = {
  cacheStats,
  cleanupCache,
  createRequestId,
  handleAudioRequest,
  registerSong,
  warmSong,
};
