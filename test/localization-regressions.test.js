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

  const core = JSON.parse(read("dashboard/src/content/i18n/zh/core.json"));
  assert.equal(core["limits.label.codex_spark_5h"], "Spark 5h");
  assert.equal(core["limits.label.codex_spark_7d"], "Spark 7d");
});

test("Codex Spark usage limit row labels stay on one line", () => {
  const usageLimitsPanel = read("dashboard/src/ui/dashboard/components/UsageLimitsPanel.jsx");

  assert.match(usageLimitsPanel, /data-limit-label[\s\S]*?\bwhitespace-nowrap\b[\s\S]*?var\(--tt-limits-label-w\)/);
});

test("Chinese profile footer labels the start date instead of a leaderboard rank", () => {
  const core = JSON.parse(read("dashboard/src/content/i18n/zh/core.json"));
  assert.equal(core["identity_card.rank_label"], "开始使用");
});

test("zh locale uses reviewed natural copy for settings and dashboard", () => {
  const core = read("dashboard/src/content/i18n/zh/core.json");
  const dashboard = read("dashboard/src/content/i18n/zh/dashboard.json");

  assert.match(core, /"identity_card\.rank_label":\s*"开始使用"/);
  assert.match(core, /"daily\.sort\.conversations\.label":\s*"对话数"/);

  assert.doesNotMatch(core, /顶级模特|转化次数|InsForge 可以摄取您的队列|斑点条纹和安静的日子一目了然/);
  assert.doesNotMatch(dashboard, /型号分解|动态的|复制的|编码剂|2025 包裹/);
});

test("language selector exposes only English and Simplified Chinese", () => {
  const appearanceSection = read("dashboard/src/components/settings/AppearanceSection.jsx");
  const i18nRoot = path.join(__dirname, "..", "dashboard", "src", "content", "i18n");

  assert.match(appearanceSection, /EN_LOCALE/);
  assert.match(appearanceSection, /ZH_CN_LOCALE/);
  assert.doesNotMatch(appearanceSection, /ZH_TW_LOCALE|JA_LOCALE|KO_LOCALE|DE_LOCALE/);
  const localeDirectories = fs.readdirSync(i18nRoot)
    .filter((locale) => fs.existsSync(path.join(i18nRoot, locale, "core.json")))
    .sort();
  assert.deepEqual(localeDirectories, ["zh"]);
});

test("token number display setting is localized in Simplified Chinese", () => {
  const keys = [
    "settings.appearance.token_format.label",
    "settings.appearance.token_format.hint",
    "settings.appearance.token_format.compact",
    "settings.appearance.token_format.full",
  ];

  const core = JSON.parse(read("dashboard/src/content/i18n/zh/core.json"));
  for (const key of keys) {
    assert.equal(typeof core[key], "string", `zh missing ${key}`);
    assert.ok(core[key].trim().length > 0, `zh has empty ${key}`);
  }
});
