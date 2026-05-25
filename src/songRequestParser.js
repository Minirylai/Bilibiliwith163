const normalizeSpaces = (value) => String(value || "").replace(/\s+/g, " ").trim();

function parseSongRequest(text, commands) {
  const content = normalizeSpaces(text);
  if (!content) return null;

  for (const command of commands) {
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = content.match(new RegExp(`^${escaped}(?:\\s+|[:：,，])(.+)$`, "i"));
    if (match?.[1]) {
      return {
        command,
        keyword: normalizeSpaces(match[1]),
      };
    }
  }

  return null;
}

module.exports = {
  parseSongRequest,
};
