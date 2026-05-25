const assert = require("assert");
const { WebSocket } = require("ws");

function cookieValue(cookie, name) {
  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

async function testNeteaseApi() {
  const { searchSongs, getSongUrl, checkSongAvailable } = require("../src/ncmApi");
  const config = require("../src/config");
  const { parseSongRequest } = require("../src/songRequestParser");

  assert.deepStrictEqual(parseSongRequest("点歌 香蕉", config.requestCommands), {
    command: "点歌",
    keyword: "香蕉",
  });

  const songs = await searchSongs("晴天 周杰伦", 3);
  assert.ok(songs.length > 0, "网易云搜索未返回歌曲");
  assert.ok(songs[0].id, "网易云搜索结果缺少歌曲 ID");

  const available = await checkSongAvailable(songs[0].id);
  assert.strictEqual(typeof available, "boolean", "歌曲可用性检查没有返回布尔值");

  const playback = await getSongUrl(songs[0].id);
  assert.ok(playback.url, "网易云播放地址为空");
  console.log(`Netease API ok: ${songs[0].name} -> ${playback.level || playback.bitrate}`);
}

async function testBilibiliApi() {
  globalThis.WebSocket = WebSocket;
  const { BilibiliApiClient, LiveWS } = await import("bilibili-live-danmaku");
  const config = require("../src/config");
  const room = Number(process.env.BILI_ROOM_ID || 1);
  const client = new BilibiliApiClient({
    cookie: process.env.BILI_COOKIE || "",
  });
  await client.initCookie().catch(() => {});

  const init = await client.liveRoomInit({ id: room });
  assert.strictEqual(init.code, 0, "B 站房间初始化失败");
  const roomId = Number(init.data.room_id);
  assert.ok(roomId, "B 站真实房间号为空");

  const danmuInfo = await client.xliveGetDanmuInfo({ id: roomId });
  assert.strictEqual(danmuInfo.code, 0, "B 站弹幕 token 获取失败");
  assert.ok(danmuInfo.data.token, "B 站弹幕 token 为空");

  const host = danmuInfo.data.host_list?.[0];
  const address = host ? `wss://${host.host}:${host.wss_port || 443}/sub` : undefined;
  const uid = Number(cookieValue(client.cookie, "DedeUserID")) || 0;
  const buvid =
    cookieValue(client.cookie, "buvid3") ||
    cookieValue(client.cookie, "buvid4") ||
    cookieValue(client.cookie, "buvid_fp");

  await new Promise((resolve, reject) => {
    const live = new LiveWS(roomId, {
      address,
      key: danmuInfo.data.token,
      uid,
      buvid,
      protover: config.biliProtover,
    });
    const timeout = setTimeout(() => {
      live.close();
      reject(new Error("B 站弹幕 WebSocket 连接超时"));
    }, 12000);

    live.addEventListener("CONNECT_SUCCESS", () => {
      clearTimeout(timeout);
      live.close();
      resolve();
    });
    live.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(event.message || "B 站弹幕 WebSocket 错误"));
    });
  });

  const liveStatus = Number(init.data.live_status);
  const liveText = liveStatus === 1 ? "live" : `not live (live_status=${liveStatus})`;
  console.log(`Bilibili API ok: requested ${room}, real room ${roomId}, ${liveText}`);
  if (liveStatus !== 1) {
    console.log("Bilibili note: WebSocket auth can pass while the room is offline; no DANMU_MSG may arrive.");
  }
}

(async () => {
  await testNeteaseApi();
  await testBilibiliApi();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
