const bus = require("./eventBus");
const config = require("./config");
const { createRequestId, registerSong, releaseSong } = require("./audioCache");

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

function totalSongCount() {
  return queue.length + (current ? 1 : 0);
}

function emitState() {
  bus.emit("queue:state", publicState());
}

function trimHistory() {
  const maxItems = config.maxHistoryItems;
  if (maxItems <= 0) {
    history.length = 0;
    return;
  }

  if (history.length > maxItems) {
    history.splice(0, history.length - maxItems);
  }
}

function recordHistory(song, reason) {
  if (!song) return;
  history.push({
    ...song,
    finishedAt: new Date().toISOString(),
    finishReason: reason,
  });
  trimHistory();
}

function cleanupCooldowns(now = Date.now()) {
  const ttlMs = Math.max(config.minRequestIntervalMs, config.userCooldownTtlMs);
  for (const [key, last] of lastRequestByUser.entries()) {
    if (now - last > ttlMs) {
      lastRequestByUser.delete(key);
    }
  }
}

function canUserRequest(userId) {
  const key = userId || "anonymous";
  const now = Date.now();
  cleanupCooldowns(now);
  const last = lastRequestByUser.get(key) || 0;
  const elapsed = now - last;
  if (elapsed < config.minRequestIntervalMs) {
    return {
      ok: false,
      remainingMs: config.minRequestIntervalMs - elapsed,
    };
  }

  return {
    ok: true,
    remainingMs: 0,
  };
}

function commitUserRequest(userId) {
  const key = userId || "anonymous";
  const now = Date.now();
  cleanupCooldowns(now);
  lastRequestByUser.set(key, now);
}

function isDuplicate(songId) {
  return current?.id === songId || queue.some((item) => item.id === songId);
}

function addSong(song, requester, keyword) {
  if (totalSongCount() >= config.maxQueueSize) {
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
  const previous = current;
  recordHistory(previous, reason);

  current = queue.shift() || null;
  releaseSong(previous);
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
  queue.forEach(releaseSong);
  queue.length = 0;
  emitState();
}

function removeQueuedSong(requestId) {
  const index = queue.findIndex((item) => item.requestId === requestId);
  if (index === -1) return null;

  const [removed] = queue.splice(index, 1);
  releaseSong(removed);
  emitState();
  return removed;
}

function resetPlayback() {
  const previous = current;
  const queued = queue.splice(0);
  recordHistory(previous, "reset");

  current = null;
  releaseSong(previous);
  queued.forEach(releaseSong);
  bus.emit("player:idle");
  emitState();
}

module.exports = {
  addSong,
  canUserRequest,
  commitUserRequest,
  clearQueue,
  nextSong,
  publicState,
  removeQueuedSong,
  resetPlayback,
  skipSong,
};
