const path = require("path");

process.env.BILIBILIWITH163_RUNTIME_ROOT =
  process.env.BILIBILIWITH163_RUNTIME_ROOT || path.resolve(process.cwd());

require("../src/server");
