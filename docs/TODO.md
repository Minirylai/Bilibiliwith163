# Bilibiliwith163 待完成目标文档

更新时间：2026-05-25

本文是后续自动化 TODO 的执行入口。旧 `OPTIMIZATION.md` 已迁移到 `docs/history/OPTIMIZATION-2026-05-25.md`，当前推进以本文为准。

## 0. 排序原则

优先级按“直播稳定性、凭据安全、主要体验、维护成本”和“实现复杂度”双轴排序。

优先级：

- P0：影响凭据安全、核心播放链路、直播稳定性或后续维护可靠性。
- P1：明显降低维护成本、提升主播控制效率或修复已知体验缺口。
- P2：增强型、长期能力或需要较大结构迁移的任务。

复杂度：

- C1：低复杂度。通常单模块或少量前后端适配，不新增构建系统。
- C2：中复杂度。跨 2-4 个模块，需要新增字段、协议或兼容迁移。
- C3：高复杂度。需要引入构建流程、大范围 CSS 拆分、持久化索引或外部 API 策略迁移。

推荐执行顺序：

```text
P0/C1 -> P0/C2 -> P1/C1 -> P1/C2 -> P2/C2 -> P2/C3
```

## 1. 当前能力快照

### 1.1 已实现能力

- B 站直播间弹幕连接与 `DANMU_MSG` 解析。
- 支持 `点歌`、`点播`、`网易云` 等可配置点歌指令。
- 网易云搜索、可用性检查、播放地址解析和二维码登录。
- 当前播放、候选队列、最近历史、跳过、清空、停止和移除候选歌曲。
- 本地音频缓存代理，支持 `/api/audio/:requestId` 和 HTTP Range。
- OBS / 直播姬浏览器源，支持当前歌曲、候选队列、进度条、暂停/继续、下一首和播报栏。
- 控制台支持切房、网易云登录、队列监控、弹幕日志和外观编辑。
- 外观配置支持尺寸、字体、颜色、毛玻璃透明度和模糊、播放器/候选框/播报栏底色。
- 本轮新增：播放器、候选框、播报栏圆角可在控制台实时修改并同步 OBS。
- 已初始化本地 Git 仓库，首次备份提交 `f82a12d chore: initialize local git baseline` 已作为恢复基线记录到架构文档。

### 1.2 关键缺口

- 样式文件存在多段最终覆盖块，继续维护时容易堆叠冲突。
- 外观配置 schema 在服务端和两个前端脚本中重复。
- 控制台设置和壁纸接口仍保留，但主流程没有完整 UI。
- 前端工具函数、B 站调试脚本辅助函数存在重复。
- 队列历史和用户冷却 Map 没有上限清理。
- 手动点歌 API 已存在，但控制台没有入口。
- B 站连接没有自动重连，切房失败后的状态回滚仍不完整。

## 2. 推荐近期执行顺序

| 顺位 | ID | 优先级 | 复杂度 | 目标 | 排序原因 |
| --- | --- | --- | --- | --- | --- |
| 1 | T01 | P0 | C1 | 清理 `public/style.css` 多段最终覆盖 | 直接影响后续 UI 可维护性和样式定位成本 |
| 2 | T02 | P0 | C1 | 为队列历史和用户冷却 Map 增加上限/TTL | 长时间直播稳定性风险，修改范围集中 |
| 3 | T03 | P1 | C1 | 修复点歌冷却扣减时机和队列上限语义 | 影响观众体验和配置理解，属于核心点歌链路 |
| 4 | T04 | P1 | C1 | 抽取前端通用工具函数 | 降低 `public/app.js` 与 `public/dashboard.js` 重复维护 |
| 5 | T05 | P1 | C1 | 共享 B 站解析辅助逻辑 | 降低调试脚本和正式模块协议适配不同步风险 |
| 6 | T06 | P1 | C2 | 提取前后端共享外观 schema | 新增外观字段需要同步三处，已出现维护成本 |
| 7 | T07 | P1 | C2 | 明确并收敛壁纸/控制台设置能力 | 当前接口保留但主流程未使用，容易误导后续开发 |
| 8 | T08 | P1 | C2 | 增加控制台手动点歌入口 | 服务端已有 API，补 UI 能提升主播控制效率 |
| 9 | T09 | P1 | C2 | B 站切房失败回滚与自动重连 | 提升直播稳定性，但涉及连接状态和 session 管理 |
| 10 | T10 | P1 | C2 | 网易云解析增加短期缓存和并发限制 | 降低弹幕峰值时外部 API 压力 |
| 11 | T11 | P1 | C2 | 音频下载增加超时、取消和 `.tmp` 清理 | 降低缓存异常导致的播放失败排查成本 |
| 12 | T12 | P2 | C2 | 处理 OBS 源错过 `player:play` 的同步问题 | 重连/刷新边界问题，完成后提升容错 |
| 13 | T13 | P2 | C3 | 用构建流程分离静态资源 | 长期方向，需先稳定前端模块边界 |
| 14 | T14 | P2 | C2 | 补充不依赖外网的单元/集成测试 | 核心行为稳定后逐步补测试护栏 |
| 15 | T15 | P2 | C2 | 增加音频缓存持久化索引 | 服务重启后复用缓存，但当前不是主链路阻塞 |

## 3. 任务拆解

### T01 P0/C1：清理 `public/style.css` 多段最终覆盖

当前问题：

- `public/style.css` 存在多段 `Final overrides` / `EOF override`。
- 样式依赖文件末尾覆盖，后续修改很难判断真实生效来源。

建议入口：

- `public/style.css`
- `public/index.html`
- `public/dashboard.html`

验收标准：

- 样式按 OBS 源、控制台、编辑器、覆盖修正分区整理。
- 删除重复或过期覆盖块。
- OBS 源和控制台主要界面视觉不回退。

### T02 P0/C1：限制队列历史和用户冷却 Map 增长

当前问题：

- `queue.history` 内存数组持续增长。
- `lastRequestByUser` 没有 TTL 清理。

建议入口：

- `src/queue.js`
- `src/config.js`
- `.env.example`
- `docs/ARCHITECTURE.md`

验收标准：

- 历史记录有最大保留条数。
- 冷却 Map 会定期清理过期用户。
- 对外 `publicState()` 行为保持兼容。

### T03 P1/C1：修复点歌冷却扣减时机和队列上限语义

当前问题：

- `handleDanmaku()` 在解析到指令后立刻调用 `canUserRequest()`，即使后续搜索失败也会进入冷却。
- `addSong()` 只检查候选队列长度，未把当前播放计入 `MAX_QUEUE_SIZE`。

建议入口：

- `src/bilibili.js`
- `src/queue.js`
- `docs/ARCHITECTURE.md`

验收标准：

- 冷却只在通过校验并准备入队后提交，或明确拆成检查与提交两步。
- `MAX_QUEUE_SIZE` 的含义在代码、文档和 UI 中一致。

### T04 P1/C1：抽取前端通用工具函数

当前问题：

- `public/app.js` 和 `public/dashboard.js` 重复实现 `escapeHtml`、字体 CSS 拼接、颜色转换、数值兜底和滚动测量。

建议入口：

- 新增 `public/shared.js` 或等待 T13 构建流程。
- `public/app.js`
- `public/dashboard.js`
- `public/index.html`
- `public/dashboard.html`

验收标准：

- 重复工具函数收敛到一个入口。
- 两个页面加载顺序明确，旧功能不变。

### T05 P1/C1：共享 B 站解析辅助逻辑

当前问题：

- `scripts/watch-bilibili.js` 与 `src/bilibili.js` 重复命令解析、地址转换和 Cookie 读取。

建议入口：

- 新增 `src/bilibiliHelpers.js`
- `src/bilibili.js`
- `scripts/watch-bilibili.js`

验收标准：

- 调试脚本和正式模块共用同一套基础解析。
- 协议适配只需改一个模块。

### T06 P1/C2：提取前后端共享外观 schema

当前问题：

- 外观默认值、范围和字段读取同时存在于 `src/appearance.js`、`public/dashboard.js` 和 `public/app.js`。

建议入口：

- `src/appearance.js`
- `public/dashboard.js`
- `public/app.js`
- 可选新增 `public/appearanceSchema.js` 或 `/api/appearance/schema`

验收标准：

- 新增外观字段不需要手动同步三份默认值。
- 服务端仍负责最终归一化和安全校验。

### T07 P1/C2：明确并收敛壁纸/控制台设置能力

当前问题：

- `src/dashboardSettings.js`、`GET /api/dashboard-settings`、`GET /api/wallpapers` 和禁用上传入口仍保留。
- 控制台主流程固定使用 `pic/fu.png`，没有完整壁纸选择 UI。

可选方案：

- 方案 A：补控制台壁纸选择 UI，真正使用现有接口。
- 方案 B：移除未使用接口和设置存储，只保留固定壁纸。

验收标准：

- 文档、代码和 UI 对壁纸能力的描述一致。
- 不再保留误导性的半成品入口。

### T08 P1/C2：增加控制台手动点歌入口

当前问题：

- `POST /api/request` 已存在，但控制台没有手动搜索/插入入口。

建议入口：

- `public/dashboard.html`
- `public/dashboard.js`
- `src/server.js`
- `src/ncmApi.js`

验收标准：

- 主播可以在控制台输入关键词并手动点歌。
- 搜索失败、重复、队列满等错误可见。
- 与弹幕点歌共用队列逻辑。

### T09 P1/C2：B 站切房失败回滚与自动重连

当前问题：

- `startBilibili()` 在连接成功前更新内存房间号。
- close/error 只更新状态，不自动重连。

建议入口：

- `src/server.js`
- `src/bilibili.js`
- `public/dashboard.js`

验收标准：

- 切房失败时内存状态和 `.env` 不分裂。
- 连接异常时有指数退避重连，并能在控制台展示状态。

### T10 P1/C2：网易云搜索与播放解析缓存/并发限制

当前问题：

- 每条有效点歌都会串行执行搜索、可用性检查和播放地址获取。

建议入口：

- `src/ncmApi.js`
- `src/bilibili.js`

验收标准：

- 相同 keyword / songId 有短期缓存。
- 同时解析任务有并发上限。
- 外部 API 抖动不拖垮主进程。

### T11 P1/C2：音频下载超时、取消和临时文件清理

当前问题：

- `audioCache.download()` 没有显式超时或取消控制。
- 下载失败时 `.tmp` 文件可能残留。

建议入口：

- `src/audioCache.js`
- `src/eventBus.js`
- `public/dashboard.js`

验收标准：

- 下载超时可控。
- 失败和中断会清理 `.tmp` 文件。
- 预热失败能在控制台看到可观测日志。

### T12 P2/C2：处理 OBS 源错过 `player:play` 的同步问题

当前问题：

- OBS 源重连、刷新或事件乱序时可能只显示当前歌曲而不播放。

建议入口：

- `public/app.js`

验收标准：

- `queue:state` 检测当前歌曲变化时能按状态补播放。
- 不重复 `load()` 当前音频。

### T13 P2/C3：用构建流程分离静态资源

当前问题：

- 前端目前直接加载单个 CSS 和手写 JS，继续扩展控制台会加重维护成本。

验收标准：

- CSS/JS 按 OBS 源、控制台和共享工具拆分。
- 输出带版本或 hash，避免 OBS 缓存误用旧资源。

### T14 P2/C2：补充不依赖外网的测试

建议覆盖：

- 弹幕文本解析。
- 队列去重、冷却、上限。
- 外观配置归一化。
- 音频缓存 Range 请求。
- 控制台保存/读取配置。
- `queue:state` 与 `player:play` 事件顺序。

### T15 P2/C2：增加音频缓存持久化索引

当前问题：

- 缓存注册表在内存中，服务重启后旧缓存文件仍在但旧 `requestId` 不再可播放。

验收标准：

- 启动时可恢复仍有效的缓存索引，或文档明确缓存只服务运行期。

## 4. 每个 TODO 的执行模板

开始前在 `WORK_HISTORY.md` 记录：

```text
任务 ID：
目标：
范围：
预计修改文件：
风险点：
验收标准：
当前 Git 状态：
```

完成后记录：

```text
任务 ID：
实际修改文件：
关键决策：
验证命令和结果：
未完成边界：
是否更新 TODO：
是否更新 ARCHITECTURE：
提交哈希：
```

当前最小验证命令：

```powershell
node --check src\server.js
node --check src\bilibili.js
node --check src\queue.js
node --check src\ncmApi.js
node --check src\ncmAuth.js
node --check src\audioCache.js
node --check src\appearance.js
node --check public\app.js
node --check public\dashboard.js
npm test
```

`npm test` 会访问外部网易云和 B 站接口；如果当前网络、凭据或直播间状态不稳定，可以先运行 `node --check` 作为本地语法护栏，并在记录里说明未跑外部冒烟测试的原因。
