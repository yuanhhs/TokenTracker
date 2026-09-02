const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("Windows desktop widgets keep all original types and native lifecycle wiring", () => {
  const settings = read("TokenTrackerWin/DesktopWidgetSettings.cs");
  const window = read("TokenTrackerWin/DesktopWidgetWindow.cs");
  const tray = read("TokenTrackerWin/TrayApplicationContext.cs");
  const dashboardWindow = read("TokenTrackerWin/DashboardWindow.cs");
  const app = read("dashboard/src/App.jsx");
  const sidebar = read("dashboard/src/ui/components/Sidebar.jsx");
  const vite = read("dashboard/vite.config.js");
  const widgetEntry = read("dashboard/src/widget.jsx");

  for (const id of ["summary", "heatmap", "topModels", "limits"]) {
    assert.ok(settings.includes(`\"${id}\"`), `native settings should include ${id}`);
    assert.ok(widgetEntry.includes(`\"${id}\"`), `widget renderer should include ${id}`);
  }
  assert.match(window, /widget[.]html[?]app=1&type=/);
  assert.match(window, /widget:drag/);
  assert.match(window, /StorePlacement/);
  assert.match(tray, /ApplyStoredDesktopWidgets/);
  assert.match(tray, /resetDesktopWidgetPositions/);
  assert.match(dashboardWindow, /desktopWidgetsSupported = true/);
  assert.match(app, /[\"]\/widgets[\"]/);
  assert.match(sidebar, /nav[.]widgets/);
  assert.match(vite, /widget: path[.]resolve\(ROOT_DIR, [\"]widget[.]html[\"]\)/);
});
