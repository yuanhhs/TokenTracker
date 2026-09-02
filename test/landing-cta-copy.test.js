const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copyPath = path.join(root, "dashboard", "src", "content", "copy.csv");
const marketingLandingPath = path.join(
  root,
  "dashboard",
  "src",
  "ui",
  "marketing",
  "MarketingLanding.jsx",
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasCopyKey(csv, key) {
  return csv.startsWith(`${key},`) || csv.includes(`\n${key},`);
}

// The landing page renders a "Dashboard" primary CTA and a "GitHub" secondary
// CTA. The old `landing.cta.primary` sign-in link is gone with the account
// system; the key survives in the registry for translated locales only.
const RENDERED_CTA_KEYS = ["landing.v2.cta.primary", "landing.cta.secondary"];

test("landing CTA copy keys exist", () => {
  const csv = read(copyPath);

  for (const key of RENDERED_CTA_KEYS) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("Marketing landing uses CTA copy keys", () => {
  const source = read(marketingLandingPath);

  for (const key of RENDERED_CTA_KEYS) {
    assert.ok(
      source.includes(`copy("${key}"`),
      `expected MarketingLanding to use copy key ${key}`,
    );
  }
});

test("Marketing landing carries no sign-in CTA", () => {
  const source = read(marketingLandingPath);

  assert.doesNotMatch(source, /signInUrl|signedIn/, "landing must not link to a sign-in route");
  assert.ok(
    !source.includes('copy("landing.cta.primary"'),
    "landing.cta.primary was the sign-in CTA and must stay unused",
  );
});
