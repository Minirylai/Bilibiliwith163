const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const config = require("./config");
const bus = require("./eventBus");
const { playbackSourceForRequest } = require("./audioCache");
const playerInstaller = require("./playerInstaller");

let baseUrl = "";
let activeProcess = null;
let activeToken = 0;
let suppressExitToken = 0;
let progressTimer = 0;
let progressPolling = false;
let mpvIpc = null;
let fallbackStartedAt = 0;
let stderrTail = "";

const state = {
  available: false,
  backend: "",
  current: null,
  duration: 0,
  message: "",
  outputMode: config.audioOutputMode,
  paused: false,
  position: 0,
  status: "idle",
  targetKind: "",
};

function publicSong(song) {
  if (!song) return null;
  return {
    artists: song.artists || "",
    cover: song.cover || "",
    duration: song.duration || 0,
    id: song.id,
    name: song.name || "",
    requestId: song.requestId || "",
    requester: song.requester || null,
  };
}

function getState() {
  return { ...state, current: state.current ? { ...state.current } : null };
}

function emitState() {
  bus.emit("player:state", getState());
}

function setState(next) {
  Object.assign(state, next);
  emitState();
}

function hasPathSeparator(value) {
  return /[\\/]/.test(value);
}

function executableExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findInPath(command) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookup, [command], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return "";
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function commonExecutablePaths(command) {
  if (process.platform !== "win32") return [];
  const programFiles = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
    "D:\\Software",
  ].filter(Boolean);

  if (command === "mpv") {
    return programFiles.flatMap((root) => [
      path.join(root, "mpv", "mpv.exe"),
      path.join(root, "mpv.net", "mpv.exe"),
      playerInstaller.bundledMpvPath(),
    ]);
  }

  return programFiles.flatMap((root) => [
    path.join(root, "ffmpeg", "bin", "ffplay.exe"),
    path.join(root, "ffplay", "ffplay.exe"),
  ]);
}

function resolveConfiguredPlayer() {
  const configured = config.localPlayerPath;
  if (!configured) return null;
  if (!hasPathSeparator(configured)) {
    const lower = configured.toLowerCase();
    return {
      backend: lower.includes("ffplay") || config.localPlayerBackend === "ffplay" ? "ffplay" : "mpv",
      executable: findInPath(configured) || configured,
    };
  }
  if (!executableExists(configured)) return null;
  const lower = configured.toLowerCase();
  return {
    backend: lower.includes("ffplay") ? "ffplay" : "mpv",
    executable: configured,
  };
}

function resolvePlayer() {
  const configured = resolveConfiguredPlayer();
  if (configured) return configured;

  const backends =
    config.localPlayerBackend === "auto"
      ? ["mpv", "ffplay"]
      : [config.localPlayerBackend];

  for (const backend of backends) {
    const fromPath = findInPath(backend);
    if (fromPath) return { backend, executable: fromPath };

    const commonPath = commonExecutablePaths(backend).find(executableExists);
    if (commonPath) return { backend, executable: commonPath };
  }

  return null;
}

function refreshAvailability() {
  const player = resolvePlayer();
  setState({
    available: Boolean(player),
    backend: player?.backend || "",
    message: player
      ? `本地播放器已就绪：${player.backend}`
      : "未找到本地播放器，请安装 mpv 或 ffplay，或在 .env 设置 LOCAL_PLAYER_PATH。",
  });
  return player;
}

function songDurationSeconds(song) {
  const raw = Number(song?.duration || song?.playback?.time || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1000 ? raw / 1000 : raw;
}

function mpvPipePath(token) {
  const name = `bilibiliwith163-${process.pid}-${token}`;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${name}`;
  }
  return path.join(os.tmpdir(), `${name}.sock`);
}

function createMpvIpc(pipePath) {
  let socket = null;
  let buffer = "";
  let requestId = 1;
  const pending = new Map();

  function close() {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error("mpv IPC closed"));
    }
    pending.clear();
    socket?.destroy();
    socket = null;
  }

  function handleLine(line) {
    if (!line.trim()) return;
    let message = null;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (!message.request_id || !pending.has(message.request_id)) return;
    const item = pending.get(message.request_id);
    pending.delete(message.request_id);
    clearTimeout(item.timer);
    if (message.error && message.error !== "success") {
      item.reject(new Error(message.error));
      return;
    }
    item.resolve(message.data);
  }

  async function connect(timeoutMs = 3500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        await new Promise((resolve, reject) => {
          const nextSocket = net.createConnection(pipePath);
          const timer = setTimeout(() => {
            nextSocket.destroy();
            reject(new Error("mpv IPC connection timed out"));
          }, 250);
          nextSocket.once("connect", () => {
            clearTimeout(timer);
            socket = nextSocket;
            socket.setEncoding("utf8");
            socket.on("data", (chunk) => {
              buffer += chunk;
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              lines.forEach(handleLine);
            });
            socket.on("close", close);
            socket.on("error", () => {});
            resolve();
          });
          nextSocket.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
        });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error("mpv IPC is unavailable");
  }

  function send(command, timeoutMs = 1200) {
    if (!socket || socket.destroyed) {
      return Promise.reject(new Error("mpv IPC is not connected"));
    }
    const id = requestId++;
    const payload = JSON.stringify({ command, request_id: id });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("mpv IPC command timed out"));
      }, timeoutMs);
      pending.set(id, { reject, resolve, timer });
      socket.write(`${payload}\n`);
    });
  }

  return { close, connect, send };
}

function recordStderr(chunk) {
  stderrTail = `${stderrTail}${chunk}`.slice(-1800);
}

function clearProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = 0;
  }
}

function stopProcess({ suppressExit = true } = {}) {
  clearProgressTimer();
  mpvIpc?.close();
  mpvIpc = null;

  if (!activeProcess) return;
  if (suppressExit) suppressExitToken = activeToken;
  const child = activeProcess;
  activeProcess = null;
  child.removeAllListeners("error");
  try {
    child.kill();
  } catch {
    // The process may already have exited.
  }
}

function spawnMpv(executable, target, token, volume) {
  const pipePath = mpvPipePath(token);
  const args = [
    "--no-video",
    "--force-window=no",
    "--idle=no",
    "--keep-open=no",
    "--really-quiet",
    `--volume=${Math.round(volume * 100)}`,
    `--input-ipc-server=${pipePath}`,
    target,
  ];
  const child = spawn(executable, args, {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  const ipc = createMpvIpc(pipePath);
  ipc.connect().catch((error) => {
    bus.emit("log", {
      level: "warn",
      message: `mpv IPC unavailable: ${error.message}`,
    });
  });
  mpvIpc = ipc;
  return child;
}

function spawnFfplay(executable, target, volume) {
  const args = [
    "-nodisp",
    "-autoexit",
    "-loglevel",
    "warning",
    "-volume",
    String(Math.round(volume * 100)),
    target,
  ];
  return spawn(executable, args, {
    stdio: ["pipe", "ignore", "pipe"],
    windowsHide: true,
  });
}

async function refreshProgress() {
  if (progressPolling || !activeProcess || !state.current) return;
  progressPolling = true;
  try {
    let position = state.position;
    let duration = state.duration;
    let paused = state.paused;

    if (mpvIpc) {
      try {
        const [timePos, mediaDuration, mpvPaused] = await Promise.all([
          mpvIpc.send(["get_property", "time-pos"]),
          mpvIpc.send(["get_property", "duration"]),
          mpvIpc.send(["get_property", "pause"]),
        ]);
        position = Number(timePos) || 0;
        duration = Number(mediaDuration) || duration;
        paused = Boolean(mpvPaused);
      } catch {
        if (!paused && fallbackStartedAt) {
          position = Math.max(0, (Date.now() - fallbackStartedAt) / 1000);
        }
      }
    } else if (!paused && fallbackStartedAt) {
      position = Math.max(0, (Date.now() - fallbackStartedAt) / 1000);
    }

    if (duration > 0) position = Math.min(position, duration);
    setState({
      duration,
      paused,
      position,
      status: paused ? "paused" : "playing",
    });
  } finally {
    progressPolling = false;
  }
}

function startProgressTimer() {
  clearProgressTimer();
  progressTimer = setInterval(() => {
    refreshProgress().catch(() => {});
  }, 700);
}

async function play(song) {
  if (config.audioOutputMode !== "local") {
    setState({
      available: false,
      current: publicSong(song),
      message: `不支持的音频输出模式：${config.audioOutputMode}`,
      status: "error",
    });
    return getState();
  }

  const player = resolvePlayer();
  if (!player) {
    setState({
      available: false,
      backend: "",
      current: publicSong(song),
      duration: songDurationSeconds(song),
      message: "未找到本地播放器，请安装 mpv 或 ffplay，或在 .env 设置 LOCAL_PLAYER_PATH。",
      paused: false,
      position: 0,
      status: "error",
      targetKind: "",
    });
    bus.emit("log", {
      level: "error",
      message: state.message,
    });
    return getState();
  }

  stopProcess({ suppressExit: true });
  activeToken += 1;
  const token = activeToken;
  stderrTail = "";

  let source;
  try {
    source = await playbackSourceForRequest(song.requestId, baseUrl);
  } catch (error) {
    setState({
      available: true,
      backend: player.backend,
      current: publicSong(song),
      message: error.message,
      status: "error",
    });
    bus.emit("log", {
      level: "error",
      message: `Local player source failed: ${error.message}`,
    });
    return getState();
  }

  const target = source.kind === "file" ? source.path : source.url;
  const volume = Math.min(1, Math.max(0, Number(config.playerVolume) || 0.75));
  fallbackStartedAt = Date.now();

  try {
    const child =
      player.backend === "mpv"
        ? spawnMpv(player.executable, target, token, volume)
        : spawnFfplay(player.executable, target, volume);

    activeProcess = child;
    child.stderr?.on("data", recordStderr);
    child.once("error", (error) => {
      if (token !== activeToken) return;
      stopProcess({ suppressExit: true });
      setState({
        available: true,
        backend: player.backend,
        current: publicSong(song),
        message: `Failed to start ${player.backend}: ${error.message}`,
        status: "error",
      });
      bus.emit("log", {
        level: "error",
        message: state.message,
      });
    });
    child.once("exit", (code, signal) => {
      if (token !== activeToken) return;
      const suppressed = suppressExitToken === token;
      activeProcess = null;
      clearProgressTimer();
      mpvIpc?.close();
      mpvIpc = null;
      if (suppressed) return;

      const reason = code === 0 ? "ended" : "player-exit";
      const detail = code === 0 ? "" : ` (${code ?? signal ?? "unknown"})`;
      bus.emit("log", {
        level: code === 0 ? "info" : "warn",
        message: `Local player ${reason}${detail}${stderrTail ? `: ${stderrTail.trim()}` : ""}`,
      });
      setState({
        message: "",
        paused: false,
        position: state.duration,
        status: "idle",
      });
      bus.emit("player:ended", { reason, song: publicSong(song) });
    });

    setState({
      available: true,
      backend: player.backend,
      current: publicSong(song),
      duration: songDurationSeconds(song),
      message: source.cached ? "正在播放本地缓存文件" : "正在播放后端音频代理",
      paused: false,
      position: 0,
      status: "playing",
      targetKind: source.kind,
    });
    startProgressTimer();
  } catch (error) {
    setState({
      available: true,
      backend: player.backend,
      current: publicSong(song),
      message: error.message,
      status: "error",
    });
  }

  return getState();
}

async function pause() {
  if (!activeProcess || state.status === "idle") return getState();
  if (state.backend === "mpv" && mpvIpc) {
    await mpvIpc.send(["set_property", "pause", true]).catch(() => {});
  } else if (state.backend === "ffplay") {
    try {
      activeProcess.stdin?.write("p");
    } catch {
      // ffplay stdin control is best-effort.
    }
  }
  setState({
    paused: true,
    status: "paused",
  });
  return getState();
}

async function resume() {
  if (!activeProcess || state.status === "idle") return getState();
  if (state.backend === "mpv" && mpvIpc) {
    await mpvIpc.send(["set_property", "pause", false]).catch(() => {});
  } else if (state.backend === "ffplay") {
    try {
      activeProcess.stdin?.write("p");
    } catch {
      // ffplay stdin control is best-effort.
    }
  }
  fallbackStartedAt = Date.now() - state.position * 1000;
  setState({
    paused: false,
    status: "playing",
  });
  return getState();
}

async function togglePause() {
  return state.paused || state.status === "paused" ? resume() : pause();
}

async function stop() {
  stopProcess({ suppressExit: true });
  setState({
    current: null,
    duration: 0,
    message: "",
    paused: false,
    position: 0,
    status: "idle",
    targetKind: "",
  });
  return getState();
}

function bind(options = {}) {
  baseUrl = options.baseUrl || "";
  refreshAvailability();

  bus.on("player:play", (song) => {
    play(song).catch((error) => {
      setState({
        current: publicSong(song),
        message: error.message,
        status: "error",
      });
    });
  });
  bus.on("player:idle", () => {
    stop().catch(() => {});
  });
}

module.exports = {
  bind,
  getState,
  pause,
  play,
  refreshAvailability,
  resume,
  stop,
  togglePause,
};
