const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const config = require("./config");
const appearance = require("./appearance");
const dashboardSettings = require("./dashboardSettings");
const bus = require("./eventBus");
const queue = require("./queue");
const { connectBilibili, handleDanmaku } = require("./bilibili");
const { resolveSong, searchSongs } = require("./ncmApi");
const ncmAuth = require("./ncmAuth");
const { cacheStats, cleanupCache, handleAudioRequest } = require("./audioCache");
const paths = require("./runtimePaths");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
let bilibiliStatus = null;
let bilibiliLive = null;
let activeBilibiliSession = 0;
const wallpaperDir = paths.picDir;
const envPath = paths.envPath;
const qualityLabels = {
  standard: "标准（最流畅）",
  higher: "较高",
  exhigh: "极高",
  lossless: "无损",
  hires: "Hi-Res",
};

app.use(express.json({ limit: "20mb" }));
app.use(express.static(config.publicDir));
app.use("/pic", express.static(wallpaperDir));

function writeEnvValue(key, value) {
  const nextLine = `${key}=${String(value)}`;
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    content = content.replace(pattern, nextLine);
  } else {
    if (content && !content.endsWith("\n")) content += "\n";
    content += `${nextLine}\n`;
  }

  fs.writeFileSync(envPath, content, "utf8");
}

function qualityPayload() {
  return {
    cacheQuality: config.ncmCacheQuality,
    options: config.ncmQualityOptions.map((value) => ({
      label: qualityLabels[value] || value,
      value,
    })),
    playbackQuality: config.ncmPlaybackQuality,
  };
}

function normalizeQuality(value, fallback) {
  const source = String(value || "").trim().toLowerCase();
  return config.ncmQualityOptions.includes(source) ? source : fallback;
}

async function startBilibili(roomId = config.roomId) {
  const numericRoomId = Number(roomId);
  if (!Number.isInteger(numericRoomId) || numericRoomId <= 0) {
    throw new Error("Invalid Bilibili room id");
  }

  activeBilibiliSession += 1;
  const sessionId = activeBilibiliSession;

  if (bilibiliLive && typeof bilibiliLive.close === "function") {
    try {
      bilibiliLive.close();
    } catch (error) {
      bus.emit("log", {
        level: "warn",
        message: `Failed to close old Bilibili websocket: ${error.message}`,
      });
    }
  }

  config.roomId = numericRoomId;
  process.env.BILI_ROOM_ID = String(numericRoomId);
  bilibiliStatus = {
    sessionId,
    requestedRoomId: numericRoomId,
    roomId: numericRoomId,
    liveStatus: null,
    connected: false,
    switching: true,
  };
  bus.emit("bilibili:status", bilibiliStatus);

  bilibiliLive = await connectBilibili({ roomId: numericRoomId, sessionId });
  return { roomId: config.roomId, status: bilibiliStatus };
}

app.get("/api/state", (req, res) => {
  res.json(queue.publicState());
});

app.get("/api/appearance", (req, res) => {
  res.json(appearance.loadAppearance());
});

app.post("/api/appearance", (req, res) => {
  try {
    res.json(appearance.saveAppearance(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/appearance/saved", (req, res) => {
  res.json(appearance.loadSavedAppearance());
});

app.post("/api/appearance/saved", (req, res) => {
  try {
    res.json(appearance.saveAppearancePreset(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/appearance/load-saved", (req, res) => {
  try {
    res.json(appearance.applySavedAppearance());
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get("/api/dashboard-settings", (req, res) => {
  res.json(dashboardSettings.loadDashboardSettings());
});

app.post("/api/dashboard-settings", (req, res) => {
  try {
    res.json(dashboardSettings.saveDashboardSettings(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wallpapers", (req, res) => {
  try {
    const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
    const files = fs.existsSync(wallpaperDir)
      ? fs
          .readdirSync(wallpaperDir)
          .filter((name) => allowed.has(path.extname(name).toLowerCase()))
          .sort((a, b) => a.localeCompare(b))
      : [];
    res.json(files.map((name) => ({ name, url: `/pic/${encodeURIComponent(name)}` })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/wallpapers/upload", (req, res) => {
  res.status(410).json({ error: "Wallpaper upload is disabled. The dashboard uses /pic/fu.png." });
});

app.get("/api/bilibili/room", (req, res) => {
  res.json({ roomId: config.roomId, status: bilibiliStatus });
});

app.post("/api/bilibili/room", async (req, res) => {
  try {
    const roomId = Number(req.body?.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0) {
      res.status(400).json({ error: "roomId must be a positive integer" });
      return;
    }

    const result = await startBilibili(roomId);
    writeEnvValue("BILI_ROOM_ID", roomId);
    io.emit("queue:state", queue.publicState());
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const keyword = String(req.query.keyword || "").trim();
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }

    res.json(await searchSongs(keyword));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/audio/:requestId", handleAudioRequest);

app.get("/api/ncm/login/status", async (req, res) => {
  try {
    res.json(await ncmAuth.loginStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ncm/login/qr", async (req, res) => {
  try {
    res.json(await ncmAuth.createQrLogin());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ncm/login/qr/:key", async (req, res) => {
  try {
    res.json(await ncmAuth.checkQrLogin(req.params.key));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ncm/logout", async (req, res) => {
  try {
    res.json(await ncmAuth.logout());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ncm/quality", (req, res) => {
  res.json(qualityPayload());
});

app.post("/api/ncm/quality", (req, res) => {
  try {
    const playbackQuality = normalizeQuality(req.body?.playbackQuality, config.ncmPlaybackQuality);
    const cacheQuality = normalizeQuality(req.body?.cacheQuality, config.ncmCacheQuality);

    config.ncmPlaybackQuality = playbackQuality;
    config.ncmCacheQuality = cacheQuality;
    config.ncmQuality = playbackQuality;
    process.env.NCM_PLAYBACK_QUALITY = playbackQuality;
    process.env.NCM_CACHE_QUALITY = cacheQuality;
    process.env.NCM_QUALITY = playbackQuality;
    writeEnvValue("NCM_PLAYBACK_QUALITY", playbackQuality);
    writeEnvValue("NCM_CACHE_QUALITY", cacheQuality);
    writeEnvValue("NCM_QUALITY", playbackQuality);
    io.emit("ncm:quality", qualityPayload());
    res.json(qualityPayload());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/cache", async (req, res) => {
  try {
    res.json(await cacheStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cache/cleanup", async (req, res) => {
  try {
    const maxMb = Number(req.body?.maxMb);
    const maxFiles = Number(req.body?.maxFiles);
    const options = {};
    if (Number.isFinite(maxMb)) options.maxBytes = Math.max(0, maxMb) * 1024 * 1024;
    if (Number.isFinite(maxFiles)) options.maxFiles = Math.max(0, Math.floor(maxFiles));
    res.json(await cleanupCache(options));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/request", async (req, res) => {
  try {
    const keyword = String(req.body.keyword || "").trim();
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }

    const song = await resolveSong(keyword);
    if (!song) {
      res.status(404).json({ error: `No playable song found: ${keyword}` });
      return;
    }

    const item = queue.addSong(
      song,
      {
        uid: "manual",
        name: req.body.requester || "Manual request",
      },
      keyword,
    );
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/mock-danmaku", async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    await handleDanmaku({
      text,
      user: {
        uid: `mock-${Date.now()}`,
        name: req.body.user || "Mock danmaku",
      },
      raw: null,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/next", (req, res) => {
  res.json(queue.nextSong("manual-next"));
});

app.post("/api/skip", (req, res) => {
  res.json(queue.skipSong("manual-skip"));
});

app.post("/api/queue/:requestId/remove", (req, res) => {
  const removed = queue.removeQueuedSong(req.params.requestId);
  if (!removed) {
    res.status(404).json({ error: "Queued song not found" });
    return;
  }

  res.json({ removed, state: queue.publicState() });
});

app.post("/api/clear", (req, res) => {
  queue.clearQueue();
  res.json(queue.publicState());
});

app.post("/api/reset", (req, res) => {
  queue.resetPlayback();
  res.json(queue.publicState());
});

io.on("connection", (socket) => {
  socket.emit("queue:state", queue.publicState());
  socket.emit("appearance:state", appearance.loadAppearance());
  socket.emit("ncm:quality", qualityPayload());
  if (bilibiliStatus) {
    socket.emit("bilibili:status", bilibiliStatus);
  }
});

const forwardEvents = [
  "bilibili:status",
  "danmaku",
  "log",
  "player:idle",
  "player:play",
  "ncm:quality",
  "appearance:state",
  "queue:added",
  "queue:state",
  "request:accepted",
  "request:received",
  "request:rejected",
];

for (const eventName of forwardEvents) {
  bus.on(eventName, (payload) => {
    if (
      eventName === "bilibili:status" &&
      payload?.sessionId &&
      payload.sessionId !== activeBilibiliSession
    ) {
      return;
    }
    if (eventName === "bilibili:status") {
      bilibiliStatus = payload;
    }
    if (eventName === "request:received") {
      console.log(`[request] ${payload.user?.name || "viewer"} -> ${payload.keyword}`);
    }
    if (eventName === "request:accepted") {
      console.log(`[queue] ${payload.name} - ${payload.artists || "unknown artist"}`);
    }
    if (eventName === "request:rejected") {
      console.log(`[reject] ${payload.user?.name || "viewer"} -> ${payload.reason}`);
    }
    io.emit(eventName, payload);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use.`);
    console.error("Close the existing server, or start this app with another port:");
    console.error('$env:PORT="3889"; npm start');
    process.exit(1);
  }

  throw error;
});

server.listen(config.port, async () => {
  console.log(`OBS browser source: http://localhost:${config.port}`);
  console.log(`Dashboard: http://localhost:${config.port}/dashboard.html`);

  try {
    await startBilibili();
  } catch (error) {
    bus.emit("log", {
      level: "error",
      message: `Failed to connect Bilibili room: ${error.message}`,
    });
    console.error(error);
  }
});
