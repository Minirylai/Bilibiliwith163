# Bilibiliwith163 工作记录

更新时间：2026-05-25

本文记录已完成工作、关键决策、验证结果和剩余边界。当前推进以 `README.md`、`TODO.md`、`ARCHITECTURE.md` 和本文为准。

## 2026-05-25 文档体系重构、本地 Git 初始化与外观圆角

任务 ID：DOCS-GIT-RADIUS-20260525

目标：

- 参照 Q-Limit 文档结构重构本项目 `docs/`。
- 将旧 `OPTIMIZATION.md` 迁移为当前 `TODO.md` 和历史参考。
- 初始化本地 Git，建立首次恢复点。
- 实现播放器、候选框、播报栏圆角实时修改。

范围：

- 文档：`docs/README.md`、`docs/TODO.md`、`docs/ARCHITECTURE.md`、`docs/WORK_HISTORY.md`、`docs/history/`。
- 配置：`.env.example` 清理真实 Cookie 示例。
- 外观：`src/appearance.js`、`public/dashboard.html`、`public/dashboard.js`、`public/app.js`、`public/style.css`。

关键决策：

- `docs/OPTIMIZATION.md` 不再作为当前维护入口，迁移到 `docs/history/OPTIMIZATION-2026-05-25.md`。
- 当前 TODO 使用 P0/P1/P2 和 C1/C2/C3 排序，优先推进样式冗余、队列内存、点歌语义和前端重复工具。
- `.env.example` 中真实 B 站 Cookie 示例已替换为空占位，防止 Git 首次提交写入凭据历史。
- 圆角配置纳入现有外观保存机制，新增字段由服务端归一化，控制台预览和 OBS 源通过 CSS 变量实时同步。

验证结果：

- `node --check` 已覆盖 `src/`、`public/`、`scripts/`、`test/` 下所有 JS 文件，结果通过。
- `git diff --cached --check` 在首次提交前通过。
- 已创建首次备份提交：`f82a12d chore: initialize local git baseline`。
- 已用 `PORT=3890` 启动本地服务，并验证 `GET /dashboard.html` 与 `GET /api/appearance` 返回 200；`/api/appearance` 已包含 `playerRadius`、`queueRadius`、`statusRadius`。
- 本轮未运行 `npm test`，因为该命令会访问网易云和 B 站外部接口，当前变更主要是文档、配置模板和前端/外观本地语法层改动。

剩余边界：

- 样式重复覆盖、共享外观 schema、壁纸/控制台设置收敛、前端工具函数抽取等维护项已写入 `TODO.md`，本轮不一次性重构。

## 2026-05-25 T02 队列内存状态上限

任务 ID：T02

目标：

- 为 `queue.history` 增加最大保留条数，避免长时间直播后历史数组无界增长。
- 为 `lastRequestByUser` 增加 TTL 清理，避免用户冷却 Map 在长时间运行中持续增长。

范围：

- `src/config.js`
- `src/queue.js`
- `.env.example`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`

预计修改文件：

- `src/config.js` 新增历史上限和冷却 TTL 环境配置。
- `src/queue.js` 在写入历史和检查冷却时做清理。
- 文档同步配置项和 TODO 状态。

风险点：

- 不能改变现有 `publicState()` 对前端返回最近 20 条历史的兼容行为。
- 冷却 TTL 不能小于 `MIN_REQUEST_INTERVAL_MS`，否则会绕过冷却。

验收标准：

- 历史记录有最大保留条数。
- 冷却 Map 会清理过期用户。
- 对外队列状态结构保持兼容。

当前 Git 状态：

- 开始前工作区干净，HEAD 为 `11ff621 docs: record verification notes`。
- 已创建本地备份 tag：`backup-before-t02-20260525`。

实际修改文件：

- `src/config.js`
- `src/queue.js`
- `.env.example`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/WORK_HISTORY.md`

关键决策：

- 新增 `MAX_HISTORY_ITEMS`，默认 `100`，用于限制内存中的完整历史数组；`publicState()` 仍只返回最近 20 条，保持前端兼容。
- 新增 `USER_COOLDOWN_TTL_MS`，默认 `3600000`，并在配置层保证实际值不小于 `MIN_REQUEST_INTERVAL_MS`。
- `queue.js` 统一通过 `recordHistory()` 写入历史，避免 `nextSong()` 和 `resetPlayback()` 分别维护裁剪逻辑。
- `canUserRequest()` 在每次冷却检查前执行过期冷却记录清理，不增加后台定时器。

验证命令和结果：

- `node --check src\config.js; node --check src\queue.js; node --check src\server.js`：通过。
- 本地 Node 行为脚本：验证 `MAX_HISTORY_ITEMS=2` 时历史只保留最近 2 条，并验证 `USER_COOLDOWN_TTL_MS` 不小于 `MIN_REQUEST_INTERVAL_MS`：通过。
- `git diff --check`：待提交前执行。
- 未运行 `npm test`，因为该命令会访问网易云和 B 站外部接口；本轮改动已用本地语法检查和本地行为脚本覆盖。

未完成边界：

- T03 仍需单独处理冷却扣减时机和队列上限语义。
- T14 后续应补正式单元测试，把本轮行为脚本沉淀进测试套件。

是否更新 TODO：是，T02 已从当前待办列表移除，并写入已实现能力。

是否更新 ARCHITECTURE：是，补充历史上限、冷却 TTL 和新增环境变量。

提交哈希：`0df3e6b fix: cap queue runtime state`

## 2026-05-25 T03/T04/T05 三项高优先级维护

任务 ID：T03、T04、T05

目标：

- T03：修复点歌冷却扣减时机，并明确 `MAX_QUEUE_SIZE` 队列上限语义。
- T04：抽取 OBS 源和控制台重复的前端工具函数。
- T05：共享正式 B 站连接模块和调试脚本中的 B 站基础解析辅助逻辑。

范围：

- `src/queue.js`
- `src/bilibili.js`
- `src/bilibiliHelpers.js`
- `scripts/watch-bilibili.js`
- `public/shared.js`
- `public/app.js`
- `public/dashboard.js`
- `public/index.html`
- `public/dashboard.html`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`

预计修改文件：

- 后端队列模块拆分冷却检查和提交，并让队列上限明确按“总点歌池”计算。
- 新增前端共享脚本，迁移重复 HTML 转义、字体 CSS、颜色转换和数值兜底工具。
- 新增 B 站 helper，正式模块和调试脚本共用命令解析、弹幕提取、地址转换、Cookie 读取。

风险点：

- 冷却提交时机变化不能让失败请求进入冷却，也不能让成功请求绕过冷却。
- `MAX_QUEUE_SIZE` 语义变化会让当前播放歌曲计入总数，需要同步文档。
- 新增前端共享脚本必须先于页面业务脚本加载。
- B 站 helper 需要同时兼容 CommonJS 正式代码和调试脚本。

验收标准：

- 冷却只在歌曲准备入队后提交。
- `MAX_QUEUE_SIZE` 表示当前播放 + 候选队列总量。
- `public/app.js` 和 `public/dashboard.js` 不再各自维护重复的基础工具函数。
- `scripts/watch-bilibili.js` 和 `src/bilibili.js` 共用 B 站 helper。

当前 Git 状态：

- 开始前工作区干净，HEAD 为 `a0489f0 docs: record T02 completion commit`。
- 已创建本地备份 tag：`backup-before-t03-t04-t05-20260525`。

实际修改文件：

- `src/queue.js`
- `src/bilibili.js`
- `src/bilibiliHelpers.js`
- `scripts/watch-bilibili.js`
- `public/shared.js`
- `public/app.js`
- `public/dashboard.js`
- `public/index.html`
- `public/dashboard.html`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/WORK_HISTORY.md`

关键决策：

- `queue.canUserRequest()` 只做冷却检查，不再写入冷却时间。
- 新增 `queue.commitUserRequest()`，只在歌曲成功入队后提交用户冷却。
- `queue.addSong()` 使用当前播放加候选队列的总数判断 `MAX_QUEUE_SIZE`。
- `public/shared.js` 承载 OBS 源和控制台共用的 HTML 转义、字体、颜色和数值工具。
- `src/bilibiliHelpers.js` 承载正式连接和调试脚本共用的 B 站消息、地址和 Cookie 辅助解析。

验证命令和结果：

- `node --check src\server.js; node --check src\bilibili.js; node --check src\queue.js; node --check src\bilibiliHelpers.js; node --check scripts\watch-bilibili.js; node --check public\shared.js; node --check public\app.js; node --check public\dashboard.js`：通过。
- 本地 Node 行为脚本：验证 `MAX_QUEUE_SIZE=1` 时当前播放占用总点歌池，第二首会返回 `Queue is full`：通过。
- 本地 Node 行为脚本：验证 `canUserRequest()` 不提交冷却，`commitUserRequest()` 后才进入冷却：通过。
- `git diff --check`：待提交前执行。
- 未运行 `npm test`，因为该命令会访问网易云和 B 站外部接口；本轮改动已用本地语法检查和本地行为脚本覆盖。

未完成边界：

- B 站切房失败回滚、自动重连、网易云并发限制和音频下载超时仍按 TODO 后续任务推进。
- 前端共享工具仍是无构建静态脚本，长期拆分构建流程仍保留为 T13。

是否更新 TODO：是，T03/T04/T05 已从当前待办列表移除，并补入已实现能力。

是否更新 ARCHITECTURE：是，补充共享前端工具、B 站 helper、冷却提交时机和队列上限语义。

提交哈希：`c9fd292 refactor: share request helpers`

## 2026-05-30 T16 开源前基线收口

任务 ID：T16

目标：

- 收口当前未提交的 T03/T04/T05 改动。
- 在继续凭据检查、README 重写和 GitHub 上传前建立清晰的本地 Git 基线。

范围：

- 前序 T03/T04/T05 代码与文档改动。
- `docs/TODO.md`
- `docs/WORK_HISTORY.md`

关键决策：

- 不回退前序改动；先验证并作为一个可恢复提交落库。
- T16 完成后从当前 TODO 推荐顺序中移除，后续从 T17 开始推进。

验证命令和结果：

- 同 T03/T04/T05 验证结果。
- `git diff --check`：待提交前执行。

提交哈希：`c9fd292 refactor: share request helpers`

## 2026-05-30 GitHub 开源前规划

任务 ID：OPEN-SOURCE-PLAN-20260530

目标：

- 将“先上传 GitHub”的目标拆成可执行 TODO。
- 明确开源前必须完成根目录 `README.md` 重写。
- 把“拥有 3 种以上相互独立功能”和“可被第三方程序引用或可编译为可执行软件”纳入验收口径。
- 继续沿用本地 Git 仓库作为恢复点，上传前先确保提交边界和凭据安全。

范围：

- `docs/TODO.md`
- `docs/WORK_HISTORY.md`
- 只做规划，不修改业务代码。

当前 Git 状态：

- 本轮开始时工作区已有未提交改动：`docs/ARCHITECTURE.md`、`docs/TODO.md`、`docs/WORK_HISTORY.md`、`public/app.js`、`public/dashboard.html`、`public/dashboard.js`、`public/index.html`、`scripts/watch-bilibili.js`、`src/bilibili.js`、`src/queue.js`，以及未跟踪的 `public/shared.js`、`src/bilibiliHelpers.js`。
- 这些改动属于前序 T03/T04/T05 工作，本轮不回退、不覆盖，只在 TODO 中补充先收口提交的要求。

关键决策：

- 新增 T16-T21：先收口当前未提交改动，再做凭据/仓库清洁检查、开源 README、第三方引用入口、GitHub 首推和可执行打包调研。
- “第三方程序引用或可编译为可执行软件”近期优先选择第三方引用入口，因为当前 Node.js 服务新增无副作用 `main`/导出 API 的风险低于引入可执行打包链路。
- 当前项目已经具备超过 3 种独立功能，但开源前必须在 `README.md` 中清晰列出并给出入口说明。

验证命令和结果：

- 已读取 `docs/TODO.md`、`docs/ARCHITECTURE.md`、`docs/WORK_HISTORY.md`、`package.json`。
- 已执行 `git status --short` 和 `git log --oneline -5`，确认当前 HEAD 为 `a0489f0 docs: record T02 completion commit`，且工作区不是干净状态。
- 本轮只改文档规划，未运行代码测试。

未完成边界：

- 尚未提交本轮文档改动，因为工作区已有前序未提交代码改动，后续应先按 T16 验证并建立清晰提交。
- 尚未创建 GitHub remote，也未推送仓库；需等 T17 凭据检查和 T18 README 完成后执行。

是否更新 TODO：是，新增开源目标、发布门槛和 T16-T21。

是否更新 ARCHITECTURE：否，本轮未改变代码架构。

提交哈希：待 T16 或单独文档提交完成后补充。

## 2026-05-30 T17 GitHub 上传前凭据和仓库清洁检查

任务 ID：T17

目标：

- 确认公开上传前当前跟踪文件和 Git 历史中没有真实 Cookie 形态的凭据。
- 确认 `.env`、`.cache/`、日志和 `node_modules/` 没有进入 Git 跟踪。
- 记录当前 GitHub remote 状态。

范围：

- `.gitignore`
- `.env.example`
- Git 跟踪文件列表
- Git 历史
- `docs/TODO.md`
- `docs/WORK_HISTORY.md`

验证命令和结果：

- `git status --short`：T17 开始前工作区干净。
- `git ls-files .env .cache node_modules "*.log" ".*.log"`：无输出，说明这些路径未被跟踪。
- `git remote -v`：无输出，当前尚未配置 GitHub remote。
- 读取 `.env.example`：只包含空占位配置，未发现真实 Cookie。
- 当前跟踪文件凭据形态扫描：`current_secret_like_hits=0`。
- Git 历史凭据形态扫描：`history_secret_like_hits=0`。
- 当前跟踪文件通用 token 形态扫描：`current_generic_token_hits=0`。
- `.env` 历史提交检查：`env_history_commits=0`。

关键决策：

- 当前没有发现需要重写 Git 历史的凭据问题。
- T17 完成后从当前 TODO 推荐顺序中移除，后续先推进 T18 和 T19。

未完成边界：

- 尚未配置 GitHub remote；该动作留给 T20。
- 尚未新增 CI 或 Release 检查清单；当前 TODO 仍保留相关缺口。

是否更新 TODO：是，T17 已从当前待办列表移除，并补入已实现能力。

是否更新 ARCHITECTURE：否，本轮未改变架构。

提交哈希：`1dd09ab docs: record github safety scan`

## 2026-05-30 T18 根目录开源 README 重写

任务 ID：T18

目标：

- 将根目录 `README.md` 从本地使用说明升级为 GitHub 开源入口。
- 明确展示项目已经具备 3 种以上相互独立功能。
- 补齐安装、启动、OBS 接入、配置、接口、安全提示和文档索引。

范围：

- `README.md`
- `docs/TODO.md`
- `docs/WORK_HISTORY.md`

关键决策：

- README 使用中文作为主文档语言，保持与项目现有文档一致。
- 第三方引用入口在 T19 实现前先标明边界，避免误导用户直接 `require()` 旧服务入口。
- README 明确说明项目不会绕过平台权限、会员限制或版权限制。

验证命令和结果：

- `Get-Content -LiteralPath README.md -Encoding UTF8`：确认 README 可用显式 UTF-8 正常读取。
- `git diff --check`：通过。

未完成边界：

- T19 完成后需要把 README 的“第三方引用”章节从计划说明改成真实导入示例。

是否更新 TODO：是，T18 已从当前待办列表移除，并补入已实现能力。

是否更新 ARCHITECTURE：否，本轮未改变架构。

提交哈希：`1a8caf6 docs: rewrite open source readme`

## 2026-05-30 T19 第三方引用入口

任务 ID：T19

目标：

- 让第三方程序可以安全 `require("bilibiliwith163")`。
- 避免包根入口导入时启动 HTTP 服务或连接 B 站。
- 在 README 中提供最小导入示例。

范围：

- `package.json`
- `src/index.js`
- `README.md`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/WORK_HISTORY.md`

关键决策：

- `package.json` 的 `main` 改为 `src/index.js`，`npm start` 仍显式执行 `node src/server.js`。
- 包根入口只导出无服务启动副作用的点歌解析和 B 站消息辅助函数。
- 暂不重构 `src/server.js` 为 `createServer()`，避免在开源前引入更大服务生命周期改动。

对外导出：

- `parseSongRequest`
- `getBaseCommand`
- `danmakuFromMessage`
- `hostToAddress`
- `cookieValue`
- `clientBuvid`
- `bilibiliHelpers`

验证命令和结果：

- `node --check src\index.js; node --check src\songRequestParser.js; node --check src\bilibiliHelpers.js; node --check src\server.js`：通过。
- `node -e "const lib = require('./'); ..."`：通过，输出导出键 `bilibiliHelpers,clientBuvid,cookieValue,danmakuFromMessage,getBaseCommand,hostToAddress,parseSongRequest`，并验证 `parseSongRequest()` 可解析点歌文本。
- `git diff --check`：通过。

未完成边界：

- 可执行软件打包仍留给 T21。
- 如果后续需要外部嵌入完整 HTTP 服务，应另行拆 `src/server.js` 的 `createServer()` 工厂。

是否更新 TODO：是，T19 已从当前待办列表移除，并补入已实现能力。

是否更新 ARCHITECTURE：是，新增第三方引用入口说明。

提交哈希：`c2119c0 feat: add library entrypoint`

## 2026-05-30 T20 GitHub 仓库创建和首推尝试

任务 ID：T20

目标：

- 创建 GitHub 仓库并推送当前 `main` 分支。

范围：

- 本地 Git remote 状态
- GitHub CLI / token 状态

验证命令和结果：

- `git status --short`：T20 开始前工作区干净。
- `gh --version`：失败，本机未安装 GitHub CLI。
- `gh auth status`：失败，本机未安装 GitHub CLI。
- `git remote -v`：无输出，当前未配置 remote。
- 环境变量检查：`GITHUB_TOKEN_MISSING`、`GH_TOKEN_MISSING`。
- `git branch --show-current`：当前分支为 `main`。

结果：

- T20 未完成。当前缺少可用于创建 GitHub 仓库的本地工具或凭据，也没有用户提供的 remote URL。

未完成边界：

- 需要安装并登录 GitHub CLI，或由用户先创建 GitHub 仓库并提供 remote URL。
- remote 配置完成后再执行 `git push -u origin main`。

是否更新 TODO：是，记录阻塞原因，T20 保留在当前待办列表。

是否更新 ARCHITECTURE：否，本轮未改变架构。

提交哈希：无，T20 未完成。

## 2026-05-30 T20 GitHub remote 配置与首次推送完成

任务 ID：T20

目标：

- 使用用户提供的 GitHub 仓库 `https://github.com/Minirylai/Bilibiliwith163` 配置远端并推送 `main`。

范围：

- 本地 Git remote 配置
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/WORK_HISTORY.md`

验证命令和结果：

- `git status --short`：推送前工作区干净。
- `git remote -v`：推送前无 remote。
- `git branch --show-current`：`main`。
- `git remote add origin https://github.com/Minirylai/Bilibiliwith163.git`：成功。
- `git push -u origin main`：成功，`main` 已跟踪 `origin/main`。

关键决策：

- 使用用户已创建的空仓库，不再依赖 GitHub CLI。
- 推送完成后同步更新 TODO 和架构文档中的 remote 状态。

未完成边界：

- 尚未配置 GitHub Actions CI 和 Release 检查清单；保留为后续维护项。
- T21 的 exe 产物验证仍受本机缺少 `patch` 命令限制。

是否更新 TODO：是，T20 已从当前待办列表移除，并补入已实现能力。

是否更新 ARCHITECTURE：是，remote 从 `none` 更新为 GitHub origin。

提交哈希：待提交后补充。

## 2026-05-30 T21 可执行软件打包调研与配置

任务 ID：T21

目标：

- 选择可执行打包路线。
- 加入打包脚本、资源配置和 exe 运行时路径适配。
- 尝试生成 Windows x64 可执行文件。

范围：

- `.gitignore`
- `package.json`
- `package-lock.json`
- `README.md`
- `src/runtimePaths.js`
- `src/config.js`
- `src/server.js`
- `src/ncmAuth.js`
- `src/appearance.js`
- `src/dashboardSettings.js`
- `src/audioCache.js`
- `docs/TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/WORK_HISTORY.md`

关键决策：

- 使用 `@yao-pkg/pkg` 作为打包工具；`pkg` 当前版本为 `5.8.1`，`@yao-pkg/pkg` 当前版本为 `6.20.0`。
- 新增 `runtimePaths`，源码运行时使用项目根目录；pkg 打包运行时使用 exe 所在目录作为 `.env` 和 `.cache` 的写入位置。
- `public/` 和 `pic/` 优先读取 exe 同级外部目录；不存在时读取打包内置资源。
- `dist/` 加入 `.gitignore`，不提交 exe 产物。

验证命令和结果：

- `npm view pkg version deprecated description`：返回 `5.8.1`。
- `npm view @yao-pkg/pkg version deprecated description`：返回 `6.20.0`。
- `npm install --save-dev @yao-pkg/pkg@^6.20.0`：完成，初始提示 3 个 moderate 漏洞。
- `npm audit fix`：完成，锁文件兼容升级后移除 2 个包并更新 2 个包。
- `npm audit --omit=dev`：通过，`found 0 vulnerabilities`。
- `npm audit`：通过，`found 0 vulnerabilities`。
- `node --check src\runtimePaths.js; node --check src\config.js; node --check src\server.js; node --check src\ncmAuth.js; node --check src\appearance.js; node --check src\dashboardSettings.js; node --check src\audioCache.js`：通过。
- `node -e "const paths=require('./src/runtimePaths'); ..."`：通过，确认 `publicDir`、`picDir` 和 `envPath` 基础解析可用。
- `git diff --check`：通过。
- `npm run build:exe`：失败。首次因为 GitHub 下载预编译基础镜像证书校验失败，回退源码构建后缺少 `patch`。
- `$env:NODE_OPTIONS='--use-system-ca'; npm run build:exe`：证书问题解决，但远端没有 `node18.20.8-win-x64` 缓存，回退源码构建后仍缺少 `patch`。
- 尝试 `node20-win-x64` 和 `node24-win-x64`：未能在当前环境中生成 exe；超时后的残留 pkg 构建进程已停止。
- `Get-Command patch` 和常见 Git for Windows `patch.exe` 路径检查：未找到 `patch`。

未完成边界：

- 当前机器未生成 `dist/bilibiliwith163.exe`，因此未完成 exe 启动验证。
- 需要安装 `patch` 和必要编译工具，或在能下载 `@yao-pkg/pkg` 预编译基础镜像的环境中再次执行 `npm run build:exe`。
- 打包工具链虽然已配置，但 exe 产物生成仍需在满足 `pkg` 基础镜像下载或本地源码构建依赖的环境中完成。

是否更新 TODO：是，T21 改写为“完成可执行软件打包产物验证”，保留在待办列表。

是否更新 ARCHITECTURE：是，新增运行路径和 exe 打包说明。

提交哈希：`c852f30 build: add executable packaging setup`
