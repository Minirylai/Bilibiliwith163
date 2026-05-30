const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const runtimeRoot = process.pkg ? path.dirname(process.execPath) : projectRoot;

function readableDir(name) {
  const externalPath = path.join(runtimeRoot, name);
  if (fs.existsSync(externalPath)) return externalPath;
  return path.join(projectRoot, name);
}

function writablePath(...parts) {
  return path.join(runtimeRoot, ...parts);
}

module.exports = {
  audioCacheDir: writablePath(".cache", "audio"),
  cacheDir: writablePath(".cache"),
  dashboardSettingsPath: writablePath(".cache", "dashboard.json"),
  envPath: writablePath(".env"),
  picDir: readableDir("pic"),
  projectRoot,
  publicDir: readableDir("public"),
  runtimeRoot,
  appearancePath: writablePath(".cache", "appearance.json"),
  savedAppearancePath: writablePath(".cache", "appearance.saved.json"),
};
