# Token Tracker Windows App

The native Windows host uses .NET 8, WinForms, WPF, WebView2, and an embedded Node.js runtime.

## Runtime

- `Program.cs` starts the single system-tray application.
- `ServerManager.cs` launches the bundled local CLI server on loopback.
- `DashboardWindow.cs` hosts the local React dashboard in WebView2.
- `TrayApplicationContext.cs` owns the tray menu, startup setting, updater, and dashboard window.
- `UsagePoller.cs` reads local summary data for the tray.

There is no Token Tracker account, OAuth callback, leaderboard, cloud publication, or desktop pet.

## Build

```powershell
npm ci
npm ci --prefix dashboard
npm run dashboard:build
powershell -ExecutionPolicy Bypass -File TokenTrackerWin/scripts/bundle-node.ps1
dotnet build TokenTrackerWin/TokenTrackerWin.csproj --configuration Release
```

For a self-contained package:

```powershell
dotnet publish TokenTrackerWin/TokenTrackerWin.csproj -c Release -r win-x64 --self-contained true -o TokenTrackerWin/publish
Copy-Item TokenTrackerWin/EmbeddedServer TokenTrackerWin/publish/EmbeddedServer -Recurse -Force
```

## Tests

```powershell
dotnet test TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj --configuration Release
```
