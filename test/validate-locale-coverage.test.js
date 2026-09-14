const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  findTerminologyViolations,
  hasUnlocalizedUiTerm,
  isLanguageNeutral,
  readCopyRegistry,
  validateChineseCopy,
} = require("../scripts/validate-locale-coverage.cjs");

const HEADER = "key,module,page,component,slot,text\n";

test("locale coverage rejects a copy registry without records", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "locale-coverage-"));
  const copyPath = path.join(root, "copy.csv");
  fs.writeFileSync(copyPath, HEADER, "utf8");

  assert.throws(
    () => readCopyRegistry(copyPath),
    /Copy registry has no entries/,
  );
});

test("product glossary preserves developer-facing English terms by copy key", () => {
  assert.deepEqual(
    findTerminologyViolations({ key: "dashboard.context_breakdown.category.skills" }, "\u6280\u80fd"),
    ["Skill"],
  );
  assert.deepEqual(
    findTerminologyViolations({ key: "dashboard.context_breakdown.category.skills" }, "Skills"),
    [],
  );
  assert.deepEqual(
    findTerminologyViolations({ key: "unrelated.label" }, "\u6280\u80fd"),
    [],
  );
  assert.deepEqual(
    findTerminologyViolations({ key: "settings.section.menubar" }, "\u5e94\u7528"),
    ["App"],
  );
});

test("language-neutral glossary labels are allowed without allowing full English sentences", () => {
  assert.equal(isLanguageNeutral({ key: "dashboard.context_breakdown.category.skills", text: "Skills" }), true);
  assert.equal(
    isLanguageNeutral({ key: "sessions.card.context_tooltip", text: "Analyze context usage" }),
    false,
  );
});

test("Dashboard remains localized while glossary terms may stay in English", () => {
  assert.equal(hasUnlocalizedUiTerm({ key: "example" }, "\u6253开 Dashboard"), true);
  assert.equal(hasUnlocalizedUiTerm({ key: "example" }, "\u6253开 Skills"), false);
});

test("Chinese copy validation rejects empty, duplicate, untranslated, and malformed entries", () => {
  const issues = validateChineseCopy([
    { key: "button.save", text: "保存 {{name}}" },
    { key: "button.save", text: "" },
    { key: "button.cancel", text: "Cancel" },
    { key: "message", text: "你好 {{name}" },
  ]);
  assert.deepEqual(issues.map(({ problem }) => problem), [
    "duplicate key", "empty text", "untranslated UI text", "malformed placeholder",
  ]);
});
