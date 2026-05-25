const { WebSocket } = require("ws");
const config = require("../src/config");

globalThis.WebSocket = WebSocket;

function baseCommand(data) {
  return String(data?.cmd || data?.msg?.cmd || "").split(":")[0];
}

function danmakuText(data) {
  const info = data.info || [];
  return {
    text: info[1] || "",
    user: info[2]?.[1] || "Anonymous",
  };
}

function hostToAddress(host) {
  if (!host?.host) return undefined;
  return `wss://${host.host}:${host.wss_port || 443}/sub`;
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
  const buvid =
    client.cookies.get("buvid3") || client.cookies.get("buvid4") || client.cookies.get("buvid_fp");
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
    const command = baseCommand(data);
    console.log(`[MESSAGE] ${command || "UNKNOWN"}`);
    if (command === "DANMU_MSG") {
      const danmaku = danmakuText(data);
      console.log(`[DANMU] ${danmaku.user}: ${danmaku.text}`);
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
