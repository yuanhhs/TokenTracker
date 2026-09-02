# Token Tracker for Windows

Token Tracker is a local-first Windows system-tray app for tracking token usage and estimated cost across AI coding tools. It stores aggregated usage on the local machine and does not require a Token Tracker account.

## Features

- Local usage dashboard for 34 supported AI coding tools
- Windows system-tray integration
- Self-contained .NET 8 application with an embedded Node.js server
- Usage totals, trends, model breakdowns, projects, and limits
- No Token Tracker login, cloud sync, leaderboard, achievements, or desktop pet
- Token counts only; prompts and response bodies are not collected

## Install

Download the latest Windows installer or portable zip from [GitHub Releases](https://github.com/xiufengsun/TokenTracker/releases/latest):

- `TokenTracker-Setup.exe`
- `TokenTracker-win-x64.zip`

The application starts from the Windows notification area and launches its local dashboard on loopback only.

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

Run the local server directly:

```powershell
node bin/tracker.js serve --no-sync
```

Build the embedded Windows runtime:

```powershell
npm run dashboard:build
powershell -ExecutionPolicy Bypass -File TokenTrackerWin/scripts/bundle-node.ps1
dotnet publish TokenTrackerWin/TokenTrackerWin.csproj -c Release -r win-x64 --self-contained true
```

## Data

Runtime data is stored under `%USERPROFILE%\.tokentracker\tracker`. The main usage queue is `queue.jsonl`; provider cursors and local configuration live beside it.

Some supported providers expose usage only through their own authenticated local installation. Token Tracker may read those providers' existing local credentials to query their usage APIs, but it does not create or record a Token Tracker login.

## Release

`package.json` is the canonical version. Run `npm version <version>` to synchronize `TokenTrackerWin/TokenTrackerWin.csproj`, push `main`, wait for CI, then dispatch the `release Windows` workflow with the same version.

## License

MIT
