const socket = io();

const statusText = document.getElementById("dash-status");
const current = document.getElementById("dash-current");
const dashAudio = document.getElementById("dash-audio");
const queueList = document.getElementById("dash-queue");
const events = document.getElementById("events");
const ncmLoginStatus = document.getElementById("ncm-login-status");
const ncmLoginQr = document.getElementById("ncm-login-qr");
const ncmLoginQrImg = document.getElementById("ncm-login-qr-img");
const ncmLoginQrTip = document.getElementById("ncm-login-qr-tip");
const roomForm = document.getElementById("room-form");
const roomIdInput = document.getElementById("room-id-input");
const roomSaveState = document.getElementById("room-save-state");
const saveState = document.getElementById("appearance-save-state");
const previewShell = document.getElementById("preview-shell");
const playerResizer = document.getElementById("editor-player-resizer");
const queueResizer = document.getElementById("editor-queue-resizer");
const previewCover = document.getElementById("preview-cover");
const previewTrackTitle = document.getElementById("preview-track-title");
const previewTrackArtist = document.getElementById("preview-track-artist");
const previewTrackRequest = document.getElementById("preview-track-request");
const previewQueueList = document.getElementById("preview-queue-list");
const previewStatus = document.getElementById("preview-status");
const loadLocalFontsButton = document.getElementById("load-local-fonts");
const localFontStatus = document.getElementById("local-font-status");
const previewWallpaperToggle = document.getElementById("preview-wallpaper-toggle");
const { cssFont, escapeHtml, hexToRgb, numberValue } = window.BilibiliNcmShared;

const editorControls = {
  widgetWidth: document.getElementById("editor-widget-width"),
  playerHeight: document.getElementById("editor-player-height"),
  queueHeight: document.getElementById("editor-queue-height"),
  queueItemHeight: document.getElementById("editor-queue-item-height"),
  playerRadius: document.getElementById("editor-player-radius"),
  queueRadius: document.getElementById("editor-queue-radius"),
  statusRadius: document.getElementById("editor-status-radius"),
  glassOpacity: document.getElementById("editor-glass-opacity"),
  glassBlur: document.getElementById("editor-glass-blur"),
  titleFontSize: document.getElementById("editor-title-size"),
  artistFontSize: document.getElementById("editor-artist-size"),
  requestFontSize: document.getElementById("editor-request-size"),
  queueFontSize: document.getElementById("editor-queue-size"),
  statusHeight: document.getElementById("editor-status-height"),
  statusFontSize: document.getElementById("editor-status-size"),
  titleColor: document.getElementById("editor-title-color"),
  artistColor: document.getElementById("editor-artist-color"),
  requestColor: document.getElementById("editor-request-color"),
  queueColor: document.getElementById("editor-queue-color"),
  statusColor: document.getElementById("editor-status-color"),
  titleFontFamily: document.getElementById("editor-title-font"),
  artistFontFamily: document.getElementById("editor-artist-font"),
  requestFontFamily: document.getElementById("editor-request-font"),
  queueFontFamily: document.getElementById("editor-queue-font"),
  statusFontFamily: document.getElementById("editor-status-font"),
  playerGlassColor: document.getElementById("editor-player-glass-color"),
  queueGlassColor: document.getElementById("editor-queue-glass-color"),
  statusGlassColor: document.getElementById("editor-status-glass-color"),
};

const appearanceDefaults = {
  widgetWidth: 560,
  playerHeight: 132,
  queueHeight: 242,
  queueItemHeight: 46,
  playerRadius: 26,
  queueRadius: 26,
  statusRadius: 26,
  glassOpacity: 24,
  glassBlur: 24,
  titleFontSize: 32,
  artistFontSize: 19,
  requestFontSize: 16,
  queueFontSize: 18,
  statusHeight: 42,
  statusFontSize: 15,
  titleFontFamily: "Microsoft YaHei",
  artistFontFamily: "Microsoft YaHei",
  requestFontFamily: "Microsoft YaHei",
  queueFontFamily: "Microsoft YaHei",
  statusFontFamily: "Microsoft YaHei",
  titleColor: "#f7fbff",
  artistColor: "#eef4fc",
  requestColor: "#e6eef8",
  queueColor: "#f7fbff",
  statusColor: "#ffe6a3",
  playerGlassColor: "#242a32",
  queueGlassColor: "#242a32",
  statusGlassColor: "#242a32",
};

const defaultFonts = [
  "Microsoft YaHei",
  "Segoe UI",
  "Arial",
  "Bahnschrift",
  "Cambria",
  "Consolas",
  "KaiTi",
  "SimHei",
  "SimSun",
];
let fonts = [...defaultFonts];

let lastDanmakuStatusAt = "";
let ncmLoginPoll = 0;
let appearance = { ...appearanceDefaults };
let saveTimer = 0;
let applyingAppearance = false;
let suppressResizeObserver = false;
let localEditUntil = 0;
let previewQueueMotionFrame = 0;
const appearancePresetStorageKey = "bilibili-ncm-appearance-preset";
const previewWallpaperCandidates = ["/pic/miku.png", "/pic/miku.jpg"];

function addEvent(text, tone = "info") {
  const li = document.createElement("li");
  li.className = tone;
  li.textContent = text;
  events.prepend(li);
  while (events.children.length > 30) {
    events.lastElementChild.remove();
  }
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || response.statusText);
  return payload;
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || response.statusText);
  return payload;
}

function setSaveState(text, tone = "") {
  saveState.textContent = text;
  saveState.className = tone ? `panel-note ${tone}` : "panel-note";
}

function setRoomState(text, tone = "") {
  roomSaveState.textContent = text;
  roomSaveState.className = tone ? `panel-note ${tone}` : "panel-note";
}

function markLocalEdit() {
  localEditUntil = Date.now() + 1400;
}

function loadImageCandidate(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = reject;
    image.src = src;
  });
}

async function setupPreviewWallpaper() {
  for (const src of previewWallpaperCandidates) {
    try {
      const resolved = await loadImageCandidate(src);
      previewShell.style.setProperty("--preview-wallpaper", `url("${resolved}")`);
      return true;
    } catch {
      // Try the next extension.
    }
  }
  return false;
}

async function togglePreviewWallpaper() {
  if (previewShell.classList.contains("is-wallpaper-preview")) {
    previewShell.classList.remove("is-wallpaper-preview");
    previewWallpaperToggle.setAttribute("aria-pressed", "false");
    previewWallpaperToggle.textContent = "底图预览";
    return;
  }

  previewWallpaperToggle.disabled = true;
  const ready = await setupPreviewWallpaper();
  previewWallpaperToggle.disabled = false;
  if (!ready) {
    setSaveState("未找到 pic/miku.png 或 pic/miku.jpg", "bad-text");
    return;
  }
  previewShell.classList.add("is-wallpaper-preview");
  previewWallpaperToggle.setAttribute("aria-pressed", "true");
  previewWallpaperToggle.textContent = "关闭底图";
}

function populateFontSelects() {
  const selects = [
    editorControls.titleFontFamily,
    editorControls.artistFontFamily,
    editorControls.requestFontFamily,
    editorControls.queueFontFamily,
    editorControls.statusFontFamily,
  ];
  for (const select of selects) {
    const selected = select.value;
    select.innerHTML = fonts.map((font) => `<option value="${escapeHtml(font)}">${escapeHtml(font)}</option>`).join("");
    if (selected) {
      if (!fonts.includes(selected)) {
        select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(selected)}">${escapeHtml(selected)}</option>`);
      }
      select.value = selected;
    }
  }
}

function setLocalFontStatus(text, tone = "") {
  localFontStatus.textContent = text;
  localFontStatus.className = tone ? `panel-note ${tone}` : "panel-note";
}

async function loadLocalFonts() {
  if (!("queryLocalFonts" in window)) {
    setLocalFontStatus("当前浏览器不支持读取本机字体，已保留内置字体列表。", "bad-text");
    return;
  }

  loadLocalFontsButton.disabled = true;
  setLocalFontStatus("等待浏览器授权读取本机字体...", "");
  try {
    const availableFonts = await window.queryLocalFonts();
    const localFamilies = [...new Set(availableFonts.map((font) => font.family).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    fonts = [...new Set([...defaultFonts, ...localFamilies])];
    populateFontSelects();
    fillAppearanceControls(appearance, { fromUser: true });
    setLocalFontStatus(`已读取 ${localFamilies.length} 个本机字体族`, "ok-text");
  } catch (error) {
    setLocalFontStatus(`读取本机字体失败：${error.message}`, "bad-text");
  } finally {
    loadLocalFontsButton.disabled = false;
  }
}

function updatePreviewSizes({ suppressObserver = true } = {}) {
  if (suppressObserver) suppressResizeObserver = true;
  const coverSize = Math.min(170, Math.max(72, numberValue(appearance.playerHeight, 132) - 28));
  const glassOpacity = Math.min(0.72, Math.max(0.08, numberValue(appearance.glassOpacity, 24) / 100));
  const glassBlur = Math.min(40, Math.max(0, numberValue(appearance.glassBlur, 24)));
  const target = previewShell || document.documentElement;

  target.style.width = `${appearance.widgetWidth}px`;
  target.style.setProperty("--cover-size", `${coverSize}px`);
  target.style.setProperty("--now-playing-height", `${appearance.playerHeight}px`);
  target.style.setProperty("--queue-panel-height", `${appearance.queueHeight}px`);
  target.style.setProperty("--queue-item-height", `${appearance.queueItemHeight}px`);
  target.style.setProperty("--player-radius", `${appearance.playerRadius}px`);
  target.style.setProperty("--queue-radius", `${appearance.queueRadius}px`);
  target.style.setProperty("--status-radius", `${appearance.statusRadius}px`);
  target.style.setProperty("--widget-width", `${appearance.widgetWidth}px`);
  target.style.setProperty("--title-font-size", `${appearance.titleFontSize}px`);
  target.style.setProperty("--artist-font-size", `${appearance.artistFontSize}px`);
  target.style.setProperty("--request-font-size", `${appearance.requestFontSize}px`);
  target.style.setProperty("--queue-font-size", `${appearance.queueFontSize}px`);
  target.style.setProperty("--status-bar-height", `${appearance.statusHeight}px`);
  target.style.setProperty("--status-font-size", `${appearance.statusFontSize}px`);
  target.style.setProperty("--glass-opacity", `${glassOpacity}`);
  target.style.setProperty("--glass-blur", `${glassBlur}px`);
  target.style.setProperty("--title-font-family", cssFont(appearance.titleFontFamily));
  target.style.setProperty("--artist-font-family", cssFont(appearance.artistFontFamily));
  target.style.setProperty("--request-font-family", cssFont(appearance.requestFontFamily));
  target.style.setProperty("--queue-font-family", cssFont(appearance.queueFontFamily));
  target.style.setProperty("--status-font-family", cssFont(appearance.statusFontFamily));
  target.style.setProperty("--title-color", appearance.titleColor || appearanceDefaults.titleColor);
  target.style.setProperty("--artist-color", appearance.artistColor || appearanceDefaults.artistColor);
  target.style.setProperty("--request-color", appearance.requestColor || appearanceDefaults.requestColor);
  target.style.setProperty("--queue-color", appearance.queueColor || appearanceDefaults.queueColor);
  target.style.setProperty("--status-color", appearance.statusColor || appearanceDefaults.statusColor);
  target.style.setProperty("--player-glass-rgb", hexToRgb(appearance.playerGlassColor, appearanceDefaults.playerGlassColor));
  target.style.setProperty("--queue-glass-rgb", hexToRgb(appearance.queueGlassColor, appearanceDefaults.queueGlassColor));
  target.style.setProperty("--status-glass-rgb", hexToRgb(appearance.statusGlassColor, appearanceDefaults.statusGlassColor));

  playerResizer.style.height = `${appearance.playerHeight}px`;
  queueResizer.style.height = `${appearance.queueHeight}px`;
  refreshPreviewQueueMotion();
  if (suppressObserver) {
    requestAnimationFrame(() => {
      suppressResizeObserver = false;
    });
  }
}

function refreshPreviewQueueMotion() {
  const queuePanel = previewQueueList?.closest(".queue-panel");
  if (!queuePanel || !previewQueueList) return;

  cancelAnimationFrame(previewQueueMotionFrame);
  previewQueueList.classList.remove("is-scrolling");
  previewQueueList.style.removeProperty("--queue-scroll-distance");
  previewQueueList.style.removeProperty("--queue-scroll-duration");

  previewQueueMotionFrame = requestAnimationFrame(() => {
    const panelStyles = getComputedStyle(queuePanel);
    const verticalPadding = parseFloat(panelStyles.paddingTop) + parseFloat(panelStyles.paddingBottom);
    const visibleHeight = Math.max(0, queuePanel.clientHeight - verticalPadding);
    const overflow = previewQueueList.scrollHeight - visibleHeight;
    if (overflow <= 4) return;

    const distance = Math.ceil(overflow);
    const duration = Math.min(26, Math.max(10, distance / 16));
    previewQueueList.style.setProperty("--queue-scroll-distance", `${distance}px`);
    previewQueueList.style.setProperty("--queue-scroll-duration", `${duration}s`);
    previewQueueList.classList.add("is-scrolling");
  });
}

function fillAppearanceControls(next, { fromUser = false } = {}) {
  applyingAppearance = true;
  appearance = { ...appearanceDefaults, ...next };
  for (const [key, input] of Object.entries(editorControls)) {
    input.value = appearance[key];
  }
  updatePreviewSizes({ suppressObserver: !fromUser });
  applyingAppearance = false;
}

function readAppearanceFromControls() {
  return {
    ...appearance,
    widgetWidth: Number(editorControls.widgetWidth.value),
    playerHeight: Number(editorControls.playerHeight.value),
    queueHeight: Number(editorControls.queueHeight.value),
    queueItemHeight: Number(editorControls.queueItemHeight.value),
    playerRadius: Number(editorControls.playerRadius.value),
    queueRadius: Number(editorControls.queueRadius.value),
    statusRadius: Number(editorControls.statusRadius.value),
    glassOpacity: Number(editorControls.glassOpacity.value),
    glassBlur: Number(editorControls.glassBlur.value),
    titleFontSize: Number(editorControls.titleFontSize.value),
    artistFontSize: Number(editorControls.artistFontSize.value),
    requestFontSize: Number(editorControls.requestFontSize.value),
    queueFontSize: Number(editorControls.queueFontSize.value),
    statusHeight: Number(editorControls.statusHeight.value),
    statusFontSize: Number(editorControls.statusFontSize.value),
    titleColor: editorControls.titleColor.value,
    artistColor: editorControls.artistColor.value,
    requestColor: editorControls.requestColor.value,
    queueColor: editorControls.queueColor.value,
    statusColor: editorControls.statusColor.value,
    titleFontFamily: editorControls.titleFontFamily.value,
    artistFontFamily: editorControls.artistFontFamily.value,
    requestFontFamily: editorControls.requestFontFamily.value,
    queueFontFamily: editorControls.queueFontFamily.value,
    statusFontFamily: editorControls.statusFontFamily.value,
    playerGlassColor: editorControls.playerGlassColor.value,
    queueGlassColor: editorControls.queueGlassColor.value,
    statusGlassColor: editorControls.statusGlassColor.value,
  };
}

async function saveAppearancePreset() {
  const next = readAppearanceFromControls();
  setSaveState("配置保存中...", "");
  try {
    const saved = await postJson("/api/appearance/saved", next);
    appearance = { ...appearanceDefaults, ...saved.appearance };
    fillAppearanceControls(appearance);
    setSaveState("配置已保存", "ok-text");
  } catch (error) {
    try {
      localStorage.setItem(appearancePresetStorageKey, JSON.stringify(next));
      setSaveState("配置已保存到浏览器", "ok-text");
    } catch (storageError) {
      setSaveState(`配置保存失败：${storageError.message || error.message}`, "bad-text");
    }
  }
}

async function loadAppearancePreset() {
  setSaveState("读取配置中...", "");
  try {
    const saved = await postJson("/api/appearance/load-saved");
    appearance = { ...appearanceDefaults, ...saved };
    fillAppearanceControls(appearance);
    setSaveState("配置已读取并同步到 OBS", "ok-text");
  } catch (error) {
    try {
      const raw = localStorage.getItem(appearancePresetStorageKey);
      if (!raw) throw new Error(error.message);
      appearance = { ...appearanceDefaults, ...JSON.parse(raw) };
      await saveAppearanceNow(appearance);
      setSaveState("已读取浏览器保存配置并同步到 OBS", "ok-text");
    } catch (storageError) {
      setSaveState(`读取配置失败：${storageError.message}`, "bad-text");
    }
  }
}

async function saveAppearanceNow(next = readAppearanceFromControls()) {
  markLocalEdit();
  appearance = { ...appearance, ...next };
  fillAppearanceControls(appearance, { fromUser: true });
  setSaveState("保存中...", "");
  try {
    const saved = await postJson("/api/appearance", appearance);
    appearance = { ...appearanceDefaults, ...saved };
    fillAppearanceControls(appearance);
    setSaveState("已同步到 OBS 浏览器源", "ok-text");
  } catch (error) {
    setSaveState(`保存失败：${error.message}`, "bad-text");
  }
}

function queueAppearanceSave() {
  if (applyingAppearance) return;
  markLocalEdit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveAppearanceNow(readAppearanceFromControls()), 280);
}

async function loadAppearance() {
  try {
    fillAppearanceControls(await getJson("/api/appearance"));
  } catch (error) {
    setSaveState(`读取点歌器外观失败：${error.message}`, "bad-text");
  }
}

async function loadRoomConfig() {
  try {
    const payload = await getJson("/api/bilibili/room");
    roomIdInput.value = payload.roomId || "";
  } catch (error) {
    setRoomState(`读取房间失败：${error.message}`, "bad-text");
  }
}

async function saveRoomConfig() {
  const roomId = Number(roomIdInput.value);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    setRoomState("请输入有效房间号", "bad-text");
    return;
  }

  setRoomState("切换中...", "");
  try {
    const payload = await postJson("/api/bilibili/room", { roomId });
    roomIdInput.value = payload.roomId || roomId;
    setRoomState("已切换并写入 .env", "ok-text");
    addEvent(`已切换追踪房间：${payload.roomId || roomId}`, "ok");
  } catch (error) {
    setRoomState(`切换失败：${error.message}`, "bad-text");
  }
}

function renderQueue(items = []) {
  queueList.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.requester?.name || "")}</small>`;
    queueList.appendChild(li);
  }
  renderQueuePreview(items);
}

function renderQueuePreview(items = []) {
  const previewItems = items.length
    ? items.slice(0, 6)
    : [
        { name: "大貔貅（DJ阿智版）", requester: { name: "观众" } },
        { name: "Bad Apple!!", requester: { name: "观众" } },
        { name: "夜に浮かぶ", requester: { name: "观众" } },
        { name: "生日快乐歌", requester: { name: "观众" } },
        { name: "我们不会再见面", requester: { name: "观众" } },
        { name: "下一首候选", requester: { name: "观众" } },
      ];
  previewQueueList.innerHTML = previewItems
    .map((item, index) => {
      const requester = item.requester?.name || "观众";
      return `
        <li>
          <button class="queue-remove" type="button" tabindex="-1">&minus;</button>
          <span class="queue-index">${index + 1}.</span>
          <span class="queue-song auto-scroll-line"><span class="auto-scroll-text">${escapeHtml(item.name)}</span></span>
          <small class="queue-requester auto-scroll-line"><span class="auto-scroll-text">来自 ${escapeHtml(requester)} 的点歌</span></small>
        </li>
      `;
    })
    .join("");
  refreshPreviewQueueMotion();
}

function renderCurrent(song) {
  if (!song) {
    current.className = "empty";
    current.textContent = "暂无歌曲";
    dashAudio.hidden = true;
    dashAudio.removeAttribute("src");
    dashAudio.dataset.src = "";
    dashAudio.load();
    previewTrackTitle.textContent = "当前歌曲标题";
    previewTrackArtist.textContent = "歌手 / 作者";
    previewTrackRequest.textContent = "来自观众的点歌";
    previewCover.src = "/placeholder.svg";
    return;
  }

  current.className = "current-track";
  current.innerHTML = `
    <img src="${escapeHtml(song.cover || "/placeholder.svg")}" alt="" />
    <div>
      <strong>${escapeHtml(song.name)}</strong>
      <span>${escapeHtml(song.artists || "")}</span>
      <small>来自 ${escapeHtml(song.requester?.name || "观众")} 的点歌</small>
    </div>
  `;
  previewTrackTitle.textContent = song.name || "当前歌曲标题";
  previewTrackArtist.textContent = song.artists || "歌手 / 作者";
  previewTrackRequest.textContent = `来自 ${song.requester?.name || "观众"} 的点歌`;
  previewCover.src = song.cover || "/placeholder.svg";

  const streamUrl = song.streamUrl || (song.requestId ? `/api/audio/${encodeURIComponent(song.requestId)}` : "");
  dashAudio.hidden = true;
  dashAudio.dataset.src = streamUrl;
}

function renderBilibiliStatus(status) {
  const roomId = status.roomId || status.requestedRoomId;
  if (roomId && roomIdInput && !roomIdInput.value) {
    roomIdInput.value = roomId;
  }
  if (status.switching) {
    statusText.textContent = `Bilibili 房间 ${roomId} 切换中`;
    return;
  }
  if (status.liveStatus !== 1) {
    statusText.textContent = `Bilibili 房间 ${roomId} 未开播`;
    return;
  }
  statusText.textContent = status.connected
    ? `Bilibili 房间 ${roomId} 已连接`
    : `Bilibili 房间 ${roomId} 连接中`;

  if (status.lastDanmaku?.at && status.lastDanmaku.at !== lastDanmakuStatusAt) {
    lastDanmakuStatusAt = status.lastDanmaku.at;
    addEvent(`弹幕 ${status.lastDanmaku.user}: ${status.lastDanmaku.text}`);
  }
}

function stopNcmLoginPolling() {
  if (ncmLoginPoll) {
    clearInterval(ncmLoginPoll);
    ncmLoginPoll = 0;
  }
}

function renderNcmLoginStatus(status) {
  const name = status.profile?.nickname || (status.account?.id ? `UID ${status.account.id}` : "");
  if (status.loggedIn) {
    ncmLoginStatus.className = "ok-text";
    ncmLoginStatus.textContent = `已登录网易云：${name || "账号已认证"}`;
    ncmLoginQr.hidden = true;
    stopNcmLoginPolling();
    return;
  }
  ncmLoginStatus.className = "empty";
  ncmLoginStatus.textContent = "未登录网易云，会员歌曲只能按游客权限尝试播放";
}

async function refreshNcmLoginStatus() {
  try {
    renderNcmLoginStatus(await getJson("/api/ncm/login/status"));
  } catch (error) {
    ncmLoginStatus.className = "bad-text";
    ncmLoginStatus.textContent = `网易云状态检查失败：${error.message}`;
  }
}

async function startNcmQrLogin() {
  stopNcmLoginPolling();
  ncmLoginStatus.className = "empty";
  ncmLoginStatus.textContent = "正在生成网易云登录二维码...";
  ncmLoginQr.hidden = true;

  try {
    const qr = await postJson("/api/ncm/login/qr");
    ncmLoginQrImg.src = qr.qrimg;
    ncmLoginQr.hidden = false;
    ncmLoginQrTip.textContent = "请用网易云音乐 App 扫码确认登录";
    ncmLoginStatus.textContent = "等待扫码...";

    ncmLoginPoll = setInterval(async () => {
      try {
        const result = await getJson(`/api/ncm/login/qr/${encodeURIComponent(qr.key)}`);
        if (result.code === 801) return;
        if (result.code === 802) {
          ncmLoginQrTip.textContent = "已扫码，请在手机上确认登录";
          return;
        }
        if (result.code === 803) {
          ncmLoginQrTip.textContent = "登录成功";
          await refreshNcmLoginStatus();
          addEvent("网易云登录成功", "ok");
          return;
        }
        if (result.code === 800) {
          stopNcmLoginPolling();
          ncmLoginQrTip.textContent = "二维码已过期，请重新生成";
        }
      } catch (error) {
        stopNcmLoginPolling();
        ncmLoginQrTip.textContent = `扫码状态检查失败：${error.message}`;
      }
    }, 2200);
  } catch (error) {
    ncmLoginStatus.className = "bad-text";
    ncmLoginStatus.textContent = `二维码生成失败：${error.message}`;
  }
}

document.getElementById("skip").addEventListener("click", () => {
  postJson("/api/skip").catch((error) => addEvent(`跳过失败：${error.message}`, "bad"));
});
document.getElementById("clear").addEventListener("click", () => {
  postJson("/api/clear").catch((error) => addEvent(`清空失败：${error.message}`, "bad"));
});
document.getElementById("reset").addEventListener("click", () => {
  postJson("/api/reset").catch((error) => addEvent(`停止失败：${error.message}`, "bad"));
});
document.getElementById("ncm-login-open").addEventListener("click", startNcmQrLogin);
document.getElementById("ncm-login-refresh").addEventListener("click", refreshNcmLoginStatus);
document.getElementById("ncm-login-logout").addEventListener("click", async () => {
  try {
    await postJson("/api/ncm/logout");
    ncmLoginQr.hidden = true;
    await refreshNcmLoginStatus();
    addEvent("网易云已退出登录", "ok");
  } catch (error) {
    addEvent(`网易云退出失败：${error.message}`, "bad");
  }
});
roomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveRoomConfig();
});

for (const [key, input] of Object.entries(editorControls)) {
  input.addEventListener("input", () => {
    appearance = {
      ...appearance,
      [key]: input.type === "number" || input.type === "range" ? Number(input.value) : input.value,
    };
    fillAppearanceControls(appearance, { fromUser: true });
    queueAppearanceSave();
  });
}

document.getElementById("appearance-reset").addEventListener("click", () => saveAppearanceNow(appearanceDefaults));
document.getElementById("appearance-save-preset").addEventListener("click", saveAppearancePreset);
document.getElementById("appearance-load-preset").addEventListener("click", loadAppearancePreset);
loadLocalFontsButton.addEventListener("click", loadLocalFonts);
previewWallpaperToggle.addEventListener("click", togglePreviewWallpaper);
setupPreviewWallpaper().then((ready) => {
  if (!ready) return;
  previewShell.classList.add("is-wallpaper-preview");
  previewWallpaperToggle.setAttribute("aria-pressed", "true");
  previewWallpaperToggle.textContent = "关闭底图";
});

socket.on("queue:state", (state) => {
  renderCurrent(state.current);
  renderQueue(state.queue);
  if (state.settings?.roomId && statusText.textContent === "连接中...") {
    statusText.textContent = `Bilibili 房间 ${state.settings.roomId} 同步中`;
  }
  if (state.settings?.roomId && roomIdInput && !roomIdInput.value) {
    roomIdInput.value = state.settings.roomId;
  }
});
socket.on("appearance:state", (state) => {
  if (Date.now() < localEditUntil) return;
  fillAppearanceControls(state);
});
socket.on("bilibili:status", renderBilibiliStatus);
socket.on("danmaku", (danmaku) => addEvent(`${danmaku.user.name}: ${danmaku.text}`));
socket.on("request:received", (request) => addEvent(`收到点歌：${request.user.name} / ${request.keyword}`, "ok"));
socket.on("request:accepted", (item) => addEvent(`已加入：${item.name} - ${item.artists}`, "ok"));
socket.on("request:rejected", (event) => addEvent(`已拒绝：${event.user?.name || "观众"} / ${event.reason}`, "bad"));
socket.on("log", (event) => addEvent(event.message, event.level === "error" ? "bad" : "info"));

document.documentElement.style.setProperty("--dashboard-wallpaper", 'url("/pic/fu.png")');
populateFontSelects();
loadRoomConfig();
loadAppearance();
refreshNcmLoginStatus();
