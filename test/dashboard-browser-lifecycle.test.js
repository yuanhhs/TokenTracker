const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Windows closes and disposes an idle dashboard WebView2 instead of hiding it", () => {
  const windowSource = read("TokenTrackerWin/DashboardWindow.cs");
  const traySource = read("TokenTrackerWin/TrayApplicationContext.cs");

  assert.match(windowSource, /public event Action<DashboardWindow>\? ReleasedForIdle/);
  assert.match(windowSource, /private void CloseOrHide\(\) => Close\(\);/);
  assert.match(windowSource, /_webView\.Dispose\(\)/);
  assert.match(windowSource, /ReleasedForIdle\?\.Invoke\(this\)/);

  // Closing must release the WebView2 rather than retain a hidden window.
  const closingHandler = windowSource.match(
    /protected override void OnClosing\([\s\S]*?\r?\n {4}}\r?\n\r?\n {4}protected override void OnClosed/,
  )?.[0];
  assert.ok(closingHandler, "Dashboard closing handler should exist");
  assert.doesNotMatch(closingHandler, /e\.Cancel = true;/, "normal closes must not retain WebView2");
  assert.doesNotMatch(closingHandler, /Hide\(\);/, "normal closes must not hide the window");

  assert.match(traySource, /dashboard\.ReleasedForIdle \+= OnDashboardReleasedForIdle/);
  assert.match(traySource, /ReferenceEquals\(_dashboard, dashboard\)/);
  assert.match(traySource, /_dashboard = null/);
});

// Account sign-in was removed with the rest of the cloud stack; the dashboard
// window must not regrow an OAuth retention path.
test("Windows dashboard window carries no OAuth surface", () => {
  const windowSource = read("TokenTrackerWin/DashboardWindow.cs");

  assert.doesNotMatch(windowSource, /oauth/i);
  assert.doesNotMatch(windowSource, /authCompleted/);
});
