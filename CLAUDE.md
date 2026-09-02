# Repository Guidance

Token Tracker is a Windows-only, local-first AI token usage tracker.

## Project Shape

- `src/`: CommonJS Node.js local parser and loopback API.
- `dashboard/`: React 18 + Vite dashboard embedded in the Windows app.
- `TokenTrackerWin/`: .NET 8 WinForms/WPF/WebView2 system-tray application.
- `TokenTrackerWin.Tests/`: Windows updater and native behavior tests.

The Windows application bundles `bin/`, `src/`, production Node dependencies, and `dashboard/dist/` through `TokenTrackerWin/scripts/bundle-node.ps1`.

## Commands

```powershell
npm test
npm run dashboard:build
npm run validate:copy
npm run validate:locale
npm run validate:ui-hardcode
npm run validate:guardrails
npm run validate:versions
dotnet test TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj --configuration Release
dotnet build TokenTrackerWin/TokenTrackerWin.csproj --configuration Release
node bin/tracker.js serve --no-sync
```

## Data Flow

AI tool logs or local usage APIs -> `src/commands/sync.js` -> `~/.tokentracker/tracker/queue.jsonl` -> loopback API -> embedded dashboard.

Token Tracker has no account system, login, cloud sync, leaderboard, pet, or telemetry heartbeat. Keep the loopback mutation token that `src/lib/local-api.js` mints and serves at `/api/local-auth`, and the `dashboard/src/lib/local-api-auth.ts` helper that sends it; it protects local writes and is not a user login.

Third-party provider credentials remain allowed where needed to read that provider's own usage. Do not confuse Codex, Claude, Cursor, Gemini, Copilot, Kimi, or other provider authentication with a Token Tracker account.

## Token Normalization

```text
input_tokens                = non-cached input
cached_input_tokens         = cache reads
cache_creation_input_tokens = cache writes
reasoning_output_tokens     = reasoning tokens
total_tokens                = sum of every token category
```

Cost is computed from the individual categories, never from `total_tokens` alone. Queue rows use UTC half-hour buckets and readers keep the latest row per `(source, model, hour_start)`.

## Engineering Conventions

- CommonJS in `src/`; ESM + strict TypeScript/JSX in `dashboard/`.
- Keep all product data local and never collect prompts, messages, or response bodies.
- Preserve existing provider credential readers and parsers unless the task targets them.
- Prefer existing helpers and patterns over new abstractions.
- Add user-facing dashboard text through `dashboard/src/content/copy.csv`.
- Windows native adaptations are gated by `isNativeWindowsApp()` in `dashboard/src/lib/native-bridge.js`.
- `TokenTrackerWin/EmbeddedServer/` is generated and gitignored.

## Release

`package.json` is the canonical version. `scripts/version-files.cjs` synchronizes it with `TokenTrackerWin/TokenTrackerWin.csproj`.

1. Run `npm version <x.y.z>`.
2. Push `main` and wait for CI.
3. Dispatch `.github/workflows/release-windows.yml` with the same version.

The workflow creates a draft GitHub release, builds the self-contained Windows zip and installer, uploads both stable asset names, and publishes the release only after both assets succeed.

## Parser Correctness

- Use `claudeMessageDedupKey()` for Claude-compatible logs.
- Verify whether provider input totals already include cache tokens.
- Treat context-window snapshots as snapshots, not cumulative usage.
- After changes to `sync.js` or cursor state, run two consecutive syncs to expose state pollution.
