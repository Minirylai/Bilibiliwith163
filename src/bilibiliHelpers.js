function getBaseCommand(data) {
  const command = data?.cmd || data?.msg?.cmd || "";
  return String(command).split(":")[0];
}

function danmakuFromMessage(data) {
  const info = data.info || [];
  return {
    text: info[1] || "",
    user: {
      uid: info[2]?.[0] || 0,
      name: info[2]?.[1] || "Anonymous",
    },
    raw: data,
  };
}

function hostToAddress(host) {
  if (!host?.host) return undefined;
  const port = host.wss_port || 443;
  return `wss://${host.host}:${port}/sub`;
}

function cookieValue(cookie, name) {
  return (
    String(cookie || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

function clientBuvid(cookies) {
  return cookies?.get("buvid3") || cookies?.get("buvid4") || cookies?.get("buvid_fp");
}

module.exports = {
  clientBuvid,
  cookieValue,
  danmakuFromMessage,
  getBaseCommand,
  hostToAddress,
};
