const test = require("node:test");
const assert = require("node:assert/strict");
const { readCopyRegistry } = require("../scripts/validate-locale-coverage.cjs");
const registry = Object.fromEntries(readCopyRegistry().map(({ key, text }) => [key, text]));

test("Chinese copy keeps CLI subcommands executable", () => {
  assert.equal(registry["dashboard.install.cmd.init"], "npx --yes tokentracker-cli init");
  assert.equal(registry["dashboard.install.cmd.sync"], "npx --yes tokentracker-cli sync");
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
