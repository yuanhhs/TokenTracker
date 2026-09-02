const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const WORKFLOW_PATH = path.join(__dirname, "..", ".github", "workflows", "release-windows.yml");
const ISS_PATH = path.join(__dirname, "..", "TokenTrackerWin", "installer", "TokenTracker.iss");

const workflow = () => fs.readFileSync(WORKFLOW_PATH, "utf8");
const installer = () => fs.readFileSync(ISS_PATH, "utf8");

test("Windows release workflow is standalone and versioned", () => {
  const source = workflow();
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /version:/);
  assert.doesNotMatch(source, /workflow_call:/);
  assert.match(source, /runs-on:\s*windows-/);
  assert.match(source, /contents:\s*write/);
  assert.match(source, /package\.json/);
  assert.match(source, /TokenTrackerWin\.csproj/);
});

test("Windows release builds the dashboard before the embedded runtime", () => {
  const source = workflow();
  const dashboard = source.indexOf("dashboard:build");
  const bundle = source.indexOf("bundle-node.ps1");
  const publish = source.indexOf("dotnet publish");
  assert.ok(dashboard >= 0 && dashboard < bundle);
  assert.ok(bundle < publish);
  assert.match(source, /-r win-x64/);
  assert.match(source, /--self-contained true/);
});

test("Windows release creates, uploads, and publishes one Windows release", () => {
  const source = workflow();
  assert.match(source, /gh release create/);
  assert.match(source, /gh release upload/);
  assert.match(source, /gh release edit \$tag --draft=false/);
  assert.match(source, /TokenTracker-win-x64\.zip/);
  assert.match(source, /TokenTracker-Setup\.exe/);
  assert.doesNotMatch(source, /TokenTrackerBar|AppImage|DMG/);
});

test("release verifies the embedded server payload", () => {
  const source = workflow();
  assert.match(source, /EmbeddedServer\/node\.exe/);
  assert.match(source, /EmbeddedServer\/tokentracker\/bin\/tracker\.js/);
  assert.match(source, /EmbeddedServer\/tokentracker\/dashboard\/dist\/index\.html/);
});

test("installer is per-user and bundles the publish directory", () => {
  const source = installer();
  assert.match(source, /PrivilegesRequired\s*=\s*lowest/);
  assert.match(source, /\{localappdata\}/);
  assert.match(source, /Source:\s*"\.\.\\publish\\\*"/);
  assert.match(source, /MyAppVersion/);
});

test("bundled Chinese installer language files exist with UTF-8 BOM", () => {
  const installerDir = path.dirname(ISS_PATH);
  for (const name of ["ChineseSimplified.isl", "ChineseTraditional.isl"]) {
    const buffer = fs.readFileSync(path.join(installerDir, name));
    assert.deepEqual([...buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  }
});
