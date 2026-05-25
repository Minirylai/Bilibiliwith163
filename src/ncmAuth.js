const fs = require("fs");
const path = require("path");
const ncm = require("@neteasecloudmusicapienhanced/api");
const config = require("./config");

const envPath = path.resolve(__dirname, "..", ".env");
const ignoredCookieAttributes = new Set([
  "domain",
  "expires",
  "httponly",
  "max-age",
  "path",
  "samesite",
  "secure",
]);

function sanitizeCookie(cookie) {
  const source = String(cookie || "").replace(/[\r\n]/g, "").trim();
  if (!source) return "";

  const values = new Map();
  for (const part of source.split(";")) {
    const item = part.trim();
    if (!item || !item.includes("=")) continue;

    const index = item.indexOf("=");
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (!key || ignoredCookieAttributes.has(key.toLowerCase())) continue;

    values.set(key, value);
  }

  return Array.from(values.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

let currentCookie = sanitizeCookie(process.env.NCM_COOKIE || process.env.NETEASE_COOKIE || "");

function setEnvValue(key, value) {
  let source = "";
  if (fs.existsSync(envPath)) {
    source = fs.readFileSync(envPath, "utf8");
  }

  const line = `${key}=${sanitizeCookie(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) {
    source = source.replace(pattern, line);
  } else {
    source = `${source.replace(/\s*$/, "")}\n${line}\n`;
  }

  fs.writeFileSync(envPath, source, "utf8");
}

function setCookie(cookie, { persist = false } = {}) {
  currentCookie = sanitizeCookie(cookie);
  process.env.NCM_COOKIE = currentCookie;
  process.env.NETEASE_COOKIE = currentCookie;
  if (persist) {
    setEnvValue("NCM_COOKIE", currentCookie);
  }
}

function clearCookie({ persist = false } = {}) {
  currentCookie = "";
  delete process.env.NCM_COOKIE;
  delete process.env.NETEASE_COOKIE;
  if (persist) {
    setEnvValue("NCM_COOKIE", "");
  }
}

function getCookie() {
  return currentCookie;
}

function publicProfile(body) {
  const data = body?.data || {};
  const profile = data.profile || null;
  const account = data.account || null;
  return {
    loggedIn: Boolean(profile || (account && !account.anonimousUser && account.id)),
    account: account
      ? {
          id: account.id,
          vipType: account.vipType,
        }
      : null,
    profile: profile
      ? {
          userId: profile.userId,
          nickname: profile.nickname,
          avatarUrl: profile.avatarUrl,
          vipType: profile.vipType,
        }
      : null,
  };
}

async function withTimeout(promise, label) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out`)), config.requestTimeoutMs);
  });
  return Promise.race([promise, timeout]);
}

async function createQrLogin() {
  const keyResponse = await withTimeout(ncm.login_qr_key({ cookie: getCookie() }), "Netease QR key");
  const key = keyResponse.body?.data?.unikey;
  if (!key) {
    throw new Error("Netease did not return a QR login key");
  }

  const qrResponse = await withTimeout(
    ncm.login_qr_create({
      key,
      qrimg: true,
      cookie: getCookie(),
    }),
    "Netease QR image",
  );

  return {
    key,
    qrurl: qrResponse.body?.data?.qrurl || "",
    qrimg: qrResponse.body?.data?.qrimg || "",
  };
}

async function checkQrLogin(key) {
  const response = await withTimeout(
    ncm.login_qr_check({
      key,
      cookie: getCookie(),
    }),
    "Netease QR check",
  );

  const body = response.body || {};
  if (body.code === 803 && body.cookie) {
    setCookie(body.cookie, { persist: true });
  }

  return {
    code: body.code || 0,
    message: body.message || "",
    loggedIn: body.code === 803,
    profile: body.code === 803 ? await loginStatus() : null,
  };
}

async function loginStatus() {
  if (!getCookie()) {
    return {
      loggedIn: false,
      account: null,
      profile: null,
    };
  }

  const response = await withTimeout(
    ncm.login_status({
      cookie: getCookie(),
    }),
    "Netease login status",
  );
  return publicProfile(response.body);
}

async function logout() {
  if (getCookie()) {
    await withTimeout(ncm.logout({ cookie: getCookie() }), "Netease logout").catch(() => null);
  }
  clearCookie({ persist: true });
  return loginStatus();
}

module.exports = {
  checkQrLogin,
  clearCookie,
  createQrLogin,
  getCookie,
  loginStatus,
  logout,
  setCookie,
};
