"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const TOML = require("@iarna/toml");

const mcp = require("../src/lib/mcp-manager");

function sandbox(t, { platform = "linux", targets = [] } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tt-mcp-manager-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const env = {
    HOME: home,
    USERPROFILE: home,
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    TOKENTRACKER_GROK_HOME: path.join(home, ".grok"),
  };
  const options = { home, env, platform };
  const byId = Object.fromEntries(mcp.resolveMcpTargets(options).map((target) => [target.id, target]));
  for (const id of targets) fs.mkdirSync(byId[id].dir, { recursive: true });
  return { home, options, targets: byId };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function stdioServer(id, apps = {}, overrides = {}) {
  return {
    id,
    name: overrides.name || id,
    description: overrides.description,
    server: {
      type: "stdio",
      command: overrides.command || "node",
      args: overrides.args || ["server.js"],
      ...(overrides.env ? { env: overrides.env } : {}),
    },
    apps,
  };
}

function registryPath(home) {
  return path.join(home, ".tokentracker", "mcp", "servers.json");
}

describe("mcp-manager live configuration", () => {
  it("scans installed tools directly and merges the same ID across configurations", async (t) => {
    const box = sandbox(t, { targets: ["claude", "codex", "gemini"] });
    writeJson(box.targets.claude.configPath, {
      theme: "dark",
      mcpServers: {
        shared: { command: "node", args: ["shared.js"] },
        "claude-only": { command: "node", args: ["claude.js"] },
      },
    });
    fs.writeFileSync(
      box.targets.codex.configPath,
      "model = \"gpt-5\"\n\n[mcp_servers.shared]\ntype = \"stdio\"\ncommand = \"node\"\nargs = [\"shared.js\"]\n",
    );
    writeJson(box.targets.gemini.configPath, {
      mcpServers: { shared: { command: "node", args: ["shared.js"] } },
    });

    const state = await mcp.getMcpState(box.options);

    assert.equal(Object.hasOwn(state, "registryPath"), false);
    assert.deepEqual(state.warnings, []);
    assert.deepEqual(state.servers.map((server) => server.id), ["claude-only", "shared"]);
    const shared = state.servers.find((server) => server.id === "shared");
    assert.equal(shared.server.command, "node");
    assert.equal(shared.apps.claude, true);
    assert.equal(shared.apps.codex, true);
    assert.equal(shared.apps.gemini, true);
    assert.equal(shared.apps.grok, false);
    assert.equal(fs.existsSync(registryPath(box.home)), false);
  });

  it("previews exact line-numbered changes without writing and commits the reviewed projection", async (t) => {
    const box = sandbox(t, { targets: ["claude", "codex"] });
    writeJson(box.targets.claude.configPath, {
      theme: "dark",
      mcpServers: { external: { command: "echo" } },
    });
    fs.writeFileSync(box.targets.codex.configPath, "model = \"gpt-5\"\n");
    const beforeClaude = fs.readFileSync(box.targets.claude.configPath, "utf8");
    const beforeCodex = fs.readFileSync(box.targets.codex.configPath, "utf8");
    const operation = {
      action: "upsert",
      server: stdioServer("sample", { claude: true, codex: true }, {
        command: "npx",
        args: ["-y", "sample-mcp"],
      }),
    };

    const preview = await mcp.previewMcpMutation(operation, box.options);

    assert.match(preview.reviewToken, /^[a-f0-9]{64}$/);
    assert.equal(preview.changes.length, 2);
    assert.equal(fs.readFileSync(box.targets.claude.configPath, "utf8"), beforeClaude);
    assert.equal(fs.readFileSync(box.targets.codex.configPath, "utf8"), beforeCodex);
    const claudeChange = preview.changes.find((change) => change.target === "claude");
    const codexChange = preview.changes.find((change) => change.target === "codex");
    assert.equal(claudeChange.configPath, box.targets.claude.configPath);
    assert.ok(claudeChange.additions > 0);
    assert.ok(claudeChange.lines.some((line) =>
      line.type === "add" && line.newLine > 0 && line.text.includes('"sample"')));
    assert.ok(codexChange.lines.some((line) =>
      line.type === "add" && line.newLine > 0 && line.text.includes('[mcp_servers."sample"]')));

    await mcp.commitMcpMutation(operation, preview.reviewToken, box.options);

    const claude = JSON.parse(fs.readFileSync(box.targets.claude.configPath, "utf8"));
    assert.equal(claude.mcpServers.sample.command, "npx");
    const codex = TOML.parse(fs.readFileSync(box.targets.codex.configPath, "utf8"));
    assert.equal(codex.mcp_servers.sample.command, "npx");
  });

  it("rejects a reviewed commit when a live configuration changed after preview", async (t) => {
    const box = sandbox(t, { targets: ["claude"] });
    writeJson(box.targets.claude.configPath, { theme: "dark" });
    const operation = {
      action: "upsert",
      server: stdioServer("sample", { claude: true }),
    };
    const preview = await mcp.previewMcpMutation(operation, box.options);
    writeJson(box.targets.claude.configPath, { theme: "light" });

    await assert.rejects(
      mcp.commitMcpMutation(operation, preview.reviewToken, box.options),
      /changed after review/,
    );

    const current = JSON.parse(fs.readFileSync(box.targets.claude.configPath, "utf8"));
    assert.equal(current.theme, "light");
    assert.equal(current.mcpServers, undefined);
  });

  it("upserts selected live configs and removes the same ID from unselected configs", async (t) => {
    const box = sandbox(t, { targets: ["claude", "codex", "gemini"] });
    writeJson(box.targets.claude.configPath, {
      theme: "dark",
      mcpServers: { external: { command: "echo", args: ["external"] } },
    });
    fs.writeFileSync(
      box.targets.codex.configPath,
      "model = \"gpt-5\"\r\n\r\n[mcp_servers.external]\r\ncommand = \"echo\"\r\nargs = [\"external\"]\r\n",
    );
    writeJson(box.targets.gemini.configPath, {
      ui: { density: "compact" },
      mcpServers: {
        external: { command: "echo", args: ["external"] },
        sample: { command: "stale" },
      },
    });

    const result = await mcp.upsertMcpServer(stdioServer("sample", {
      claude: true,
      codex: true,
      gemini: false,
    }, { command: "npx", args: ["-y", "sample-mcp"], env: { TOKEN: "secret" } }), box.options);

    assert.deepEqual(result.warnings, []);
    const claude = JSON.parse(fs.readFileSync(box.targets.claude.configPath, "utf8"));
    assert.equal(claude.theme, "dark");
    assert.equal(claude.mcpServers.external.command, "echo");
    assert.equal(claude.mcpServers.sample.command, "npx");
    assert.deepEqual(claude.mcpServers.sample.env, { TOKEN: "secret" });

    const codexRaw = fs.readFileSync(box.targets.codex.configPath, "utf8");
    const codex = TOML.parse(codexRaw);
    assert.equal(codex.model, "gpt-5");
    assert.equal(codex.mcp_servers.external.command, "echo");
    assert.equal(codex.mcp_servers.sample.type, "stdio");
    assert.deepEqual(codex.mcp_servers.sample.args, ["-y", "sample-mcp"]);
    assert.equal(codexRaw.includes("\r\n"), true);

    const gemini = JSON.parse(fs.readFileSync(box.targets.gemini.configPath, "utf8"));
    assert.equal(gemini.ui.density, "compact");
    assert.equal(gemini.mcpServers.external.command, "echo");
    assert.equal(gemini.mcpServers.sample, undefined);

    const state = await mcp.getMcpState(box.options);
    const sample = state.servers.find((server) => server.id === "sample");
    assert.equal(sample.apps.claude, true);
    assert.equal(sample.apps.codex, true);
    assert.equal(sample.apps.gemini, false);
    assert.equal(fs.existsSync(registryPath(box.home)), false);
  });

  it("toggles a server by reading its definition from the live configurations", async (t) => {
    const box = sandbox(t, { targets: ["claude", "codex"] });
    writeJson(box.targets.claude.configPath, {
      mcpServers: { sample: { command: "node", args: ["server.js"] } },
    });

    await mcp.toggleMcpTarget("sample", "codex", true, box.options);
    const codex = TOML.parse(fs.readFileSync(box.targets.codex.configPath, "utf8"));
    assert.equal(codex.mcp_servers.sample.command, "node");

    await mcp.toggleMcpTarget("sample", "claude", false, box.options);
    const claude = JSON.parse(fs.readFileSync(box.targets.claude.configPath, "utf8"));
    assert.equal(claude.mcpServers.sample, undefined);

    const state = await mcp.getMcpState(box.options);
    assert.equal(state.servers.length, 1);
    assert.equal(state.servers[0].apps.claude, false);
    assert.equal(state.servers[0].apps.codex, true);
  });

  it("deletes an ID from every live config while preserving unrelated servers", async (t) => {
    const box = sandbox(t, { targets: ["claude", "gemini"] });
    for (const targetId of ["claude", "gemini"]) {
      writeJson(box.targets[targetId].configPath, {
        mcpServers: {
          sample: { command: "node", args: ["server.js"] },
          external: { command: "echo", args: ["keep"] },
        },
      });
    }

    await mcp.deleteMcpServer("sample", box.options);

    for (const targetId of ["claude", "gemini"]) {
      const config = JSON.parse(fs.readFileSync(box.targets[targetId].configPath, "utf8"));
      assert.equal(config.mcpServers.sample, undefined);
      assert.equal(config.mcpServers.external.command, "echo");
    }
    assert.deepEqual((await mcp.getMcpState(box.options)).servers.map((server) => server.id), ["external"]);
  });

  it("keeps the first scanned definition and warns when the same ID differs", async (t) => {
    const box = sandbox(t, { targets: ["claude", "gemini"] });
    writeJson(box.targets.claude.configPath, {
      mcpServers: { shared: { command: "claude-command", args: ["one"] } },
    });
    writeJson(box.targets.gemini.configPath, {
      mcpServers: { shared: { command: "gemini-command", args: ["two"] } },
    });

    const state = await mcp.getMcpState(box.options);

    assert.equal(state.servers.length, 1);
    assert.equal(state.servers[0].server.command, "claude-command");
    assert.equal(state.servers[0].apps.claude, true);
    assert.equal(state.servers[0].apps.gemini, true);
    assert.equal(state.warnings.length, 1);
    assert.match(state.warnings[0], /configuration differs/);
  });

  it("keeps invalid or unsupported TOML untouched and reports warnings", async (t) => {
    const invalid = sandbox(t, { targets: ["codex"] });
    const invalidText = "model = [\n";
    fs.writeFileSync(invalid.targets.codex.configPath, invalidText);

    const invalidState = await mcp.getMcpState(invalid.options);
    assert.deepEqual(invalidState.servers, []);
    assert.equal(invalidState.warnings.length, 1);

    const invalidResult = await mcp.upsertMcpServer(stdioServer("sample", { codex: true }), invalid.options);
    assert.equal(invalidResult.warnings.length, 1);
    assert.equal(fs.readFileSync(invalid.targets.codex.configPath, "utf8"), invalidText);
    assert.deepEqual((await mcp.getMcpState(invalid.options)).servers, []);

    const inline = sandbox(t, { targets: ["codex"] });
    const inlineText = "model = \"gpt-5\"\nmcp_servers = { external = { command = \"echo\" } }\n";
    fs.writeFileSync(inline.targets.codex.configPath, inlineText);

    const inlineResult = await mcp.upsertMcpServer(stdioServer("sample", { codex: true }), inline.options);
    assert.equal(inlineResult.warnings.length, 1);
    assert.equal(fs.readFileSync(inline.targets.codex.configPath, "utf8"), inlineText);
  });

  it("wraps Windows Claude script commands with cmd /c", async (t) => {
    const box = sandbox(t, { platform: "win32", targets: ["claude"] });

    await mcp.upsertMcpServer(stdioServer("sample", { claude: true }, {
      command: "npx",
      args: ["-y", "sample-mcp"],
    }), box.options);

    const config = JSON.parse(fs.readFileSync(box.targets.claude.configPath, "utf8"));
    assert.equal(config.mcpServers.sample.command, "cmd");
    assert.deepEqual(config.mcpServers.sample.args, ["/c", "npx", "-y", "sample-mcp"]);
  });

  it("does not create config files or a TokenTracker registry for unselected targets", async (t) => {
    const box = sandbox(t, { targets: ["claude", "codex", "gemini", "grok"] });
    const codexText = "model = \"gpt-5\"\n";
    fs.writeFileSync(box.targets.codex.configPath, codexText);
    writeJson(box.targets.gemini.configPath, { ui: { theme: "dark" } });
    const geminiText = fs.readFileSync(box.targets.gemini.configPath, "utf8");

    await mcp.upsertMcpServer(stdioServer("sample", { claude: true }), box.options);

    assert.equal(fs.existsSync(box.targets.claude.configPath), true);
    assert.equal(fs.readFileSync(box.targets.codex.configPath, "utf8"), codexText);
    assert.equal(fs.readFileSync(box.targets.gemini.configPath, "utf8"), geminiText);
    assert.equal(fs.existsSync(box.targets.grok.configPath), false);
    assert.equal(fs.existsSync(registryPath(box.home)), false);
  });
});
