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

提交哈希：待提交后补充。
