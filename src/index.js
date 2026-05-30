const { parseSongRequest } = require("./songRequestParser");
const bilibiliHelpers = require("./bilibiliHelpers");

module.exports = {
  bilibiliHelpers,
  parseSongRequest,
  ...bilibiliHelpers,
};
