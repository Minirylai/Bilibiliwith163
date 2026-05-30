const { WebSocket } = require("ws");
const config = require("../src/config");
const {
  clientBuvid,
  cookieValue,
  danmakuFromMessage,
  getBaseCommand,
  hostToAddress,
} = require("../src/bilibiliHelpers");

globalThis.WebSocket = WebSocket;

(async () => {
  const { BilibiliApiClient, LiveWS } = await import("bilibili-live-danmaku");
  const client = new BilibiliApiClient({
    cookie: config.cookie,
  });
  try {
    await client.initCookie();
  } catch (error) {
    console.warn(`Cookie bootstrap failed: ${error.message}`);
  }
  const room = await client.liveRoomInit({ id: config.roomId });
  const roomId = Number(room.data.room_id || config.roomId);
  const danmuInfo = await client.xliveGetDanmuInfo({ id: roomId });
  const address = hostToAddress(danmuInfo.data.host_list?.[0]);
  const uid = Number(cookieValue(client.cookie, "DedeUserID")) || 0;
  const buvid = clientBuvid(client.cookies);
  const live = new LiveWS(roomId, {
    address,
    key: danmuInfo.data.token,
    uid,
    buvid,
    protover: config.biliProtover,
  });
  const keepalive = setInterval(() => {}, 1000);

  console.log(`Watching room ${roomId}. live_status=${room.data.live_status} uid=${uid || "guest"}`);
  if (room.data.live_status !== 1) {
    console.log("This room is not live, so public live danmaku may not be pushed.");
  }
  console.log("Send a danmaku in the live room now.");
  console.log("Press Ctrl+C to stop.");

  live.addEventListener("CONNECT_SUCCESS", () => {
    console.log("WebSocket authenticated.");
  });

  live.addEventListener("HEARTBEAT_REPLY", ({ data }) => {
    console.log(`[HEARTBEAT] popularity=${data}`);
  });

  live.addEventListener("MESSAGE", ({ data }) => {
    const command = getBaseCommand(data);
    console.log(`[MESSAGE] ${command || "UNKNOWN"}`);
    if (command === "DANMU_MSG") {
      const danmaku = danmakuFromMessage(data);
      console.log(`[DANMU] ${danmaku.user.name}: ${danmaku.text}`);
      return;
    }
  });

  live.addEventListener("error", (event) => {
    console.error(event.message || event.type || "WebSocket error");
  });

  live.addEventListener("error:decode", (event) => {
    console.error("Decode error:", event.error?.message || event.message || event.type);
  });

  live.addEventListener("close", (event) => {
    clearInterval(keepalive);
    console.log(
      `WebSocket closed. code=${event.code || "unknown"} reason=${event.reason || ""}`,
    );
  });

  process.on("SIGINT", () => {
    clearInterval(keepalive);
    live.close();
    process.exit(0);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
