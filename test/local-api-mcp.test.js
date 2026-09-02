"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, describe, it } = require("node:test");

const sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), "tt-localapi-mcp-"));
process.env.HOME = sandboxHome;
process.env.USERPROFILE = sandboxHome;
process.env.LOCALAPPDATA = path.join(sandboxHome, "AppData", "Local");
process.env.CODEX_HOME = path.join(sandboxHome, ".codex");
process.env.GEMINI_HOME = path.join(sandboxHome, ".gemini");
process.env.TOKENTRACKER_GROK_HOME = path.join(sandboxHome, ".grok");
delete process.env.CLAUDE_CONFIG_DIR;
delete process.env.GROK_HOME;

const { createLocalApiHandler } = require("../src/lib/local-api");

const queuePath = path.join(sandboxHome, "queue.jsonl");
fs.writeFileSync(queuePath, "");
const handler = createLocalApiHandler({ queuePath });

function makeReq({ method = "GET", pathname = "/functions/tokentracker-mcp", headers = {}, body }) {
  const url = new URL(`http://localhost${pathname}`);
  const listeners = {};
  const req = {
    method,
    url: url.pathname,
    headers: { host: "localhost", ...headers },
    on(event, fn) { listeners[event] = fn; return req; },
  };
  process.nextTick(() => {
    if (body !== undefined) {
      listeners.data?.(Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
    }
    listeners.end?.();
  });
  return { req, url };
}

function makeRes() {
  const chunks = [];
  let statusCode = 200;
  return {
    get body() { return chunks.join(""); },
    get status() { return statusCode; },
    setHeader() {},
    writeHead(code) { statusCode = code; },
    write(chunk) { chunks.push(chunk); },
    end(chunk) { if (chunk) chunks.push(chunk); },
  };
}

async function call({ method, pathname, headers = {}, body } = {}) {
  const request = makeReq({ method, pathname, headers, body });
  const res = makeRes();
  const handled = await handler(request.req, res, request.url);
  return { handled, status: res.status, body: res.body ? JSON.parse(res.body) : null };
}

describe("/functions/tokentracker-mcp", () => {
  let token;

  before(async () => {
    const result = await call({ pathname: "/api/local-auth" });
    token = result.body.token;
    assert.ok(token);
  });

  after(() => fs.rmSync(sandboxHome, { recursive: true, force: true }));

  it("returns targets and servers scanned from live configuration files", async () => {
    const result = await call();

    assert.equal(result.handled, true);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.servers, []);
    assert.deepEqual(result.body.warnings, []);
    assert.deepEqual(result.body.targets.map((target) => target.id), ["claude", "codex", "gemini", "grok"]);
    assert.equal(Object.hasOwn(result.body, "registryPath"), false);
    assert.equal(fs.existsSync(path.join(sandboxHome, ".tokentracker", "mcp", "servers.json")), false);
  });

  it("requires local mutation authentication", async () => {
    const result = await call({
      method: "POST",
      headers: { origin: "http://localhost:7680" },
      body: { action: "delete", id: "sample" },
    });

    assert.equal(result.status, 401);
    assert.equal(result.body.ok, false);
  });

  it("rejects unknown actions with valid authentication", async () => {
    const result = await call({
      method: "POST",
      headers: {
        origin: "http://localhost:7680",
        "x-tokentracker-local-auth": token,
      },
      body: { action: "sync" },
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Unknown MCP action");
  });

  it("previews live file changes before an authenticated reviewed commit", async () => {
    fs.mkdirSync(path.join(sandboxHome, ".claude"), { recursive: true });
    const configPath = path.join(sandboxHome, ".claude.json");
    fs.rmSync(configPath, { force: true });
    const authHeaders = {
      origin: "http://localhost:7680",
      "x-tokentracker-local-auth": token,
    };
    const operation = {
      action: "upsert",
      server: {
        id: "reviewed-api",
        server: { type: "stdio", command: "node", args: ["reviewed.js"] },
        apps: { claude: true },
      },
    };

    let result = await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "preview", operation },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.match(result.body.reviewToken, /^[a-f0-9]{64}$/);
    assert.equal(result.body.changes.length, 1);
    assert.equal(result.body.changes[0].configPath, configPath);
    assert.ok(result.body.changes[0].lines.some((line) => line.type === "add" && line.newLine === 1));
    assert.equal(fs.existsSync(configPath), false);

    result = await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "commit", operation, reviewToken: result.body.reviewToken },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.equal(config.mcpServers["reviewed-api"].command, "cmd");

    await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "delete", id: "reviewed-api" },
    });
  });

  it("upserts, toggles, and deletes directly in tool configuration files", async () => {
    fs.mkdirSync(path.join(sandboxHome, ".claude"), { recursive: true });
    fs.mkdirSync(path.join(sandboxHome, ".codex"), { recursive: true });
    const authHeaders = {
      origin: "http://localhost:7680",
      "x-tokentracker-local-auth": token,
    };
    const server = {
      id: "api-sample",
      name: "API Sample",
      server: { type: "stdio", command: "node", args: ["server.js"] },
      apps: { claude: true },
    };

    let result = await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "upsert", server },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.server.id, "api-sample");
    let claude = JSON.parse(fs.readFileSync(path.join(sandboxHome, ".claude.json"), "utf8"));
    assert.equal(claude.mcpServers["api-sample"].command, "cmd");
    assert.deepEqual(claude.mcpServers["api-sample"].args, ["/c", "node", "server.js"]);

    result = await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "toggle", id: "api-sample", target: "codex", enabled: true },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.server.apps.codex, true);
    const codexRaw = fs.readFileSync(path.join(sandboxHome, ".codex", "config.toml"), "utf8");
    assert.match(codexRaw, /command = "node"/);
    assert.doesNotMatch(codexRaw, /command = "cmd"/);

    result = await call();
    assert.equal(result.body.servers.length, 1);
    assert.equal(result.body.servers[0].server.command, "node");
    assert.equal(result.body.servers[0].apps.claude, true);
    assert.equal(result.body.servers[0].apps.codex, true);

    result = await call({
      method: "POST",
      headers: authHeaders,
      body: { action: "delete", id: "api-sample" },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.removed, true);

    result = await call();
    assert.deepEqual(result.body.servers, []);
    claude = JSON.parse(fs.readFileSync(path.join(sandboxHome, ".claude.json"), "utf8"));
    assert.equal(claude.mcpServers["api-sample"], undefined);
    const codexAfterDelete = fs.readFileSync(path.join(sandboxHome, ".codex", "config.toml"), "utf8");
    assert.doesNotMatch(codexAfterDelete, /api-sample/);
    assert.equal(fs.existsSync(path.join(sandboxHome, ".tokentracker", "mcp", "servers.json")), false);
  });
});
