const fs = require("fs");
const path = require("path");
const bus = require("./eventBus");
const paths = require("./runtimePaths");

const storePath = paths.appearancePath;
const savedStorePath = paths.savedAppearancePath;

const defaults = {
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

const ranges = {
  widgetWidth: [360, 980],
  playerHeight: [100, 260],
  queueHeight: [90, 620],
  queueItemHeight: [34, 96],
  playerRadius: [0, 48],
  queueRadius: [0, 48],
  statusRadius: [0, 48],
  glassOpacity: [8, 72],
  glassBlur: [0, 40],
  titleFontSize: [18, 56],
  artistFontSize: [12, 34],
  requestFontSize: [12, 30],
  queueFontSize: [12, 34],
  statusHeight: [26, 90],
  statusFontSize: [11, 28],
};

const fontAllowList = new Set([
  "Microsoft YaHei",
  "Segoe UI",
  "Arial",
  "Bahnschrift",
  "Cambria",
  "Consolas",
  "KaiTi",
  "SimHei",
  "SimSun",
]);
const safeFontPattern = /^[\p{L}\p{N}\s._\-()&+,]+$/u;
const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;

function clampNumber(value, fallback, [min, max]) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function safeFont(value, fallback) {
  const source = String(value || "").trim();
  if (!source || source.length > 80) return fallback;
  if (fontAllowList.has(source)) return source;
  return safeFontPattern.test(source) ? source : fallback;
}

function safeHexColor(value, fallback) {
  const source = String(value || "").trim();
  if (!hexColorPattern.test(source)) return fallback;
  return `#${source.replace(/^#/, "").toLowerCase()}`;
}

function normalize(input = {}) {
  const next = { ...defaults };
  for (const [key, range] of Object.entries(ranges)) {
    next[key] = clampNumber(input[key], defaults[key], range);
  }

  next.titleFontFamily = safeFont(input.titleFontFamily, defaults.titleFontFamily);
  next.artistFontFamily = safeFont(input.artistFontFamily, defaults.artistFontFamily);
  next.requestFontFamily = safeFont(input.requestFontFamily, defaults.requestFontFamily);
  next.queueFontFamily = safeFont(input.queueFontFamily, defaults.queueFontFamily);
  next.statusFontFamily = safeFont(input.statusFontFamily, defaults.statusFontFamily);
  next.titleColor = safeHexColor(input.titleColor, defaults.titleColor);
  next.artistColor = safeHexColor(input.artistColor, defaults.artistColor);
  next.requestColor = safeHexColor(input.requestColor, defaults.requestColor);
  next.queueColor = safeHexColor(input.queueColor, defaults.queueColor);
  next.statusColor = safeHexColor(input.statusColor, defaults.statusColor);
  next.playerGlassColor = safeHexColor(input.playerGlassColor, defaults.playerGlassColor);
  next.queueGlassColor = safeHexColor(input.queueGlassColor, defaults.queueGlassColor);
  next.statusGlassColor = safeHexColor(input.statusGlassColor, defaults.statusGlassColor);
  return next;
}

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function loadAppearance() {
  try {
    if (!fs.existsSync(storePath)) return normalize(defaults);
    return normalize(JSON.parse(fs.readFileSync(storePath, "utf8")));
  } catch {
    return normalize(defaults);
  }
}

function saveAppearance(input) {
  const appearance = normalize({
    ...loadAppearance(),
    ...input,
  });
  ensureStoreDir();
  fs.writeFileSync(storePath, `${JSON.stringify(appearance, null, 2)}\n`, "utf8");
  bus.emit("appearance:state", appearance);
  return appearance;
}

function loadSavedAppearance() {
  try {
    if (!fs.existsSync(savedStorePath)) {
      return {
        exists: false,
        appearance: null,
      };
    }

    return {
      exists: true,
      appearance: normalize(JSON.parse(fs.readFileSync(savedStorePath, "utf8"))),
    };
  } catch {
    return {
      exists: false,
      appearance: null,
    };
  }
}

function saveAppearancePreset(input) {
  const appearance = normalize({
    ...loadAppearance(),
    ...input,
  });
  ensureStoreDir();
  fs.writeFileSync(savedStorePath, `${JSON.stringify(appearance, null, 2)}\n`, "utf8");
  return {
    exists: true,
    appearance,
  };
}

function applySavedAppearance() {
  const saved = loadSavedAppearance();
  if (!saved.exists || !saved.appearance) {
    throw new Error("No saved appearance preset");
  }
  return saveAppearance(saved.appearance);
}

module.exports = {
  defaults,
  applySavedAppearance,
  loadAppearance,
  loadSavedAppearance,
  saveAppearance,
  saveAppearancePreset,
};
