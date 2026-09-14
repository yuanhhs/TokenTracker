#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const COPY_PATH = path.join(ROOT, "dashboard", "src", "content", "copy.csv");
const REQUIRED_COLUMNS = ["key", "module", "page", "component", "slot", "text"];

// These values are deliberately language-neutral: commands, URLs, product
// and model names, protocol abbreviations, or formatting-only labels. Keep
// this key-based so a newly added English sentence cannot silently pass.
const LANGUAGE_NEUTRAL_KEY_ALLOWLIST = [
  /^landing[.]install[.]command$/,
  /^(landing|share)[.]meta[.](?:og_site_name|og_type|og_image|og_url|twitter_card|twitter_image)$/,
  /^landing[.]cta[.]secondary$/,
  /^landing[.]v2[.]hero[.]title_line2$/,
  /^landing[.]v2[.]install[.]os_/,
  /^landing[.]v2[.]nav[.]github$/,
  /^heatmap[.]legend[.]utc$/,
  /^heatmap[.](?:unit|tooltip)[.]tokens$/,
  /^wrapped[.]tokens$/,
  /^settings[.]footer[.]version$/,
  /^dashboard[.]install[.]cmd[.]/,
  /^limits[.]provider[.]/,
  /^provider[.]display[.](?:omp|deepseek_harness)$/,
  /^limits[.]label[.](?:cursor_api|zcode_glm52|zcode_glm5t|claude_opus|codex_spark_[57][hd]|gemini_(?:pro|flash|lite)|antigravity_)/,
  /^ipcheck[.]props[.]asn$/,
  /^ipcheck[.]security[.](?:vpn|tor)$/,
  /^shared[.]app_name$/,
];

// Developer-facing product terms stay in English in Chinese UI copy. Scope
// each rule by copy key so ordinary Chinese words outside that product
// concept remain valid.
const PRODUCT_TERMINOLOGY_GLOSSARY = [
  {
    term: "Skill",
    translatedTerm: /技能/u,
    languageNeutralText: /^Skills?$/i,
    keyPatterns: [
      /^sessions[.]card[.]context_tooltip$/,
      /^dashboard[.]context_breakdown[.](?:system_prefix_tooltip|category[.]skills)$/,
    ],
  },
  {
    term: "Agent",
    translatedTerm: /智能体|智慧代理/u,
    languageNeutralText: /^(?:Agent|Agents|Sub-agent)$/i,
    keyPatterns: [
      /^sessions[.]card[.]subagents$/,
      /^dashboard[.]context_breakdown[.]category[.]custom_agents$/,
      /^landing[.]v3[.](?:tools[.]count|how[.]step1[.]title|how[.]step4[.]body|cap[.]title)$/,
    ],
  },
  {
    term: "Provider",
    translatedTerm: /服务商|服務商/u,
    languageNeutralText: /^Providers?$/i,
    keyPatterns: [
      /(?:^|[.])providers?(?:[.]|$)/,
      /^dashboard[.]device_card[.]account_scope_tip$/,
      /^landing[.]v3[.]cap[.]limits[.]body$/,
    ],
  },
  {
    term: "Star",
    translatedTerm: /加星|星标|星標/u,
    languageNeutralText: /^Star$/i,
    keyPatterns: [
      /^shared[.]github[.]star$/,
    ],
  },
  {
    term: "Prompt",
    translatedTerm: /提示词|提示詞/u,
    languageNeutralText: /^Prompt$/i,
    keyPatterns: [
      /(?:^|[._])prompt(?:[._]|$)/,
      /^sessions[.]card[.]privacy$/,
      /^usage[.]overview[.]antigravity_notice_body$/,
      /^dashboard[.]context_breakdown[.]system_prefix_tooltip$/,
      /^landing[.]v2[.]distill[.]body$/,
      /^landing[.]v3[.]privacy[.](?:title|p2)$/,
    ],
  },
  {
    term: "Hook",
    translatedTerm: /钩子|鉤子/u,
    languageNeutralText: /^Hook$/i,
    keyPatterns: [/^landing[.]v3[.]how[.]step2[.]title$/],
  },
  {
    term: "App",
    translatedTerm: /应用(?:程序)?|應用(?:程式)?/u,
    languageNeutralText: /^(?:App|Mac app)$/i,
    keyPatterns: [
      /^local_only[.]/,
          /^settings[.]section[.]menubar$/,
    ],
  },
];

// Dashboard is ordinary interface vocabulary in this product and should be
// localized as “仪表板” rather than preserved in English.
const UNLOCALIZED_UI_TERM_REGEX = /\bdashboard\b/i;

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (!row.every((cell) => String(cell).trim() === "")) rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  row.push(field);
  if (!row.every((cell) => String(cell).trim() === "")) rows.push(row);
  return rows;
}

function readCopyRegistry(copyPath = COPY_PATH) {
  const rows = parseCsv(fs.readFileSync(copyPath, "utf8"));
  const header = rows[0]?.map((cell) => String(cell).trim()) || [];
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missingColumns.length) {
    throw new Error(`Copy registry missing columns: ${missingColumns.join(", ")}`);
  }

  const index = Object.fromEntries(header.map((column, position) => [column, position]));
  const records = rows.slice(1).flatMap((cells, rowIndex) => {
    const key = String(cells[index.key] || "").trim();
    if (!key) return [];
    return [{
      key,
      module: String(cells[index.module] || "").trim(),
      page: String(cells[index.page] || "").trim(),
      text: String(cells[index.text] ?? "").trim(),
      row: rowIndex + 2,
    }];
  });
  if (!records.length) {
    throw new Error(`Copy registry has no entries: ${copyPath}`);
  }
  return records;
}

function isLanguageNeutral(record) {
  if (LANGUAGE_NEUTRAL_KEY_ALLOWLIST.some((pattern) => pattern.test(record.key))) return true;
  const text = record.text.trim();
  return PRODUCT_TERMINOLOGY_GLOSSARY.some((entry) => (
    entry.keyPatterns.some((pattern) => pattern.test(record.key)) &&
    entry.languageNeutralText.test(text)
  ));
}

function hasUnlocalizedUiTerm(record, localized) {
  const visibleText = String(localized)
    .replace(/\{\{\w+\}\}/g, "")
    .replace(/https?:\/\/\S+/g, "");
  return UNLOCALIZED_UI_TERM_REGEX.test(visibleText);
}

function findTerminologyViolations(record, localized) {
  return PRODUCT_TERMINOLOGY_GLOSSARY.filter((entry) => (
    entry.keyPatterns.some((pattern) => pattern.test(record.key)) &&
    entry.translatedTerm.test(String(localized))
  )).map((entry) => entry.term);
}

function validateChineseCopy(records) {
  const issues = [];
  const seen = new Set();
  for (const record of records) {
    const { key, text } = record;
    if (seen.has(key)) issues.push({ key, problem: "duplicate key" });
    seen.add(key);
    if (!text.trim()) issues.push({ key, problem: "empty text" });
    const visible = text.replace(/\{\{\w+\}\}/g, "");
    if (/[{}]/.test(visible)) issues.push({ key, problem: "malformed placeholder" });
    if (/[A-Za-z]{2,}/.test(visible) && !/\p{Script=Han}/u.test(visible) && !isLanguageNeutral(record)) {
      issues.push({ key, problem: "untranslated UI text" });
    }
    if (hasUnlocalizedUiTerm(record, text)) issues.push({ key, problem: "untranslated UI term" });
    for (const term of findTerminologyViolations(record, text)) {
      issues.push({ key, problem: "preserve product term: " + term });
    }
  }
  return issues;
}

function main() {
  const registry = readCopyRegistry();
  const issues = validateChineseCopy(registry);
  if (issues.length) {
    for (const { key, problem } of issues) console.error("- " + key + ": " + problem);
    process.exitCode = 1;
    return;
  }
  console.log("Simplified Chinese copy ok (" + registry.length + " keys).");
}

if (require.main === module) main();

module.exports = {
  PRODUCT_TERMINOLOGY_GLOSSARY,
  findTerminologyViolations,
  hasUnlocalizedUiTerm,
  isLanguageNeutral,
  parseCsv,
  readCopyRegistry,
  validateChineseCopy,
};
