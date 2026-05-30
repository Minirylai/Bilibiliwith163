# Bilibiliwith163

Bilibiliwith163 是一个面向直播间的 B 站弹幕点歌服务。它监听指定 B 站直播间实时弹幕，识别观众点歌指令，通过网易云音乐接口搜索并解析可播放地址，再把播放器页面作为 OBS / 直播姬浏览器源使用。

项目使用 Node.js、Express、Socket.IO、`bilibili-live-danmaku` 和 `@neteasecloudmusicapienhanced/api`。它不会绕过平台权限、会员限制或版权限制，歌曲是否可播放取决于网易云接口返回和登录账号权限。

## 主要功能

项目已经包含多组相互独立的功能：

- B 站弹幕监听：连接指定直播间，接收并解析 `DANMU_MSG`。
- 弹幕点歌指令：支持 `点歌`、`点播`、`网易云` 等可配置指令。
- 网易云音乐解析：搜索歌曲、检查可播性、获取播放地址，并支持二维码登录。
- 播放队列：维护当前播放、候选队列、最近历史、重复检查、队列上限和用户冷却。
- 音频缓存代理：通过本地 `/api/audio/:requestId` 播放音频，支持 HTTP Range 和缓存清理。
- OBS / 直播姬浏览器源：展示当前歌曲、封面、点歌人、候选队列、进度条和播报栏。
- Web 控制台：支持切歌、清空队列、停止播放、切换房间、网易云登录、日志查看和外观编辑。
- 外观编辑：调整播放器尺寸、圆角、字体、颜色、毛玻璃透明度、模糊和区域底色。

## 运行要求

- Node.js 18 或更高版本
- npm
- 可访问 B 站直播和网易云音乐接口的网络环境
- OBS、直播姬或其他支持浏览器源的软件

## 安装

```powershell
npm install
copy .env.example .env
```

编辑 `.env`，至少确认：

```text
PORT=3888
BILI_ROOM_ID=你的直播间号
BILI_COOKIE=你的 B 站 Cookie
```

`BILI_COOKIE` 用于 B 站直播弹幕鉴权。网易云 Cookie 不需要手动准备，可以在控制台扫码登录；登录成功后服务会把 `NCM_COOKIE` 写入 `.env`。

## 启动

```powershell
npm start
```

启动后打开：

- OBS / 直播姬浏览器源：`http://localhost:3888/`
- 控制台：`http://localhost:3888/dashboard.html`

OBS 浏览器源建议启用透明背景，再按直播画面布局裁剪或缩放。

## 弹幕指令

默认支持：

```text
点歌 歌名
点播 歌名
网易云 歌名
```

也可以带歌手或更完整关键词：

```text
点歌 晴天 周杰伦
点歌 稻香 周杰伦
```

可通过 `.env` 修改指令列表：

```text
REQUEST_COMMANDS=点歌,点播,网易云
```

## 控制台

控制台入口是 `http://localhost:3888/dashboard.html`，常用操作包括：

- 打开 OBS 源
- 跳过当前歌曲
- 清空候选队列
- 停止当前播放并清空
- 切换追踪的 B 站直播间号
- 网易云二维码登录、刷新状态、退出登录
- 查看弹幕、请求和播放日志
- 编辑 OBS 点歌器外观
- 保存、读取和恢复外观配置

控制台固定读取 `pic/fu.png` 作为网页壁纸。播放器预览会优先尝试 `pic/miku.png`，不存在时回退到 `pic/miku.jpg`。

## 配置

常用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3888` | HTTP 服务端口 |
| `BILI_ROOM_ID` | `1` | B 站直播间号 |
| `BILI_COOKIE` | 空 | B 站 Cookie |
| `REQUEST_COMMANDS` | `点歌,点播,网易云` | 点歌指令前缀 |
| `MAX_QUEUE_SIZE` | `30` | 总点歌池上限，包含当前播放和候选队列 |
| `MAX_HISTORY_ITEMS` | `100` | 内存中最近播放历史最大保留条数 |
| `MIN_REQUEST_INTERVAL_MS` | `8000` | 同用户点歌冷却 |
| `USER_COOLDOWN_TTL_MS` | `3600000` | 用户冷却记录 TTL |
| `PLAYER_VOLUME` | `0.75` | 播放器音量 |
| `NCM_QUALITY` | `standard` | 网易云音质 |
| `NCM_COOKIE` | 空 | 网易云登录 Cookie |
| `ALLOW_DUPLICATES` | `false` | 是否允许重复歌曲 |
| `AUTOPLAY` | `true` | 是否自动播放 |
| `REQUEST_TIMEOUT_MS` | `12000` | 外部 API 超时 |
| `AUDIO_CACHE_MAX_MB` | `512` | 音频缓存大小上限 |
| `AUDIO_CACHE_MAX_FILES` | `120` | 音频缓存文件数上限 |

完整配置以 `.env.example` 和 `docs/ARCHITECTURE.md` 为准。

## HTTP 接口

常用接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/state` | 当前播放和队列状态 |
| `POST` | `/api/request` | 手动提交点歌请求 |
| `POST` | `/api/next` | 下一首 |
| `POST` | `/api/clear` | 清空候选队列 |
| `POST` | `/api/reset` | 停止并重置 |
| `GET` | `/api/search` | 搜索网易云歌曲 |
| `GET` | `/api/audio/:requestId` | 播放本地代理音频 |
| `GET` | `/api/cache` | 查看缓存统计 |
| `POST` | `/api/cache/cleanup` | 清理缓存 |
| `GET` | `/api/bilibili/room` | 查看当前房间 |
| `POST` | `/api/bilibili/room` | 切换房间 |
| `POST` | `/api/ncm/login/qr` | 创建网易云二维码登录 |

更多接口见 `docs/ARCHITECTURE.md`。

## 第三方引用

包根入口是无副作用的 CommonJS 模块，第三方程序可以安全导入解析工具；导入包不会启动 HTTP 服务，也不会连接 B 站。

```js
const { parseSongRequest, danmakuFromMessage } = require("bilibiliwith163");

const request = parseSongRequest("点歌 晴天 周杰伦", ["点歌", "点播", "网易云"]);
console.log(request);
// { command: "点歌", keyword: "晴天 周杰伦" }
```

可用导出：

- `parseSongRequest(text, commands)`：解析弹幕点歌指令。
- `getBaseCommand(data)`：提取 B 站消息基础命令。
- `danmakuFromMessage(data)`：从 B 站弹幕消息中提取文本和用户信息。
- `hostToAddress(host)`：把 B 站 host 配置转换为 WebSocket 地址。
- `cookieValue(cookie, name)`：从 Cookie 字符串读取指定键。
- `clientBuvid(cookies)`：从 B 站 Cookie 容器中读取可用 buvid。
- `bilibiliHelpers`：以上 B 站辅助函数的命名空间导出。

服务启动入口仍然是：

```powershell
npm start
```

## 可执行文件打包

项目可以用 `@yao-pkg/pkg` 打包为 Windows x64 可执行文件：

```powershell
npm run build:exe
```

输出路径：

```text
dist/bilibiliwith163.exe
```

运行 exe 时，把 `.env` 放在 exe 同级目录。运行期写入的 `.cache/`、网易云登录 Cookie 和房间号配置也会保存在 exe 同级目录，而不是写入打包快照内部。

如果需要替换前端静态资源或壁纸，可以在 exe 同级目录放置 `public/` 或 `pic/`；存在外部目录时会优先读取外部目录，否则读取打包内置资源。

如果 `pkg` 无法下载预编译 Node 基础镜像，会回退到本地源码构建；Windows 环境需要可用的 `patch` 命令和完整编译工具链。证书校验失败时可先尝试：

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm run build:exe
```

## 测试和调试

语法检查示例：

```powershell
node --check src\server.js
node --check public\app.js
```

外部接口测试：

```powershell
npm test
```

`npm test` 会访问网易云和 B 站接口，受网络、Cookie 和直播间状态影响。弹幕监听异常时可以单独运行：

```powershell
npm run debug:bili
```

看到类似 `[DANMU] 用户名: 点歌 歌名` 后，再启动主服务排查完整点歌链路。

## 安全提示

- `.env` 中的 `BILI_COOKIE` 和 `NCM_COOKIE` 都是登录凭据，只应保存在本机。
- 不要把 `.env`、`.cache/`、日志或真实 Cookie 提交到仓库。
- `.env.example` 只应保留占位值。
- 开源前建议执行凭据扫描，确认历史提交中没有真实 Cookie。

## 文档

- [文档入口](docs/README.md)
- [项目架构](docs/ARCHITECTURE.md)
- [待办清单](docs/TODO.md)
- [工作记录](docs/WORK_HISTORY.md)

## License

MIT
