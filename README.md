# Bilibiliwith163

Bilibiliwith163 是一个面向直播场景的 B 站弹幕点歌程序。它会直接连接指定 B 站直播间的实时弹幕 WebSocket，识别观众发送的点歌指令，通过网易云音乐接口搜索和获取播放地址，并把播放器作为浏览器源插入 OBS 或直播姬。

项目当前使用 `@neteasecloudmusicapienhanced/api`，没有使用已经停止维护的原版 `NeteaseCloudMusicApi`。

## 功能

- 实时监听 B 站直播间弹幕。
- 支持 `点歌`、`点播`、`网易云` 等指令。
- 自动搜索网易云歌曲，获取可播放地址并加入队列。
- 支持网易云二维码登录，会员歌曲会按登录账号权限尝试播放。
- 本地音频缓存，降低播放卡顿和外链不稳定带来的影响。
- OBS 浏览器源播放器，含当前歌曲、候选队列、进度、暂停、下一首、移除候选歌曲。
- Web 控制台，支持切歌、清空队列、停止、切换追踪房间、网易云登录、外观编辑、保存/读取外观配置。
- 控制台固定读取 `pic/fu.png` 作为网页壁纸，播放器预览可叠加 `pic/miku.png` 或 `pic/miku.jpg` 观察毛玻璃效果。

## 技术栈

- Node.js + CommonJS
- Express 5
- Socket.IO 4
- `bilibili-live-danmaku`
- `@neteasecloudmusicapienhanced/api`
- `ws`
- `dotenv`

## 安装

```powershell
npm install
copy .env.example .env
```

编辑 `.env`，至少确认：

```text
BILI_ROOM_ID=你的直播间号
BILI_COOKIE=你的 B 站 Cookie
PORT=3888
```

网易云登录不要求提前写入 Cookie，可以在控制台中扫码登录。登录成功后会写入 `.env` 的 `NCM_COOKIE`。

## 启动

```powershell
npm start
```

启动后打开：

- OBS / 直播姬浏览器源：`http://localhost:3888/`
- 控制台：`http://localhost:3888/dashboard.html`

OBS 浏览器源建议使用透明背景，并按你的直播布局裁剪或缩放。

## 弹幕指令

默认支持：

```text
点歌 歌名
点播 歌名
网易云 歌名
```

也支持歌手或更完整的关键词：

```text
点歌 晴天 周杰伦
点歌 大貔貅 DJ阿智
```

可以通过 `.env` 的 `REQUEST_COMMANDS` 修改指令列表：

```text
REQUEST_COMMANDS=点歌,点播,网易云
```

## 控制台

控制台提供这些常用操作：

- 打开 OBS 源
- 跳过当前歌曲
- 清空队列
- 停止当前播放并清空
- 切换追踪房间号并写入 `.env`
- 网易云二维码登录、刷新状态、退出登录
- 编辑 OBS 点歌器外观
- 保存配置、读取配置、恢复默认

外观编辑支持：

- 播放器宽高
- 候选框总高度
- 候选歌曲单条高度
- 消息播报栏高度
- 播放器、候选框、播报栏圆角
- 毛玻璃透明度和模糊
- 播放器、候选框、播报栏底色
- 各区域字号、颜色、字体
- 本机字体读取，浏览器支持时可从本地字体列表选择

## 缓存

歌曲播放地址会注册到本地缓存，播放器通过 `/api/audio/<requestId>` 播放本地代理后的音频，避免每次都直接拉网易云外链。

可配置：

```text
AUDIO_CACHE_MAX_MB=512
AUDIO_CACHE_MAX_FILES=120
```

缓存接口：

```text
GET  /api/cache
POST /api/cache/cleanup
```

手动清理示例：

```powershell
Invoke-RestMethod -Uri http://localhost:3888/api/cache/cleanup -Method POST -ContentType "application/json" -Body '{"maxMb":256,"maxFiles":80}'
```

## 测试

```powershell
npm test
```

该测试会验证网易云搜索和播放地址获取，以及 B 站直播间初始化和弹幕 WebSocket 鉴权能力。

如果弹幕监听异常，可以单独运行：

```powershell
npm run debug:bili
```

看到类似 `[DANMU] 用户名: 点歌 歌名` 后，再启动主服务排查点歌链路。

## 安全提示

`.env` 中的 B 站 Cookie、网易云 Cookie 都属于登录凭据，只应保存在本机。不要把 `.env` 提交到仓库，也不要把 Cookie 发给他人。

## 文档

- [文档入口](docs/README.md)
- [项目架构](docs/ARCHITECTURE.md)
- [待办清单](docs/TODO.md)
- [工作记录](docs/WORK_HISTORY.md)

## License

MIT
