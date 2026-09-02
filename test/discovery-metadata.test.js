"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

// The translated READMEs, the desktop pet, the desktop widgets, and the
// achievement badges went away with the Windows-only, local-first refactor. The
// The supported-tool count is still the number every surviving public discovery surface
// has to agree on.
test("public discovery surfaces describe all 29 supported tools", () => {
  const readme = read("README.md");
  assert.match(readme, /29 supported AI coding tools/, "README.md has the current provider count");

  const index = read("dashboard/index.html");
  assert.doesNotMatch(index, /13 AI coding/);
  assert.match(index, /Supported AI coding tools \(29\)/);
  assert.match(index, /TRAE Work CN/);
  assert.match(index, /Service Status page/);
  assert.match(index, /usage limits for 10 providers/i);
  assert.doesNotMatch(index, /desktop pet|desktop widget/i);
  assert.doesNotMatch(index, /achievement/i, "removed achievements must not be advertised");

  const llms = read("dashboard/public/llms.txt");
  assert.match(llms, /Supported AI coding tools \(29\)/);
  assert.match(llms, /TRAE Work CN/);
  assert.doesNotMatch(llms, /desktop pet|desktop widget/i);
  assert.doesNotMatch(llms, /achievement/i, "removed achievements must not be advertised");
});

test("marketing logo wall includes the same 29 product integrations", () => {
  const source = read("dashboard/src/ui/marketing/agent-logos.js");
  const providers = [...source.matchAll(/provider:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(providers.length, 29);
  assert.equal(new Set(providers).size, 29);

  for (const provider of ["every-code", "reasonix", "kilocode", "roocode", "goose", "droid", "anythingllm", "dsh", "prime-agent", "trae-cn", "dots"]) {
    assert.ok(providers.includes(provider), `logo wall includes ${provider}`);
  }
});

test("CLI onboarding advertises the same 29 supported integrations", () => {
  const source = read("src/commands/init.js");
  const block = source.match(/const SUPPORTED_PROVIDERS = \[([\s\S]*?)\];/);
  assert.ok(block, "init defines SUPPORTED_PROVIDERS");

  const providers = [...block[1].matchAll(/^\s*"([^"]+)",?$/gm)].map((match) => match[1]);
  assert.equal(providers.length, 29);
  assert.equal(new Set(providers).size, 29);
  assert.ok(providers.includes("Droid"));
  assert.ok(providers.includes("AnythingLLM Desktop"));
  assert.ok(providers.includes("Reasonix"));
  assert.ok(providers.includes("DeepSeek Harness"));
  assert.ok(providers.includes("Prime Agent"));
  assert.ok(providers.includes("TRAE Work CN"));
  assert.ok(providers.includes("Dots"));
});

test("npm metadata carries the current product hook", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.description, /local-first/i);
  assert.match(pkg.description, /Windows/);
  assert.ok(pkg.keywords.includes("ai-coding-tools"));
  assert.ok(pkg.keywords.includes("windows"));
  assert.equal(pkg.keywords.includes("desktop-widget"), false);
});

test("dashboard JSON-LD scripts parse as valid JSON", () => {
  const index = read("dashboard/index.html");
  const blocks = [...index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]);
  assert.ok(blocks.length > 0, "dashboard/index.html includes JSON-LD");

  const parsed = blocks.map((block, i) => {
    try {
      return JSON.parse(block);
    } catch (err) {
      assert.fail(`JSON-LD block ${i} failed to parse: ${err.message}`);
    }
  });

  const graph = parsed.flatMap((doc) => (Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc]));

  const faq = graph.find((node) => node["@type"] === "FAQPage");
  assert.ok(faq, "JSON-LD includes an FAQPage");
  const supportedClis = (faq.mainEntity || []).find((entity) =>
    entity.name === "Which AI coding CLIs does Token Tracker support?",
  );
  assert.ok(supportedClis, "FAQ includes the supported-CLIs question");
  assert.equal(supportedClis["@type"], "Question");

  const tools = graph.find((node) => node["@type"] === "ItemList" && node.name === "Supported AI coding agent CLIs");
  assert.ok(tools, "JSON-LD includes the coding-tools ItemList");
  assert.ok(Array.isArray(tools.itemListElement), "coding-tools ItemList is an array");
});
