const fs = require("fs");
const path = require("path");
const paths = require("./runtimePaths");

const storePath = paths.dashboardSettingsPath;
const defaults = {
  wallpaper: "/pic/fu.png",
};

function normalize(input = {}) {
  return {
    wallpaper:
      typeof input.wallpaper === "string" && input.wallpaper.trim()
        ? input.wallpaper.trim()
        : defaults.wallpaper,
  };
}

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function loadDashboardSettings() {
  try {
    if (!fs.existsSync(storePath)) return normalize(defaults);
    return normalize(JSON.parse(fs.readFileSync(storePath, "utf8")));
  } catch {
    return normalize(defaults);
  }
}

function saveDashboardSettings(input) {
  const settings = normalize({
    ...loadDashboardSettings(),
    ...input,
  });
  ensureStoreDir();
  fs.writeFileSync(storePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

module.exports = {
  defaults,
  loadDashboardSettings,
  saveDashboardSettings,
};
