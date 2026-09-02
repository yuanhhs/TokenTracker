const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadShouldShowInstallCard() {
  const modulePath = path.join(__dirname, "..", "dashboard", "src", "lib", "install-status.js");
  const mod = await import(pathToFileURL(modulePath).href);
  return mod.shouldShowInstallCard;
}

const BASE = {
  publicMode: false,
  screenshotMode: false,
  forceInstall: false,
  heatmapLoading: false,
  activeDays: 0,
};

test("install card shows when no local usage has been recorded yet", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(shouldShowInstallCard({ ...BASE }), true);
});

test("install card hides once local usage exists", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(shouldShowInstallCard({ ...BASE, activeDays: 3 }), false);
});

test("install card stays hidden while the heatmap is still loading", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(shouldShowInstallCard({ ...BASE, heatmapLoading: true }), false);
});

test("public and screenshot modes always hide the install card", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(shouldShowInstallCard({ ...BASE, publicMode: true }), false);
  assert.equal(shouldShowInstallCard({ ...BASE, screenshotMode: true }), false);
  // Even forceInstall must not override public/screenshot mode.
  assert.equal(shouldShowInstallCard({ ...BASE, publicMode: true, forceInstall: true }), false);
  assert.equal(shouldShowInstallCard({ ...BASE, screenshotMode: true, forceInstall: true }), false);
});

test("forceInstall shows the install card even with recorded usage", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(shouldShowInstallCard({ ...BASE, forceInstall: true, activeDays: 12 }), true);
});

// The install card used to be gated on a cloud device token. That identity is
// gone, so leftover callers passing those fields must not change the outcome.
test("removed cloud identity inputs no longer gate the install card", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();

  assert.equal(
    shouldShowInstallCard({ ...BASE, accessEnabled: true, hasActiveDeviceToken: true }),
    true,
  );
  assert.equal(
    shouldShowInstallCard({ ...BASE, activeDays: 3, accessEnabled: false, hasActiveDeviceToken: false }),
    false,
  );
});
