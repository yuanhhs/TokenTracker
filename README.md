# Token Tracker Windows 版

Token Tracker 是一款仅面向 Windows 的本地优先 AI 编程工具 Token 用量与花费追踪器。应用常驻系统托盘，在本机聚合使用数据，不需要注册或登录 Token Tracker 账号。

## 主要功能

- 支持 29 种 AI 编程工具的本地用量统计
- Windows 系统托盘集成，可打开仪表板和立即同步
- 本地仪表板：Token、预估花费、趋势、模型、项目和 Provider 额度
- 主题、货币、Token 数字格式和简体中文界面
- 自包含 .NET 8 Windows 应用，内置 Node.js 本地服务

本项目保持本地优先：用量统计只读取 Token 数量和聚合用量，不收集提示词、回复正文或消息内容。项目不包含 Token Tracker 登录、云同步、排行榜、成就、桌面宠物，以及本二开版本已经删除的其他功能。

## 安装

从 [GitHub Releases](https://github.com/yuanhhs/TokenTracker/releases/latest) 下载最新版：

- `TokenTracker-Setup.exe`：Windows 安装包
- `TokenTracker-win-x64.zip`：便携版

应用启动后常驻 Windows 通知区域，本地仪表板只监听回环地址。

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
