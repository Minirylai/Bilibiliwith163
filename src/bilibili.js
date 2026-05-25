const bus = require("./eventBus");
const config = require("./config");
const { parseSongRequest } = require("./songRequestParser");
const { resolveSong } = require("./ncmApi");
const queue = require("./queue");

function getBaseCommand(data) {
  const command = data?.cmd || data?.msg?.cmd || "";
  return String(command).split(":")[0];
}

function danmakuFromMessage(data) {
  const info = data.info || [];
  return {
    text: info[1] || "",
    user: {
      uid: info[2]?.[0] || 0,
      name: info[2]?.[1] || "Anonymous",
    },
    raw: data,
  };
}

function hostToAddress(host) {
  if (!host?.host) return undefined;
  const port = host.wss_port || 443;
  return `wss://${host.host}:${port}/sub`;
}

function cookieValue(cookie, name) {
  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

async function connectBilibili(options = {}) {
  const { WebSocket } = require("ws");
  globalThis.WebSocket = WebSocket;

  const roomId = Number(options.roomId || config.roomId);
  const sessionId = options.sessionId || Date.now();
  const { BilibiliApiClient, LiveWS } = await import("bilibili-live-danmaku");
  const client = new BilibiliApiClient({
    cookie: config.cookie,
  });

  try {
    await client.initCookie();
  } catch (error) {
    bus.emit("log", {
      level: "warn",
      message: `Bilibili cookie bootstrap failed: ${error.message}`,
    });
  }

  const room = await client.liveRoomInit({ id: roomId });
  const realRoomId = Number(room.data.room_id || roomId);
  const danmuInfo = await client.xliveGetDanmuInfo({ id: realRoomId });
  const address = hostToAddress(danmuInfo.data.host_list?.[0]);
  const uid = Number(cookieValue(client.cookie, "DedeUserID")) || 0;
  const buvid =
    client.cookies.get("buvid3") || client.cookies.get("buvid4") || client.cookies.get("buvid_fp");
  const live = new LiveWS(realRoomId, {
    address,
    key: danmuInfo.data.token,
    uid,
    buvid,
    protover: config.biliProtover,
  });

  const status = {
    sessionId,
    requestedRoomId: roomId,
    roomId: realRoomId,
    liveStatus: room.data.live_status,
    connected: false,
    address,
    lastHeartbeat: null,
    lastMessage: null,
    lastDanmaku: null,
    lastError: null,
  };

  const emitStatus = () => bus.emit("bilibili:status", { ...status });

  if (status.liveStatus !== 1) {
    bus.emit("log", {
      level: "warn",
      message: `Bilibili room ${realRoomId} is not live. live_status=${status.liveStatus}`,
    });
  }

  live.addEventListener("open", () => {
    status.lastError = null;
    bus.emit("log", {
      level: "info",
      message: `Bilibili websocket opened for room ${realRoomId}`,
    });
    emitStatus();
  });

  live.addEventListener("CONNECT_SUCCESS", () => {
    status.connected = true;
    bus.emit("log", {
      level: "info",
      message: `Bilibili websocket authenticated for room ${realRoomId}`,
    });
    emitStatus();
  });

  live.addEventListener("HEARTBEAT_REPLY", ({ data }) => {
    status.lastHeartbeat = {
      at: new Date().toISOString(),
      popularity: data,
    };
    emitStatus();
  });

  live.addEventListener("MESSAGE", ({ data }) => {
    const command = getBaseCommand(data);
    status.lastMessage = {
      at: new Date().toISOString(),
      command,
    };

    if (command !== "DANMU_MSG") {
      emitStatus();
      return;
    }

    const danmaku = danmakuFromMessage(data);
    status.lastDanmaku = {
      at: new Date().toISOString(),
      text: danmaku.text,
      user: danmaku.user.name,
    };
    emitStatus();

    bus.emit("danmaku", danmaku);
    handleDanmaku(danmaku).catch((error) => {
      bus.emit("request:rejected", {
        text: danmaku.text,
        user: danmaku.user,
        reason: error.message,
      });
    });
  });

  live.addEventListener("error", (event) => {
    status.connected = false;
    status.lastError = event.message || event.type || "WebSocket error";
    emitStatus();
  });

  live.addEventListener("close", () => {
    status.connected = false;
    emitStatus();
  });

  emitStatus();
  return live;
}

async function handleDanmaku(danmaku) {
  const request = parseSongRequest(danmaku.text, config.requestCommands);
  if (!request) return;

  const cooldown = queue.canUserRequest(danmaku.user.uid);
  if (!cooldown.ok) {
    const seconds = Math.ceil(cooldown.remainingMs / 1000);
    throw new Error(`Request too fast. Try again in ${seconds}s.`);
  }

  bus.emit("request:received", {
    keyword: request.keyword,
    command: request.command,
    user: danmaku.user,
    text: danmaku.text,
  });

  const song = await resolveSong(request.keyword);
  if (!song) {
    throw new Error(`No playable song found: ${request.keyword}`);
  }

  const item = queue.addSong(song, danmaku.user, request.keyword);
  bus.emit("request:accepted", item);
}

module.exports = {
  connectBilibili,
  handleDanmaku,
};
