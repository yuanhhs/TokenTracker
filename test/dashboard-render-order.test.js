const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("DashboardPage declares timeZone before use in range computation", () => {
  const filePath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
  const src = fs.readFileSync(filePath, "utf8");
  const timeZoneDeclIndex = src.search(/\b(const|let)\s+timeZone\b/);
  const rangeUseIndex = src.indexOf("getRangeForPeriod(");

  assert.ok(timeZoneDeclIndex !== -1, "timeZone declaration not found");
  assert.ok(rangeUseIndex !== -1, "getRangeForPeriod usage not found");
  assert.ok(
    timeZoneDeclIndex < rangeUseIndex,
    "timeZone should be declared before getRangeForPeriod call",
  );
});

test("DashboardPage declares mockEnabled before every effect that reads it", () => {
  const filePath = path.join(__dirname, "..", "dashboard", "src", "pages", "DashboardPage.jsx");
  const src = fs.readFileSync(filePath, "utf8");
  const mockEnabledDeclIndex = src.search(/\bconst\s+mockEnabled\b/);

  assert.ok(mockEnabledDeclIndex !== -1, "mockEnabled declaration not found");

  // The account link-code effect that used to guard on `signedIn` is gone, but
  // the temporal-dead-zone contract still holds: no reference may precede the
  // declaration, or the effect throws on first render.
  const usages = [];
  const pattern = /\bmockEnabled\b/g;
  let match;
  while ((match = pattern.exec(src)) !== null) usages.push(match.index);

  assert.ok(usages.length > 1, "expected mockEnabled to be read somewhere after declaration");
  for (const usageIndex of usages) {
    assert.ok(
      usageIndex >= mockEnabledDeclIndex,
      `mockEnabled read at index ${usageIndex} precedes its declaration`,
    );
  }
  assert.doesNotMatch(src, /\bsignedIn\b/, "DashboardPage must carry no sign-in state");
});
