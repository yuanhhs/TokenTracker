const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

test("zh locale keeps CLI subcommands executable", () => {
  const dashboardCopy = read("dashboard/src/content/i18n/zh/dashboard.json");

  assert.match(
    dashboardCopy,
    /"dashboard\.install\.cmd\.init":\s*"npx --yes tokentracker-cli init"/,
    "expected zh install init command to keep the init subcommand",
  );
  assert.match(
    dashboardCopy,
    /"dashboard\.install\.cmd\.sync":\s*"npx --yes tokentracker-cli sync"/,
    "expected zh sync command to keep the sync subcommand",
  );
  assert.doesNotMatch(dashboardCopy, /tokentracker-cli (初始化|同步)/);
});

test("Codex Spark usage limit labels use copy keys with compact defaults", () => {
  const copyCsv = read("dashboard/src/content/copy.csv");
  const providerSpecs = read("dashboard/src/ui/dashboard/components/usage-limits-provider-specs.js");

  assert.match(copyCsv, /^limits\.label\.codex_spark_5h,.*"Spark 5h"/m);
  assert.match(copyCsv, /^limits\.label\.codex_spark_7d,.*"Spark 7d"/m);
  assert.match(providerSpecs, /{ key: "spark-5h", labelKey: "limits\.label\.codex_spark_5h", window: data\.spark_primary_window, windowSecondsField: "limit_window_seconds" }/);
  assert.match(providerSpecs, /{ key: "spark-7d", labelKey: "limits\.label\.codex_spark_7d", window: data\.spark_secondary_window, windowSecondsField: "limit_window_seconds" }/);
  assert.doesNotMatch(providerSpecs, /label: "Spark [57][hd]"/);

  for (const locale of ["zh", "zh-TW", "ja", "ko"]) {
    const core = JSON.parse(read(`dashboard/src/content/i18n/${locale}/core.json`));

    assert.equal(core["limits.label.codex_spark_5h"], "Spark 5h");
    assert.equal(core["limits.label.codex_spark_7d"], "Spark 7d");
  }
});

test("Codex Spark usage limit row labels stay on one line", () => {
  const usageLimitsPanel = read("dashboard/src/ui/dashboard/components/UsageLimitsPanel.jsx");

  assert.match(usageLimitsPanel, /data-limit-label[\s\S]*?\bwhitespace-nowrap\b[\s\S]*?var\(--tt-limits-label-w\)/);
});

test("profile footer labels the start date instead of a leaderboard rank", () => {
  const expectedLabels = {
    zh: "开始使用",
    "zh-TW": "開始使用",
    ja: "開始日",
    ko: "시작일",
    de: "Beginn",
  };

  for (const [locale, expectedLabel] of Object.entries(expectedLabels)) {
    const core = JSON.parse(read(`dashboard/src/content/i18n/${locale}/core.json`));
    assert.equal(core["identity_card.rank_label"], expectedLabel);
  }
});

test("zh locale uses reviewed natural copy for settings and dashboard", () => {
  const core = read("dashboard/src/content/i18n/zh/core.json");
  const dashboard = read("dashboard/src/content/i18n/zh/dashboard.json");

  assert.match(core, /"identity_card\.rank_label":\s*"开始使用"/);
  assert.match(core, /"daily\.sort\.conversations\.label":\s*"对话数"/);

  assert.doesNotMatch(core, /顶级模特|转化次数|InsForge 可以摄取您的队列|斑点条纹和安静的日子一目了然/);
  assert.doesNotMatch(dashboard, /型号分解|动态的|复制的|编码剂|2025 包裹/);
});

test("language selector localizes the German option in every translated locale", () => {
  const expectedLabels = {
    zh: "德语",
    "zh-TW": "德語",
    ja: "ドイツ語",
    ko: "독일어",
    de: "Deutsch",
  };

  for (const [locale, expectedLabel] of Object.entries(expectedLabels)) {
    const core = JSON.parse(read(`dashboard/src/content/i18n/${locale}/core.json`));
    assert.equal(core["settings.appearance.language.german"], expectedLabel);
  }
});

test("token number display setting is localized in every translated locale", () => {
  const localeFiles = ["zh", "zh-TW", "ja", "ko", "de"];
  const keys = [
    "settings.appearance.token_format.label",
    "settings.appearance.token_format.hint",
    "settings.appearance.token_format.compact",
    "settings.appearance.token_format.full",
  ];

  for (const locale of localeFiles) {
    const core = JSON.parse(read(`dashboard/src/content/i18n/${locale}/core.json`));
    for (const key of keys) {
      assert.equal(typeof core[key], "string", `${locale} missing ${key}`);
      assert.ok(core[key].trim().length > 0, `${locale} has empty ${key}`);
    }
  }
});
