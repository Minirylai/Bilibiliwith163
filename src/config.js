const path = require("path");

require("dotenv").config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const parseCommands = (value) => {
  const source = value || "\u70b9\u6b4c,\u70b9\u64ad,\u7f51\u6613\u4e91";
  return source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const config = {
  port: toNumber(process.env.PORT, 3888),
  roomId: toNumber(process.env.BILI_ROOM_ID, 1),
  cookie: process.env.BILI_COOKIE || "",
  requestCommands: parseCommands(process.env.REQUEST_COMMANDS),
  maxQueueSize: toNumber(process.env.MAX_QUEUE_SIZE, 30),
  maxSearchResults: toNumber(process.env.MAX_SEARCH_RESULTS, 8),
  minRequestIntervalMs: toNumber(process.env.MIN_REQUEST_INTERVAL_MS, 8000),
  playerVolume: Math.min(1, Math.max(0, toNumber(process.env.PLAYER_VOLUME, 0.75))),
  ncmQuality: process.env.NCM_QUALITY || "standard",
  biliProtover: toNumber(process.env.BILI_PROTO_VERSION, 3),
  allowDuplicates: toBoolean(process.env.ALLOW_DUPLICATES, false),
  autoplay: toBoolean(process.env.AUTOPLAY, true),
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 12000),
  audioCacheMaxMb: toNumber(process.env.AUDIO_CACHE_MAX_MB, 512),
  audioCacheMaxFiles: toNumber(process.env.AUDIO_CACHE_MAX_FILES, 120),
  publicDir: path.resolve(__dirname, "..", "public"),
};

module.exports = config;
