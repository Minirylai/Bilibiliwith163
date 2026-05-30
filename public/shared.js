(function attachSharedHelpers(window) {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function numberValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function cssFont(value) {
    return `"${String(value || "Microsoft YaHei").replace(/"/g, "")}", "Microsoft YaHei", "Segoe UI", sans-serif`;
  }

  function hexToRgb(hex, fallback) {
    const source = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : fallback;
    const value = source.slice(1);
    return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
  }

  function setPxVariable(style, name, value, fallback) {
    style.setProperty(name, `${numberValue(value, fallback)}px`);
  }

  window.BilibiliNcmShared = {
    cssFont,
    escapeHtml,
    hexToRgb,
    numberValue,
    setPxVariable,
  };
})(window);
