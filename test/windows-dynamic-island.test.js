const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Windows Dynamic Island is a topmost transparent non-activating surface", () => {
  const source = read("TokenTrackerWin/IslandWindow.cs");

  assert.match(source, /internal sealed class IslandWindow : Window/);
  assert.match(source, /AllowsTransparency = true/);
  assert.match(source, /Topmost = true/);
  assert.match(source, /ShowActivated = false/);
  assert.match(source, /ShowInTaskbar = false/);
  assert.match(source, /WS_EX_NOACTIVATE/);
  assert.match(source, /WS_EX_TRANSPARENT/);
  assert.match(source, /Navigate\(_server\.BaseUrl \+ "\/island\.html\?app=1"\)/);
  assert.match(source, /public static bool StoredEnabled/);
  assert.match(source, /public static bool StoredAutoCollapse/);
  assert.match(source, /public static bool StoredShowLimits/);
  assert.match(source, /public static bool StoredCompactMode/);
  assert.match(source, /StoredLimitDisplayMode/);
  assert.match(source, /StoredMetrics/);
  assert.match(source, /public void ResetPlacement\(\)/);
});

test("Windows Dynamic Island reuses the existing tray statistics and limits poller", () => {
  const tray = read("TokenTrackerWin/TrayApplicationContext.cs");
  const poller = read("TokenTrackerWin/UsagePoller.cs");

  assert.match(tray, /private IslandWindow\? _islandWindow/);
  assert.match(tray, /_poller\.IncludeLimits = enabled && IslandWindow\.StoredShowLimits/);
  assert.match(tray, /_islandWindow\?\.ApplyStats\(s\)/);
  assert.match(tray, /_islandWindow\?\.ApplyLimits\(limitsJson\)/);
  assert.match(poller, /Last7dCostUsd/);
  assert.match(poller, /Last30dCostUsd/);
  assert.match(poller, /functions\/tokentracker-usage-limits/);
});

test("Windows settings can toggle the Dynamic Island through WebView2", () => {
  const dashboard = read("TokenTrackerWin/DashboardWindow.cs");
  const bridge = read("dashboard/src/lib/native-bridge.js");
  const hook = read("dashboard/src/hooks/use-native-island-settings.js");

  assert.match(dashboard, /t\.GetString\(\) == "getSettings"/);
  assert.match(dashboard, /t\.GetString\(\) == "setSetting"/);
  assert.match(dashboard, /t\.GetString\(\) == "action"/);
  assert.match(dashboard, /dynamicIslandAutoCollapse/);
  assert.match(dashboard, /dynamicIslandShowLimits/);
  assert.match(dashboard, /dynamicIslandCompactMode/);
  assert.match(dashboard, /dynamicIslandLimitDisplayMode/);
  assert.match(dashboard, /dynamicIslandMetrics/);
  assert.doesNotMatch(dashboard, /hideMenuBarIcon/i);
  assert.match(dashboard, /CustomEvent\('native:settings'/);
  assert.match(bridge, /export function isNativeSettingsBridgeAvailable\(\)/);
  assert.match(bridge, /return postNativeMessage\(\{ type: "getSettings" \}\)/);
  assert.match(bridge, /return postNativeMessage\(\{ type: "action", name \}\)/);
  assert.match(hook, /useNativeIslandSettings/);
  assert.match(hook, /runAction/);
});

test("Windows exposes a dedicated Dynamic Island settings category", () => {
  const settingsPage = read("dashboard/src/pages/SettingsPage.jsx");
  const section = read("dashboard/src/components/settings/DynamicIslandSection.jsx");
  const labs = read("dashboard/src/components/settings/LabsSection.jsx");

  assert.match(settingsPage, /ISLAND: "island"/);
  assert.match(settingsPage, /settings\.section\.island/);
  assert.match(section, /dynamicIslandEnabled/);
  assert.match(section, /dynamicIslandShowLimits/);
  assert.match(section, /dynamicIslandAutoCollapse/);
  assert.match(section, /dynamicIslandCompactMode/);
  assert.match(section, /dynamicIslandLimitDisplayMode/);
  assert.match(section, /dynamicIslandMetrics/);
  assert.match(section, /showDynamicIsland/);
  assert.match(section, /resetDynamicIslandPosition/);
  assert.doesNotMatch(labs, /dynamicIsland/i);
  assert.doesNotMatch(section, /settings\.labs\.island/);
});

test("Windows dashboard build includes only the standalone island entry for this feature", () => {
  const vite = read("dashboard/vite.config.js");
  const html = read("dashboard/island.html");
  const limits = read("dashboard/src/lib/island-limit-summaries.js");

  assert.match(vite, /island: path\.resolve\(ROOT_DIR, "island\.html"\)/);
  assert.match(html, /src="\/src\/island\.jsx"/);
  assert.doesNotMatch(limits, /opencodeGo|openclaw/i);
});

test("Windows Dynamic Island keeps the complete supported provider metric set", () => {
  const metrics = read("dashboard/src/lib/island-metrics.js");
  const summaries = read("dashboard/src/lib/island-limit-summaries.js");
  for (const id of [
    "todayTokens", "todayCost", "last7dTokens", "totalTokens", "totalCost",
    "claude5h", "claude7d", "codex5h", "codex7d", "codexCredits",
    "cursorPlan", "cursorAuto", "cursorAPI", "geminiPro", "geminiFlash", "geminiLite",
    "kimiWeekly", "kimi5h", "kimiTotal", "kiroMonth", "kiroBonus",
    "grokMonth", "grokOndemand", "copilotPremium", "copilotChat",
    "antigravityClaudeWeekly", "antigravityClaude5h", "antigravityGeminiWeekly",
    "antigravityGemini5h", "zcodeGlm52", "zcodeGlm5Turbo",
  ]) {
    assert.match(`${metrics}\n${summaries}`, new RegExp(id));
  }
  assert.doesNotMatch(`${metrics}\n${summaries}`, /opencodeGo|qoder|openclaw/i);
});
