const bus = require("./eventBus");
const config = require("./config");
const { createRequestId, registerSong } = require("./audioCache");

const queue = [];
const history = [];
let current = null;
const lastRequestByUser = new Map();

function publicState() {
  return {
    current,
    queue,
    history: history.slice(-20).reverse(),
    settings: {
      autoplay: config.autoplay,
      maxQueueSize: config.maxQueueSize,
      playerVolume: config.playerVolume,
      requestCommands: config.requestCommands,
      roomId: config.roomId,
    },
  };
}

function emitState() {
  bus.emit("queue:state", publicState());
}

function canUserRequest(userId) {
  const key = userId || "anonymous";
  const last = lastRequestByUser.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < config.minRequestIntervalMs) {
    return {
      ok: false,
      remainingMs: config.minRequestIntervalMs - elapsed,
    };
  }

  lastRequestByUser.set(key, Date.now());
  return {
    ok: true,
    remainingMs: 0,
  };
}

function isDuplicate(songId) {
  return current?.id === songId || queue.some((item) => item.id === songId);
}

function addSong(song, requester, keyword) {
  if (queue.length >= config.maxQueueSize) {
    throw new Error("Queue is full");
  }

  if (!config.allowDuplicates && isDuplicate(song.id)) {
    throw new Error("Song is already in the queue");
  }

  const item = {
    ...song,
    keyword,
    requester,
    requestId: createRequestId(),
    requestedAt: new Date().toISOString(),
  };
  item.streamUrl = `/api/audio/${item.requestId}`;
  registerSong(item);

  if (!current) {
    current = item;
    bus.emit("player:play", item);
  } else {
    queue.push(item);
  }

  bus.emit("queue:added", item);
  emitState();
  return item;
}

function nextSong(reason = "ended") {
  if (current) {
    history.push({
      ...current,
      finishedAt: new Date().toISOString(),
      finishReason: reason,
    });
  }

  current = queue.shift() || null;
  if (current) {
    bus.emit("player:play", current);
  } else {
    bus.emit("player:idle");
  }

  emitState();
  return current;
}

function skipSong(reason = "skipped") {
  return nextSong(reason);
}

function clearQueue() {
  queue.length = 0;
  emitState();
}

function removeQueuedSong(requestId) {
  const index = queue.findIndex((item) => item.requestId === requestId);
  if (index === -1) return null;

  const [removed] = queue.splice(index, 1);
  emitState();
  return removed;
}

function resetPlayback() {
  if (current) {
    history.push({
      ...current,
      finishedAt: new Date().toISOString(),
      finishReason: "reset",
    });
  }

  current = null;
  queue.length = 0;
  bus.emit("player:idle");
  emitState();
}

module.exports = {
  addSong,
  canUserRequest,
  clearQueue,
  nextSong,
  publicState,
  removeQueuedSong,
  resetPlayback,
  skipSong,
};
