const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const config = require("./config");
const bus = require("./eventBus");
const paths = require("./runtimePaths");

const cacheDir = paths.audioCacheDir;
const registry = new Map();
const downloads = new Map();
const cacheRefs = new Map();
const cacheEntries = new Map();
const pendingDeletes = new Map();

function createRequestId() {
  return crypto.randomUUID();
}

function extensionFor(item) {
  const type = item.cachePlayback?.type || item.playback?.type || "";
  if (/flac/i.test(type)) return "flac";
  if (/m4a|aac/i.test(type)) return "m4a";
  return "mp3";
}

function contentTypeFor(extension) {
  if (extension === "flac") return "audio/flac";
  if (extension === "m4a") return "audio/mp4";
  return "audio/mpeg";
}

function safeFilePart(value, fallback) {
  const source = String(value || fallback || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const safe = source.replace(/[. ]+$/g, "");
  return (safe || fallback || "unknown").slice(0, 72);
}

function cacheKeyFor(item) {
  const songId = item?.id || "unknown";
  const cachePlayback = item?.cachePlayback || item?.playback || {};
  const level = cachePlayback.level || config.ncmCacheQuality || config.ncmQuality || "standard";
  const type = cachePlayback.type || extensionFor(item);
  return `${songId}-${level}-${type}`.toLowerCase();
}

function cacheFileNameFor(item, extension) {
  const songId = safeFilePart(item?.id, "unknown-id");
  const name = safeFilePart(item?.name, "unknown-song");
  const artists = safeFilePart(item?.artists, "unknown-artist");
  const level = safeFilePart(item?.cachePlayback?.level || item?.playback?.level || config.ncmCacheQuality || config.ncmQuality, "standard");
  return `${songId} - ${name} - ${artists} [${level}].${extension}`;
}

function entryForItem(item) {
  const extension = extensionFor(item);
  const cacheKey = cacheKeyFor(item);
  const cachePlayback = item.cachePlayback || item.playback;
  const filePath = path.join(cacheDir, cacheFileNameFor(item, extension));
  return {
    cacheKey,
    contentType: contentTypeFor(extension),
    filePath,
    playbackRemoteUrl: item.playback.url,
    remoteUrl: cachePlayback.url,
  };
}

function registerSong(item) {
  if (!item?.requestId || !item?.playback?.url) return;

  const entry = entryForItem(item);
  const nextRefs = (cacheRefs.get(entry.cacheKey) || 0) + 1;

  clearPendingDelete(entry.cacheKey);
  cacheRefs.set(entry.cacheKey, nextRefs);
  cacheEntries.set(entry.cacheKey, entry);
  registry.set(item.requestId, entry);

  warmSong(item.requestId).catch(() => {});
}

function clearPendingDelete(cacheKey) {
  const timer = pendingDeletes.get(cacheKey);
  if (!timer) return;
  clearTimeout(timer);
  pendingDeletes.delete(cacheKey);
}

function releaseSong(item) {
  const requestId = typeof item === "string" ? item : item?.requestId;
  if (!requestId) return;

  const entry = registry.get(requestId);
  if (!entry) return;

  registry.delete(requestId);
  const nextRefs = Math.max(0, (cacheRefs.get(entry.cacheKey) || 1) - 1);
  if (nextRefs > 0) {
    cacheRefs.set(entry.cacheKey, nextRefs);
    return;
  }

  cacheRefs.delete(entry.cacheKey);
  scheduleDelete(entry);
}

function scheduleDelete(entry, attempt = 0) {
  clearPendingDelete(entry.cacheKey);
  const timer = setTimeout(() => {
    pendingDeletes.delete(entry.cacheKey);
    deleteEntryFiles(entry).catch((error) => {
      if (attempt < 5) {
        scheduleDelete(entry, attempt + 1);
        return;
      }
      bus.emit("log", {
        level: "warn",
        message: `Failed to delete audio cache ${path.basename(entry.filePath)}: ${error.message}`,
      });
    });
  }, attempt === 0 ? 1500 : 3000);
  pendingDeletes.set(entry.cacheKey, timer);
}

async function deleteEntryFiles(entry) {
  if ((cacheRefs.get(entry.cacheKey) || 0) > 0 || downloads.has(entry.cacheKey)) return;

  await Promise.all([
    fsp.unlink(entry.filePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    }),
    fsp.unlink(`${entry.filePath}.tmp`).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    }),
  ]);
  cacheEntries.delete(entry.cacheKey);
}

async function warmSong(requestId) {
  const entry = registry.get(requestId);
  if (!entry) {
    throw new Error("Unknown audio request");
  }

  if (downloads.has(entry.cacheKey)) {
    return downloads.get(entry.cacheKey);
  }

  const task = download(entry).finally(() => {
    downloads.delete(entry.cacheKey);
    if ((cacheRefs.get(entry.cacheKey) || 0) === 0) {
      scheduleDelete(entry);
    }
  });
  downloads.set(entry.cacheKey, task);
  return task;
}

async function cachedFile(entry) {
  try {
    const stat = await fsp.stat(entry.filePath);
    if (stat.size > 0) {
      return stat;
    }
  } catch {
    // Cache miss.
  }
  return null;
}

async function download(entry) {
  await fsp.mkdir(cacheDir, {
    recursive: true,
  });

  const existing = await cachedFile(entry);
  if (existing) return entry.filePath;

  const tmpPath = `${entry.filePath}.tmp`;
  try {
    const response = await fetch(entry.remoteUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Audio download failed: ${response.status} ${response.statusText}`);
    }

    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tmpPath));
    await fsp.rename(tmpPath, entry.filePath);
    await cleanupCache();
    return entry.filePath;
  } catch (error) {
    await fsp.unlink(tmpPath).catch(() => {});
    throw error;
  }
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
        cacheKey: cacheKeyForFilePath(filePath),
        mtimeMs: stat.mtimeMs,
        name,
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
    if ((cacheRefs.get(file.cacheKey) || 0) > 0 || downloads.has(file.cacheKey)) {
      files.push(file);
      if (files.every((item) => (cacheRefs.get(item.cacheKey) || 0) > 0 || downloads.has(item.cacheKey))) break;
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

function cacheKeyForFilePath(filePath) {
  const resolved = path.resolve(filePath);
  for (const [cacheKey, entry] of cacheEntries.entries()) {
    if (path.resolve(entry.filePath) === resolved) {
      return cacheKey;
    }
  }
  return "";
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
    const stat = await cachedFile(entry);
    if (!stat) {
      await proxyRemoteAudio(req, res, entry);
      return;
    }

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
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    res.status(502).json({ error: error.message });
  }
}

async function proxyRemoteAudio(req, res, entry) {
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const response = await fetch(entry.playbackRemoteUrl || entry.remoteUrl, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Audio proxy failed: ${response.status} ${response.statusText}`);
  }

  const statusCode = response.status === 206 ? 206 : 200;
  res.status(statusCode);
  res.setHeader("Accept-Ranges", response.headers.get("accept-ranges") || "bytes");
  res.setHeader("Content-Type", response.headers.get("content-type") || entry.contentType);
  res.setHeader("Cache-Control", "private, max-age=300");

  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  if (contentLength) res.setHeader("Content-Length", contentLength);
  if (contentRange) res.setHeader("Content-Range", contentRange);
  res.flushHeaders?.();

  bus.emit("log", {
    level: "info",
    message: "Audio cache miss; streaming from remote source while cache warms.",
  });

  await pipeline(Readable.fromWeb(response.body), res);
}

module.exports = {
  cacheStats,
  cleanupCache,
  createRequestId,
  handleAudioRequest,
  registerSong,
  releaseSong,
  warmSong,
};
