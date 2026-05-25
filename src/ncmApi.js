const ncm = require("@neteasecloudmusicapienhanced/api");
const config = require("./config");
const ncmAuth = require("./ncmAuth");

function artistsToText(song) {
  const artists = song.ar || song.artists || [];
  return artists.map((artist) => artist.name).filter(Boolean).join(" / ");
}

function normalizeSong(song) {
  return {
    id: song.id,
    name: song.name,
    artists: artistsToText(song),
    album: song.al?.name || song.album?.name || "",
    cover: song.al?.picUrl || song.album?.picUrl || "",
    duration: song.dt || song.duration || 0,
  };
}

async function withTimeout(promise, label) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out`)), config.requestTimeoutMs);
  });
  return Promise.race([promise, timeout]);
}

async function searchSongs(keyword, limit = config.maxSearchResults) {
  const response = await withTimeout(
    ncm.cloudsearch({
      keywords: keyword,
      limit,
      type: 1,
      cookie: ncmAuth.getCookie(),
    }),
    "Netease search",
  );

  const songs = response.body?.result?.songs || [];
  return songs.map(normalizeSong);
}

async function checkSongAvailable(id) {
  try {
    const response = await withTimeout(
      ncm.check_music({
        id,
        cookie: ncmAuth.getCookie(),
      }),
      "Netease availability check",
    );
    return response.body?.success === true || response.body?.code === 200;
  } catch {
    return false;
  }
}

async function getSongUrl(id, level = config.ncmQuality) {
  const response = await withTimeout(
    ncm.song_url_v1({
      id,
      level,
      cookie: ncmAuth.getCookie(),
    }),
    "Netease song URL",
  );

  const data = response.body?.data?.[0];
  if (!data?.url || data.code !== 200) {
    throw new Error(data?.message || "No playable URL returned from Netease");
  }

  return {
    url: data.url,
    bitrate: data.br || 0,
    level: data.level || level,
    type: data.type || "",
    time: data.time || 0,
  };
}

async function resolveSong(keyword) {
  const songs = await searchSongs(keyword);
  for (const song of songs) {
    const available = await checkSongAvailable(song.id);
    if (!available) continue;

    try {
      const playback = await getSongUrl(song.id);
      return {
        ...song,
        playback,
      };
    } catch {
      // Try the next search result if the song is visible but no URL is available.
    }
  }

  return null;
}

module.exports = {
  checkSongAvailable,
  getSongUrl,
  resolveSong,
  searchSongs,
};
