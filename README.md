# Token Tracker Windows 版

Token Tracker 是一款仅面向 Windows 的本地优先 AI 编程工具 Token 用量与花费追踪器。应用常驻系统托盘，在本机聚合使用数据，不需要注册或登录 Token Tracker 账号。

## 主要功能

- 支持 29 种 AI 编程工具的本地用量统计
- Windows 系统托盘集成，可打开仪表盘、立即同步和管理桌面浮窗
- 本地仪表盘：Token、预估花费、趋势、模型、项目和 Provider 额度
- Windows 灵动岛：在桌面顶部常驻显示 Token、花费和额度，支持紧凑/展开模式、左右指标选择、已用/剩余额度、自动收起、拖动和位置持久化
- 独立的灵动岛设置页，可控制显示状态、额度条、紧凑额度环、指标和位置
- Windows 桌面小组件：使用概览、活跃热力图、热门模型、使用额度
- 小组件支持多种尺寸、显示/隐藏、窗口置顶、位置持久化和一键复位
- 主题、货币、Token 数字格式以及简体中文/英文界面
- 自包含 .NET 8 Windows 应用，内置 Node.js 本地服务

本项目保持本地优先：只统计 Token 数量和聚合用量，不收集提示词、回复正文或消息内容。项目不包含 Token Tracker 登录、云同步、排行榜、成就、桌面宠物，以及本二开版本已经删除的其他功能。

## 安装

从 [GitHub Releases](https://github.com/yuanhhs/TokenTracker/releases/latest) 下载最新版：

- `TokenTracker-Setup.exe`：Windows 安装包
- `TokenTracker-win-x64.zip`：便携版

应用启动后常驻 Windows 通知区域，本地仪表盘只监听回环地址。

## 开发

环境要求：

- Windows 10 19041 或更高版本
- Node.js 20 或更高版本
- .NET 8 SDK
- Microsoft Edge WebView2 Runtime

```powershell
npm ci
npm ci --prefix dashboard
npm run dashboard:build
npm test
dotnet test TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj --configuration Release
dotnet build TokenTrackerWin/TokenTrackerWin.csproj --configuration Release
```

直接运行本地服务：

```powershell
node bin/tracker.js serve --no-sync
```

构建内嵌 Windows 运行时：

```powershell
npm run dashboard:build
powershell -ExecutionPolicy Bypass -File TokenTrackerWin/scripts/bundle-node.ps1
dotnet publish TokenTrackerWin/TokenTrackerWin.csproj -c Release -r win-x64 --self-contained true
```

## 本地数据

运行数据保存在 `%USERPROFILE%\\.tokentracker\\tracker`。主要用量队列为 `queue.jsonl`，Provider 游标和本地配置保存在同一目录。

部分 Provider 只能通过其本机已登录的客户端提供用量。Token Tracker 可能读取这些 Provider 已有的本地凭据来查询用量 API，但不会创建或记录 Token Tracker 账号。

## 发布

`package.json` 是版本号的唯一来源。运行 `npm version <version>` 同步 `TokenTrackerWin/TokenTrackerWin.csproj`，推送 `main` 并等待 CI 通过，然后使用相同版本号触发 `release Windows` 工作流。

## 许可证

MIT

---

# Token Tracker for Windows

Token Tracker is a Windows-only, local-first app for tracking token usage and estimated cost across AI coding tools. It lives in the system tray, aggregates usage on the local machine, and does not require a Token Tracker account.

## Features

- Local usage tracking for 29 supported AI coding tools
- Windows system-tray integration for opening the dashboard, syncing, and managing desktop overlays
- Local dashboard with token totals, estimated cost, trends, models, projects, and provider limits
- Windows Dynamic Island with always-visible token, spend, and quota metrics; compact/expanded modes; configurable left/right metrics; used/remaining quota display; auto-collapse; dragging; and persisted placement
- Dedicated Dynamic Island settings for visibility, quota bars, compact quota ring, metrics, and placement
- Four Windows desktop widgets: Usage Summary, Activity Heatmap, Top Models, and Usage Limits
- Multiple widget sizes, show/hide controls, always-on-top mode, persisted positions, and position reset
- Theme, currency, token-number formatting, and Simplified Chinese/English UI
- Self-contained .NET 8 Windows application with an embedded Node.js local service

Token Tracker stores token counts and aggregated usage locally. It does not collect prompts, response bodies, or message content. This fork does not include Token Tracker login, cloud sync, leaderboard, achievements, desktop pet, or other features already removed from the fork.

## Install

Download the latest build from [GitHub Releases](https://github.com/yuanhhs/TokenTracker/releases/latest):

- `TokenTracker-Setup.exe`: Windows installer
- `TokenTracker-win-x64.zip`: portable build

The application starts in the Windows notification area, and its local dashboard listens on loopback only.

## Development

Requirements:

- Windows 10 19041 or later
- Node.js 20 or later
- .NET 8 SDK
- Microsoft Edge WebView2 Runtime

```powershell
npm ci
npm ci --prefix dashboard
npm run dashboard:build
npm test
dotnet test TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj --configuration Release
dotnet build TokenTrackerWin/TokenTrackerWin.csproj --configuration Release
```

Run the local service directly:

```powershell
node bin/tracker.js serve --no-sync
```

Build the embedded Windows runtime:

```powershell
npm run dashboard:build
powershell -ExecutionPolicy Bypass -File TokenTrackerWin/scripts/bundle-node.ps1
dotnet publish TokenTrackerWin/TokenTrackerWin.csproj -c Release -r win-x64 --self-contained true
```

## Local data

Runtime data is stored under `%USERPROFILE%\\.tokentracker\\tracker`. The primary usage queue is `queue.jsonl`; provider cursors and local configuration live beside it.

Some providers expose usage only through their authenticated local installation. Token Tracker may read those providers' existing local credentials to query usage APIs, but it does not create or record a Token Tracker login.

## Release

`package.json` is the canonical version. Run `npm version <version>` to synchronize `TokenTrackerWin/TokenTrackerWin.csproj`, push `main`, wait for CI, and then dispatch the `release Windows` workflow with the same version.

## License

MIT
