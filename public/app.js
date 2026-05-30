const socket = io();
const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");
const marquee = document.getElementById("marquee");
const artistText = artist.querySelector(".auto-scroll-text");
const marqueeText = marquee.querySelector(".auto-scroll-text");
const statusText = document.getElementById("status");
const queueList = document.getElementById("queue");
const queuePanel = document.querySelector(".queue-panel");
const togglePlayButton = document.getElementById("toggle-play");
const nextSongButton = document.getElementById("next-song");
const progressFill = document.getElementById("progress-fill");
const progressTime = document.getElementById("progress-time");
const rootStyle = document.documentElement.style;
const { cssFont, escapeHtml, hexToRgb, numberValue, setPxVariable } = window.BilibiliNcmShared;

const text = {
  unknownArtist: "\u672a\u77e5\u6b4c\u624b",
  unknownSong: "\u672a\u77e5\u6b4c\u66f2",
  viewer: "\u89c2\u4f17",
  requestPrefix: "\u6765\u81ea",
  requestSuffix: "\u7684\u70b9\u6b4c",
  waitingTitle: "\u7b49\u5f85\u70b9\u6b4c",
  waitingArtist: "\u5f39\u5e55\u53d1\u9001\uff1a\u70b9\u6b4c \u6b4c\u540d",
  waitingRequest: "\u7b49\u5f85\u6765\u81ea\u76f4\u64ad\u95f4\u7684\u70b9\u6b4c",
  pause: "\u6682\u505c",
  resume: "\u7ee7\u7eed",
  pauseGlyph: "pause",
  resumeGlyph: "play",
  nextGlyph: "next",
  removeQueueItem: "\u79fb\u9664\u8be5\u6b4c",
  autoplayBlocked: "\u81ea\u52a8\u64ad\u653e\u88ab\u62e6\u622a\uff0c\u8bf7\u5728 OBS \u4ea4\u4e92\u7a97\u53e3\u70b9\u51fb\u4e00\u6b21\u9875\u9762",
  playFailed: "\u64ad\u653e\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  nextFailed: "\u5207\u6b4c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  removeFailed: "\u79fb\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  bilibiliError: "B\u7ad9\u8fde\u63a5\u5f02\u5e38",
  roomOffline: "\u76f4\u64ad\u95f4\u672a\u5f00\u64ad",
  queued: "\u5df2\u52a0\u5165\u961f\u5217",
  requestFailed: "\u70b9\u6b4c\u5931\u8d25",
};

let latestState = null;
let activeRequestId = "";
let trackTextMotionFrame = 0;
let queueMotionFrame = 0;
let queueItemMotionFrame = 0;

function applyAppearance(appearance = {}) {
  setPxVariable(rootStyle, "--widget-width", appearance.widgetWidth, 560);
  setPxVariable(rootStyle, "--now-playing-height", appearance.playerHeight, 132);
  setPxVariable(rootStyle, "--queue-panel-height", appearance.queueHeight, 242);
  setPxVariable(rootStyle, "--queue-item-height", appearance.queueItemHeight, 46);
  setPxVariable(rootStyle, "--player-radius", appearance.playerRadius, 26);
  setPxVariable(rootStyle, "--queue-radius", appearance.queueRadius, 26);
  setPxVariable(rootStyle, "--status-radius", appearance.statusRadius, 26);
  setPxVariable(rootStyle, "--title-font-size", appearance.titleFontSize, 32);
  setPxVariable(rootStyle, "--artist-font-size", appearance.artistFontSize, 19);
  setPxVariable(rootStyle, "--request-font-size", appearance.requestFontSize, 16);
  setPxVariable(rootStyle, "--queue-font-size", appearance.queueFontSize, 18);
  setPxVariable(rootStyle, "--status-bar-height", appearance.statusHeight, 42);
  setPxVariable(rootStyle, "--status-font-size", appearance.statusFontSize, 15);

  const coverSize = Math.min(170, Math.max(72, numberValue(appearance.playerHeight, 132) - 28));
  rootStyle.setProperty("--cover-size", `${coverSize}px`);
  rootStyle.setProperty("--glass-opacity", `${Math.min(0.72, Math.max(0.08, numberValue(appearance.glassOpacity, 24) / 100))}`);
  rootStyle.setProperty("--glass-blur", `${Math.min(40, Math.max(0, numberValue(appearance.glassBlur, 24)))}px`);
  rootStyle.setProperty("--title-font-family", cssFont(appearance.titleFontFamily));
  rootStyle.setProperty("--artist-font-family", cssFont(appearance.artistFontFamily));
  rootStyle.setProperty("--request-font-family", cssFont(appearance.requestFontFamily));
  rootStyle.setProperty("--queue-font-family", cssFont(appearance.queueFontFamily));
  rootStyle.setProperty("--status-font-family", cssFont(appearance.statusFontFamily));
  rootStyle.setProperty("--title-color", appearance.titleColor || "#f7fbff");
  rootStyle.setProperty("--artist-color", appearance.artistColor || "#eef4fc");
  rootStyle.setProperty("--request-color", appearance.requestColor || "#e6eef8");
  rootStyle.setProperty("--queue-color", appearance.queueColor || "#f7fbff");
  rootStyle.setProperty("--status-color", appearance.statusColor || "#ffe6a3");
  rootStyle.setProperty("--player-glass-rgb", hexToRgb(appearance.playerGlassColor, "#242a32"));
  rootStyle.setProperty("--queue-glass-rgb", hexToRgb(appearance.queueGlassColor, "#242a32"));
  rootStyle.setProperty("--status-glass-rgb", hexToRgb(appearance.statusGlassColor, "#242a32"));

  requestAnimationFrame(() => {
    refreshTrackTextMotion();
    refreshQueueItemMotion();
    refreshQueueMotion();
  });
}

function showStatus(message) {
  statusText.hidden = !message;
  statusText.textContent = message || "";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function requesterName(song) {
  return song?.requester?.name || text.viewer;
}

function requesterText(song) {
  return `${text.requestPrefix} ${requesterName(song)} ${text.requestSuffix}`;
}

function resetAutoScroll(frame) {
  frame.classList.remove("is-scrolling");
  frame.style.removeProperty("--inline-scroll-distance");
  frame.style.removeProperty("--inline-scroll-duration");
}

function measureAutoScroll(frame, textNode, options = {}) {
  if (!frame || !textNode) return;

  const overflow = textNode.scrollWidth - frame.clientWidth;
  if (overflow <= 2) return;

  const gap = options.gap ?? 42;
  const speed = options.speed ?? 28;
  const minDuration = options.minDuration ?? 9;
  const maxDuration = options.maxDuration ?? 22;
  const distance = Math.ceil(overflow + gap);
  const duration = Math.min(maxDuration, Math.max(minDuration, distance / speed));

  frame.style.setProperty("--inline-scroll-distance", `${distance}px`);
  frame.style.setProperty("--inline-scroll-duration", `${duration}s`);
  frame.classList.add("is-scrolling");
}

function refreshTrackTextMotion() {
  const lines = [
    { frame: title.closest(".auto-scroll-line"), textNode: title, options: { gap: 46, speed: 28 } },
    { frame: artist, textNode: artistText, options: { gap: 38, speed: 24, minDuration: 8, maxDuration: 18 } },
    { frame: marquee, textNode: marqueeText, options: { gap: 34, speed: 24, minDuration: 8, maxDuration: 18 } },
  ];

  cancelAnimationFrame(trackTextMotionFrame);
  lines.forEach(({ frame }) => frame && resetAutoScroll(frame));

  trackTextMotionFrame = requestAnimationFrame(() => {
    lines.forEach(({ frame, textNode, options }) => measureAutoScroll(frame, textNode, options));
  });
}

function setTitle(value) {
  title.textContent = value || text.unknownSong;
  refreshTrackTextMotion();
}

function setAutoScrollText(frame, textNode, value, fallback = "") {
  if (!textNode) return;
  textNode.textContent = value || fallback;
  refreshTrackTextMotion();
}

function setTransportButton(button, glyph, label) {
  const icon = button?.querySelector(".control-glyph");
  if (icon) icon.textContent = "";
  if (button) {
    button.dataset.icon = glyph;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
}

function refreshQueueMotion() {
  if (!queuePanel || !queueList) return;

  cancelAnimationFrame(queueMotionFrame);
  queueList.classList.remove("is-scrolling");
  queueList.style.removeProperty("--queue-scroll-distance");
  queueList.style.removeProperty("--queue-scroll-duration");

  queueMotionFrame = requestAnimationFrame(() => {
    const panelStyles = getComputedStyle(queuePanel);
    const verticalPadding = parseFloat(panelStyles.paddingTop) + parseFloat(panelStyles.paddingBottom);
    const visibleHeight = Math.max(0, queuePanel.clientHeight - verticalPadding);
    const overflow = queueList.scrollHeight - visibleHeight;
    if (overflow <= 4) return;

    const distance = Math.ceil(overflow);
    const duration = Math.min(26, Math.max(10, distance / 16));
    queueList.style.setProperty("--queue-scroll-distance", `${distance}px`);
    queueList.style.setProperty("--queue-scroll-duration", `${duration}s`);
    queueList.classList.add("is-scrolling");
  });
}

function refreshQueueItemMotion() {
  cancelAnimationFrame(queueItemMotionFrame);
  document.querySelectorAll(".queue-song, .queue-requester").forEach((frame) => {
    resetAutoScroll(frame);
  });

  queueItemMotionFrame = requestAnimationFrame(() => {
    document.querySelectorAll(".queue-song, .queue-requester").forEach((frame) => {
      const textNode = frame.querySelector(".auto-scroll-text");
      measureAutoScroll(frame, textNode, { gap: 34, speed: 24, minDuration: 8, maxDuration: 18 });
    });
  });
}

function renderQueue(items = []) {
  queueList.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    const requestId = escapeHtml(item.requestId || "");
    li.innerHTML = `
      <button class="queue-remove" type="button" title="${text.removeQueueItem}" aria-label="${text.removeQueueItem}" data-remove-request-id="${requestId}">&minus;</button>
      <span class="queue-index">${index + 1}.</span>
      <span class="queue-song auto-scroll-line"><span class="queue-song-text auto-scroll-text">${escapeHtml(item.name)}</span></span>
      <small class="queue-requester auto-scroll-line"><span class="auto-scroll-text">${escapeHtml(requesterText(item))}</span></small>
    `;
    queueList.appendChild(li);
  });
  refreshQueueItemMotion();
  refreshQueueMotion();
}

function updateProgress() {
  const duration = audio.duration || 0;
  const current = audio.currentTime || 0;
  const percent = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  progressFill.style.width = `${percent}%`;
  progressTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function renderSong(song) {
  if (!song) {
    cover.src = "/placeholder.svg";
    setTitle(text.waitingTitle);
    setAutoScrollText(artist, artistText, text.waitingArtist);
    setAutoScrollText(marquee, marqueeText, text.waitingRequest);
    progressFill.style.width = "0%";
    progressTime.textContent = "00:00 / 00:00";
    setTransportButton(togglePlayButton, text.pauseGlyph, text.pause);
    return;
  }

  cover.src = song.cover || "/placeholder.svg";
  setTitle(song.name || text.unknownSong);
  setAutoScrollText(artist, artistText, song.artists || text.unknownArtist);
  setAutoScrollText(marquee, marqueeText, requesterText(song));
}

function renderBilibiliStatus(status) {
  if (status.lastError) {
    showStatus(`${text.bilibiliError}\uff1a${status.lastError}`);
    return;
  }

  if (status.liveStatus !== 1) {
    showStatus(text.roomOffline);
    return;
  }

  showStatus("");
}

function playbackUrl(song) {
  return song?.streamUrl || (song?.requestId ? `/api/audio/${song.requestId}` : song?.playback?.url);
}

async function playSong(song) {
  renderSong(song);
  const url = playbackUrl(song);
  if (!url) return;

  activeRequestId = song.requestId || String(song.id || "");
  audio.volume = latestState?.settings?.playerVolume ?? 0.75;
  audio.preload = "auto";
  audio.src = url;
  audio.load();

  const shouldAutoplay = latestState?.settings?.autoplay !== false;
  if (shouldAutoplay) {
    try {
      await audio.play();
      updatePlayButton();
      showStatus("");
    } catch {
      showStatus(text.autoplayBlocked);
    }
  }
}

function updatePlayButton() {
  setTransportButton(
    togglePlayButton,
    audio.paused ? text.resumeGlyph : text.pauseGlyph,
    audio.paused ? text.resume : text.pause,
  );
}

async function postJson(url) {
  const response = await fetch(url, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json().catch(() => null);
}

togglePlayButton.addEventListener("click", async () => {
  if (!audio.src) return;

  if (audio.paused) {
    await audio.play().catch(() => showStatus(text.playFailed));
  } else {
    audio.pause();
  }
  updatePlayButton();
});

nextSongButton.addEventListener("click", async () => {
  nextSongButton.disabled = true;
  try {
    await postJson("/api/next");
  } catch {
    showStatus(text.nextFailed);
  } finally {
    nextSongButton.disabled = false;
  }
});

queueList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-request-id]");
  if (!button) return;

  const requestId = button.dataset.removeRequestId;
  if (!requestId) return;

  button.disabled = true;
  try {
    await postJson(`/api/queue/${encodeURIComponent(requestId)}/remove`);
  } catch {
    showStatus(text.removeFailed);
    button.disabled = false;
  }
});

audio.addEventListener("ended", () => {
  postJson("/api/next").catch(() => {});
});

audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("waiting", () => showStatus(""));
audio.addEventListener("canplay", () => showStatus(""));
audio.addEventListener("canplaythrough", () => showStatus(""));
audio.addEventListener("playing", () => {
  showStatus("");
  updatePlayButton();
});
audio.addEventListener("pause", updatePlayButton);

socket.on("queue:state", (state) => {
  latestState = state;
  renderQueue(state.queue);

  if (!state.current) {
    activeRequestId = "";
    audio.removeAttribute("src");
    audio.load();
    renderSong(null);
    return;
  }

  renderSong(state.current);
  const requestId = state.current.requestId || String(state.current.id || "");
  if (!activeRequestId) {
    playSong(state.current);
  } else if (activeRequestId !== requestId) {
    activeRequestId = requestId;
  }
});

socket.on("player:play", playSong);

socket.on("player:idle", () => {
  activeRequestId = "";
  audio.removeAttribute("src");
  audio.load();
  renderSong(null);
  showStatus("");
});

socket.on("bilibili:status", renderBilibiliStatus);
socket.on("appearance:state", applyAppearance);
socket.on("request:accepted", (item) => showStatus(`${text.queued}\uff1a${item.name}`));
socket.on("request:rejected", (event) => showStatus(event.reason || text.requestFailed));

window.addEventListener("resize", () => {
  refreshTrackTextMotion();
  refreshQueueItemMotion();
  refreshQueueMotion();
});
if (typeof ResizeObserver !== "undefined") {
  const queueResizeObserver = new ResizeObserver(() => {
    refreshQueueItemMotion();
    refreshQueueMotion();
  });
  if (queuePanel) queueResizeObserver.observe(queuePanel);
  if (queueList) queueResizeObserver.observe(queueList);
}
document.fonts?.ready
  ?.then(() => {
    refreshTrackTextMotion();
    refreshQueueItemMotion();
    refreshQueueMotion();
  })
  .catch(() => {});
setTransportButton(nextSongButton, text.nextGlyph, "\u8df3\u5230\u4e0b\u4e00\u9996");
updatePlayButton();
fetch("/api/appearance")
  .then((response) => response.json())
  .then(applyAppearance)
  .catch(() => {});
