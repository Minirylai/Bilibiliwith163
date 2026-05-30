# Bilibiliwith163 待完成目标文档

更新时间：2026-05-30

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
- 队列历史已有最大保留条数，用户冷却记录已有 TTL 清理。
- 点歌冷却只在成功入队后提交，`MAX_QUEUE_SIZE` 已明确为当前播放 + 候选队列总量。
- OBS 源和控制台已共用 `public/shared.js` 的基础前端工具函数。
- 正式 B 站连接模块和调试脚本已共用 `src/bilibiliHelpers.js`。
- 已初始化本地 Git 仓库，首次备份提交 `f82a12d chore: initialize local git baseline` 已作为恢复基线记录到架构文档。
- 项目已经具备 3 种以上相互独立的功能：弹幕监听、点歌解析、网易云搜索/登录/播放地址解析、队列控制、音频缓存代理、OBS 浏览器源、Web 控制台、外观编辑。

### 1.2 关键缺口

- 根目录 `README.md` 仍偏本地使用说明，正式开源前需要改写为面向第三方的项目介绍、功能清单、安装运行、配置、安全提示、接口/引用方式和贡献说明。
- `package.json` 的 `main` 仍指向 `src/server.js`，作为第三方程序引用时会有启动服务的副作用；需要新增无副作用的库入口，或补可执行软件打包流程。
- 当前仓库没有 GitHub remote、CI、发布前凭据/历史扫描记录和 Release 检查清单。
- 样式文件存在多段最终覆盖块，继续维护时容易堆叠冲突。
- 外观配置 schema 在服务端和两个前端脚本中重复。
- 控制台设置和壁纸接口仍保留，但主流程没有完整 UI。
- 手动点歌 API 已存在，但控制台没有入口。
- B 站连接没有自动重连，切房失败后的状态回滚仍不完整。

## 2. 开源目标和发布门槛

本轮新增的近期目标是先把项目整理到可以上传 GitHub 的状态，同时满足两个对外展示/交付要求：

- 要求一：拥有 3 种以上相互独立的功能。当前代码已满足，但需要在根目录 `README.md` 中明确列出并用运行入口或接口说明支撑。
- 要求二：能够被第三方程序引用或可编译为可执行软件。近期优先选择“可被第三方程序引用”，因为当前项目是 Node.js 服务，新增无副作用库入口比引入打包器风险更低；可执行打包作为后续增强。

GitHub 上传前最低门槛：

- 工作区干净，所有已完成任务都有独立提交。
- `.env`、`.cache/`、日志、`node_modules/` 和真实 Cookie 不进入 Git。
- `README.md` 面向开源用户可独立理解项目用途、功能、安装、启动、配置、OBS 接入、安全边界和第三方引用方式。
- `package.json` 提供无副作用引用入口，第三方程序可以导入解析、队列或服务创建能力，而不是一导入就启动服务。
- 至少通过 `git diff --check` 和本地 `node --check`；外网冒烟测试如无法运行，需要在 `WORK_HISTORY.md` 记录原因。

## 3. 推荐近期执行顺序

| 顺位 | ID | 优先级 | 复杂度 | 目标 | 排序原因 |
| --- | --- | --- | --- | --- | --- |
| 1 | T17 | P0 | C1 | GitHub 上传前凭据和仓库清洁检查 | 防止 `.env`、Cookie、缓存、日志或历史敏感信息进入公开仓库 |
| 2 | T18 | P0 | C2 | 重写根目录开源版 `README.md` | 正式开源前必须让第三方能独立理解、安装、运行和评估功能 |
| 3 | T19 | P0 | C2 | 增加第三方引用入口 | 满足“能够被第三方程序引用”的交付要求，避免 `require()` 直接启动服务 |
| 4 | T20 | P0 | C1 | 创建 GitHub 仓库并推送首个公开分支 | 上传动作需要在前置安全检查和 README 完成后执行 |
| 5 | T01 | P0 | C1 | 清理 `public/style.css` 多段最终覆盖 | 直接影响后续 UI 可维护性和样式定位成本 |
| 6 | T06 | P1 | C2 | 提取前后端共享外观 schema | 新增外观字段需要同步三处，已出现维护成本 |
| 7 | T07 | P1 | C2 | 明确并收敛壁纸/控制台设置能力 | 当前接口保留但主流程未使用，容易误导后续开发 |
| 8 | T08 | P1 | C2 | 增加控制台手动点歌入口 | 服务端已有 API，补 UI 能提升主播控制效率 |
| 9 | T09 | P1 | C2 | B 站切房失败回滚与自动重连 | 提升直播稳定性，但涉及连接状态和 session 管理 |
| 10 | T10 | P1 | C2 | 网易云解析增加短期缓存和并发限制 | 降低弹幕峰值时外部 API 压力 |
| 11 | T11 | P1 | C2 | 音频下载增加超时、取消和 `.tmp` 清理 | 降低缓存异常导致的播放失败排查成本 |
| 12 | T21 | P1 | C2 | 可执行软件打包调研与可选实现 | 如果后续更倾向“可编译为可执行软件”，再引入 pkg/nexe/electron 等方案 |
| 13 | T12 | P2 | C2 | 处理 OBS 源错过 `player:play` 的同步问题 | 重连/刷新边界问题，完成后提升容错 |
| 14 | T13 | P2 | C3 | 用构建流程分离静态资源 | 长期方向，需先稳定前端模块边界 |
| 15 | T14 | P2 | C2 | 补充不依赖外网的单元/集成测试 | 核心行为稳定后逐步补测试护栏 |
| 16 | T15 | P2 | C2 | 增加音频缓存持久化索引 | 服务重启后复用缓存，但当前不是主链路阻塞 |

## 4. 任务拆解

### T17 P0/C1：GitHub 上传前凭据和仓库清洁检查

当前问题：

- 项目依赖 `.env` 中的 B 站 Cookie 和网易云 Cookie，公开仓库前必须确认工作区和提交历史没有真实凭据。
- 运行产物 `.cache/`、日志、`node_modules/` 不应进入 Git。

建议入口：

- `.gitignore`
- `.gitattributes`
- `.env.example`
- `README.md`
- `docs/ARCHITECTURE.md`
- Git 历史和当前暂存区

验收标准：

- `git status --short` 不包含 `.env`、`.cache/`、日志、`node_modules/`。
- 使用文本搜索确认仓库跟踪文件没有 `SESSDATA`、`bili_jct`、`DedeUserID`、`MUSIC_U` 等真实 Cookie 片段。
- `.env.example` 只保留占位值。
- 如发现历史凭据，先停止上传，单独制定历史清理方案。

### T18 P0/C2：重写根目录开源版 `README.md`

当前问题：

- 当前 `README.md` 能说明本地使用，但还没有形成面向 GitHub 访客的完整开源入口。
- “3 种以上相互独立的功能”和“第三方引用/可执行交付”需要在 README 中清晰呈现。

建议入口：

- `README.md`
- `.env.example`
- `package.json`
- `docs/README.md`
- `docs/ARCHITECTURE.md`

验收标准：

- README 首屏说明项目是什么、适用场景和安全边界。
- 明确列出至少 3 种独立功能，建议列出：B 站弹幕监听、网易云点歌解析、OBS 播放源、Web 控制台、音频缓存、外观编辑。
- 提供安装、配置、启动、OBS/直播姬接入、控制台使用、常见问题和安全提示。
- 说明第三方程序引用方式；若 T19 尚未完成，README 先标注为“计划中”，不能误导用户。
- 链接到 `docs/` 中的架构、TODO 和工作记录。

### T19 P0/C2：增加第三方引用入口

当前问题：

- `package.json` 的 `main` 指向 `src/server.js`，第三方程序导入包时可能直接启动服务，不适合作为库。
- 当前可复用能力分散在内部模块中，没有稳定对外 API。

建议入口：

- `package.json`
- 新增 `src/index.js`
- 可选新增 `src/createServer.js` 或重构 `src/server.js`
- `src/songRequestParser.js`
- `src/queue.js`
- `src/bilibiliHelpers.js`
- `README.md`

验收标准：

- `require("bilibiliwith163")` 不会自动启动 HTTP 服务或连接 B 站。
- 对外导出稳定、低副作用的能力，例如点歌文本解析、队列创建/操作、B 站消息辅助解析、服务创建函数。
- `npm start` 仍能保持原启动行为。
- README 提供最小第三方引用示例。
- 增加本地 `node --check` 或小型导入验证，确认第三方引用入口可用。

### T20 P0/C1：创建 GitHub 仓库并推送首个公开分支

当前问题：

- 架构文档记录当前 `remote: none`，尚未配置 GitHub 远端。
- 公开推送前需要明确分支、远端 URL、提交边界和首次发布说明。

建议入口：

- 本地 Git 配置
- GitHub 仓库设置
- `README.md`
- `LICENSE`
- `.gitignore`

验收标准：

- GitHub 仓库创建完成，并配置 `origin`。
- 推送前 `git status --short` 干净。
- 首次推送分支建议为 `main`；如需要保护主分支，可先推送 `codex/open-source-prep` 并创建 PR。
- GitHub 页面显示 README 正常，未展示凭据或本地路径敏感信息。

### T21 P1/C2：可执行软件打包调研与可选实现

当前问题：

- 如果后续需要满足“可编译为可执行软件”而不是“可被第三方程序引用”，需要选择合适的打包方式。
- 项目包含静态资源、`pic/`、`.env`、音频缓存目录和动态网络依赖，直接打包为单文件可执行有额外资源路径风险。

建议入口：

- `package.json`
- `src/server.js`
- `public/`
- `pic/`
- `.env.example`
- `README.md`

验收标准：

- 明确选择打包路线：`pkg`/`nexe` 单可执行、或 Electron/Tauri 桌面壳、或仅发布 npm CLI。
- 如果实现打包，生成 Windows 可运行产物，并验证能读取外部 `.env`、加载 `public/` 和 `pic/` 静态资源。
- README 说明源码运行和可执行运行的差异。

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

## 5. 每个 TODO 的执行模板

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
