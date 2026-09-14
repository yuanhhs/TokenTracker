const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

const { readCopyRegistry } = require("../scripts/validate-locale-coverage.cjs");
const registry = Object.fromEntries(readCopyRegistry().map(({ key, text }) => [key, text]));

test("Chinese copy keeps CLI subcommands executable", () => {
  assert.equal(registry["dashboard.install.cmd.init"], "npx --yes tokentracker-cli init");
  assert.equal(registry["dashboard.install.cmd.sync"], "npx --yes tokentracker-cli sync");
});

test("Codex Spark usage limit labels use copy keys with compact defaults", () => {
  const providerSpecs = read("dashboard/src/ui/dashboard/components/usage-limits-provider-specs.js");
  assert.equal(registry["limits.label.codex_spark_5h"], "Spark 5h");
  assert.equal(registry["limits.label.codex_spark_7d"], "Spark 7d");
  assert.match(providerSpecs, /labelKey: "limits\.label\.codex_spark_5h"/);
  assert.match(providerSpecs, /labelKey: "limits\.label\.codex_spark_7d"/);
  assert.doesNotMatch(providerSpecs, /label: "Spark [57][hd]"/);
});

test("Codex Spark usage limit row labels stay on one line", () => {
  const usageLimitsPanel = read("dashboard/src/ui/dashboard/components/UsageLimitsPanel.jsx");

  assert.match(usageLimitsPanel, /data-limit-label[\s\S]*?\bwhitespace-nowrap\b[\s\S]*?var\(--tt-limits-label-w\)/);
});

test("Chinese copy keeps reviewed settings and dashboard terminology", () => {
  assert.equal(registry["identity_card.rank_label"], "开始使用");
  assert.equal(registry["daily.sort.conversations.label"], "对话数");
  assert.doesNotMatch(Object.values(registry).join("\n"), /顶级模特|转化次数|InsForge 可以摄取您的队列|斑点条纹和安静的日子一目了然|型号分解|编码剂|2025 包裹/);
});

test("token number display settings use Simplified Chinese", () => {
  for (const key of ["label", "hint", "compact", "full"]) {
    assert.match(registry["settings.appearance.token_format." + key], /\p{Script=Han}/u);
  }
});
