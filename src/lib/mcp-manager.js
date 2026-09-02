const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const TOML = require("@iarna/toml");

const { writeFileAtomic } = require("./fs");
const { resolveGeminiConfigDir, resolveGeminiSettingsPath } = require("./gemini-config");
const { resolveGrokHome } = require("./grok-hook");

const TARGET_IDS = ["claude", "codex", "gemini", "grok"];
const SERVER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const WINDOWS_WRAP_COMMANDS = new Set(["npx", "npm", "yarn", "pnpm", "node", "bun", "deno"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function contextFrom(options = {}) {
  return {
    home: options.home || os.homedir(),
    env: options.env || process.env,
    platform: options.platform || process.platform,
  };
}

function resolveClaudeDir({ home, env }) {
  const explicit = String(env.CLAUDE_CONFIG_DIR || "").trim();
  return explicit ? path.resolve(explicit) : path.join(home, ".claude");
}

function resolveClaudeMcpPath(context) {
  const explicit = String(context.env.CLAUDE_CONFIG_DIR || "").trim();
  return explicit
    ? path.join(path.resolve(explicit), ".claude.json")
    : path.join(context.home, ".claude.json");
}

function resolveCodexDir({ home, env }) {
  const explicit = String(env.CODEX_HOME || "").trim();
  return explicit ? path.resolve(explicit) : path.join(home, ".codex");
}

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
}

function resolveMcpTargets(options = {}) {
  const context = contextFrom(options);
  const claudeDir = resolveClaudeDir(context);
  const claudePath = resolveClaudeMcpPath(context);
  const codexDir = resolveCodexDir(context);
  const geminiDir = resolveGeminiConfigDir({ home: context.home, env: context.env });
  const grokDir = String(context.env.TOKENTRACKER_GROK_HOME || context.env.GROK_HOME || "").trim()
    ? resolveGrokHome(context.env)
    : path.join(context.home, ".grok");
  const definitions = [
    { id: "claude", label: "Claude", dir: claudeDir, configPath: claudePath },
    { id: "codex", label: "Codex", dir: codexDir, configPath: path.join(codexDir, "config.toml") },
    {
      id: "gemini",
      label: "Gemini",
      dir: geminiDir,
      configPath: resolveGeminiSettingsPath({ configDir: geminiDir }),
    },
    { id: "grok", label: "Grok", dir: grokDir, configPath: path.join(grokDir, "config.toml") },
  ];
  return definitions.map((target) => ({
    ...target,
    installed: pathExists(target.dir) || pathExists(target.configPath),
  }));
}

function defaultApps() {
  return Object.fromEntries(TARGET_IDS.map((id) => [id, false]));
}

function normalizeStringMap(value, field) {
  if (value == null) return undefined;
  if (!isPlainObject(value)) throw new Error(`${field} must be an object`);
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") throw new Error(`${field}.${key} must be a string`);
    result[String(key)] = entry;
  }
  return result;
}

function normalizeServerSpec(raw) {
  if (!isPlainObject(raw)) throw new Error("MCP server configuration must be an object");
  const type = String(raw.type || (raw.command ? "stdio" : raw.url ? "sse" : "stdio")).toLowerCase();
  if (!new Set(["stdio", "http", "sse"]).has(type)) {
    throw new Error("MCP server type must be stdio, http, or sse");
  }

  const spec = { ...raw, type };
  if (type === "stdio") {
    const command = String(raw.command || "").trim();
    if (!command) throw new Error("stdio MCP servers require a command");
    spec.command = command;
    if (raw.args != null) {
      if (!Array.isArray(raw.args) || raw.args.some((entry) => typeof entry !== "string")) {
        throw new Error("MCP args must be an array of strings");
      }
      spec.args = raw.args.slice();
    }
    const env = normalizeStringMap(raw.env, "env");
    if (env) spec.env = env;
  } else {
    const url = String(raw.url || "").trim();
    if (!url) throw new Error(`${type} MCP servers require a URL`);
    spec.url = url;
    const headers = normalizeStringMap(raw.headers, "headers");
    if (headers) spec.headers = headers;
  }
  return spec;
}

function normalizeMcpServer(raw) {
  if (!isPlainObject(raw)) throw new Error("MCP server must be an object");
  const id = String(raw.id || "").trim();
  if (!SERVER_ID_PATTERN.test(id)) {
    throw new Error("MCP server ID must start with a letter or number and use only letters, numbers, dots, dashes, or underscores");
  }
  const apps = defaultApps();
  for (const targetId of TARGET_IDS) apps[targetId] = Boolean(raw.apps?.[targetId]);
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20)
    : [];
  return {
    id,
    name: String(raw.name || id).trim() || id,
    server: normalizeServerSpec(raw.server),
    apps,
    ...(String(raw.description || "").trim()
      ? { description: String(raw.description).trim() }
      : {}),
    ...(tags.length ? { tags } : {}),
  };
}

function sortedServers(map) {
  return [...map.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.id.localeCompare(right.id),
  );
}

async function readTextIfPresent(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function splitDiffLines(text) {
  if (!text) return [];
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function buildLineDiff(before, after) {
  const oldLines = splitDiffLines(before);
  const newLines = splitDiffLines(after);
  let prefixLength = 0;
  while (
    prefixLength < oldLines.length &&
    prefixLength < newLines.length &&
    oldLines[prefixLength] === newLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < oldLines.length - prefixLength &&
    suffixLength < newLines.length - prefixLength &&
    oldLines[oldLines.length - 1 - suffixLength] === newLines[newLines.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const oldMiddle = oldLines.slice(prefixLength, oldLines.length - suffixLength);
  const newMiddle = newLines.slice(prefixLength, newLines.length - suffixLength);
  const middle = [];
  const cellCount = oldMiddle.length * newMiddle.length;

  if (cellCount <= 4_000_000) {
    const lengths = Array.from(
      { length: oldMiddle.length + 1 },
      () => new Uint32Array(newMiddle.length + 1),
    );
    for (let oldIndex = oldMiddle.length - 1; oldIndex >= 0; oldIndex -= 1) {
      for (let newIndex = newMiddle.length - 1; newIndex >= 0; newIndex -= 1) {
        lengths[oldIndex][newIndex] = oldMiddle[oldIndex] === newMiddle[newIndex]
          ? lengths[oldIndex + 1][newIndex + 1] + 1
          : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
      }
    }

    let oldIndex = 0;
    let newIndex = 0;
    while (oldIndex < oldMiddle.length || newIndex < newMiddle.length) {
      if (
        oldIndex < oldMiddle.length &&
        newIndex < newMiddle.length &&
        oldMiddle[oldIndex] === newMiddle[newIndex]
      ) {
        middle.push({ type: "context", text: oldMiddle[oldIndex] });
        oldIndex += 1;
        newIndex += 1;
      } else if (
        newIndex >= newMiddle.length ||
        (oldIndex < oldMiddle.length && lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1])
      ) {
        middle.push({ type: "remove", text: oldMiddle[oldIndex] });
        oldIndex += 1;
      } else {
        middle.push({ type: "add", text: newMiddle[newIndex] });
        newIndex += 1;
      }
    }
  } else {
    for (const line of oldMiddle) middle.push({ type: "remove", text: line });
    for (const line of newMiddle) middle.push({ type: "add", text: line });
  }

  const entries = [
    ...oldLines.slice(0, prefixLength).map((text) => ({ type: "context", text })),
    ...middle,
    ...oldLines.slice(oldLines.length - suffixLength).map((text) => ({ type: "context", text })),
  ];
  let oldLine = 1;
  let newLine = 1;
  return entries.map((entry) => {
    if (entry.type === "add") {
      const result = { ...entry, oldLine: null, newLine };
      newLine += 1;
      return result;
    }
    if (entry.type === "remove") {
      const result = { ...entry, oldLine, newLine: null };
      oldLine += 1;
      return result;
    }
    const result = { ...entry, oldLine, newLine };
    oldLine += 1;
    newLine += 1;
    return result;
  });
}

function buildMcpChange(target, before, after) {
  const lines = buildLineDiff(before, after);
  return {
    target: target.id,
    label: target.label,
    configPath: target.configPath,
    beforeHash: hashText(before),
    afterHash: hashText(after),
    additions: lines.filter((line) => line.type === "add").length,
    deletions: lines.filter((line) => line.type === "remove").length,
    lines,
  };
}

function projectionResult(target, status, projection, options = {}) {
  const changed = projection && projection.before !== projection.after;
  return {
    target: target.id,
    status: changed ? status : "unchanged",
    ...(options.previewOnly && changed
      ? { change: buildMcpChange(target, projection.before, projection.after) }
      : {}),
  };
}

function ensureRootObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} root must be an object`);
  return value;
}

async function readJsonConfig(filePath, { label }) {
  const raw = await readTextIfPresent(filePath);
  if (raw == null || !raw.trim()) return { raw: raw || "", value: {} };
  try {
    const value = JSON.parse(raw);
    return { raw, value: ensureRootObject(value, label) };
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

async function writeJsonSection({
  filePath,
  section,
  id,
  value,
  remove = false,
  label,
  previewOnly = false,
}) {
  const current = await readJsonConfig(filePath, { label });
  const root = current.value;
  const existing = isPlainObject(root[section]) ? { ...root[section] } : {};
  if (remove) delete existing[id];
  else existing[id] = value;
  root[section] = existing;
  const output = `${JSON.stringify(root, null, 2)}\n`;
  if (!previewOnly && current.raw !== output) await writeFileAtomic(filePath, output);
  return { before: current.raw, after: output };
}

function withoutMetadata(spec) {
  const result = { ...spec };
  for (const key of ["id", "name", "description", "tags", "apps", "enabled", "source"]) {
    delete result[key];
  }
  return result;
}

function wrapClaudeWindowsCommand(spec, target, options = {}) {
  const context = contextFrom(options);
  if (context.platform !== "win32" || spec.type !== "stdio") return spec;
  if (/^\\\\wsl(?:\$|\.localhost)\\/i.test(target.configPath)) return spec;
  const command = String(spec.command || "");
  const leaf = path.win32.basename(command).replace(/\.(?:cmd|exe)$/i, "").toLowerCase();
  if (!WINDOWS_WRAP_COMMANDS.has(leaf) || /^cmd(?:\.exe)?$/i.test(command)) return spec;
  return {
    ...spec,
    command: "cmd",
    args: ["/c", command, ...(Array.isArray(spec.args) ? spec.args : [])],
  };
}

function toClaudeSpec(spec, target, options) {
  const result = wrapClaudeWindowsCommand(withoutMetadata(spec), target, options);
  delete result.type;
  return result;
}

function fromClaudeSpec(raw, options = {}) {
  if (!isPlainObject(raw)) return raw;
  const spec = { ...raw, type: raw.type || (raw.command ? "stdio" : "sse") };
  const context = contextFrom(options);
  if (context.platform !== "win32" || spec.type !== "stdio") return spec;
  const command = String(spec.command || "");
  const args = Array.isArray(spec.args) ? spec.args.map(String) : [];
  const wrappedCommand = String(args[1] || "");
  const wrappedLeaf = path.win32.basename(wrappedCommand).replace(/\.(?:cmd|exe)$/i, "").toLowerCase();
  if (/^cmd(?:\.exe)?$/i.test(command) && /^\/c$/i.test(String(args[0] || "")) && WINDOWS_WRAP_COMMANDS.has(wrappedLeaf)) {
    spec.command = wrappedCommand;
    spec.args = args.slice(2);
  }
  return spec;
}

function toGeminiSpec(spec) {
  const result = withoutMetadata(spec);
  const type = result.type || "stdio";
  delete result.type;
  if (type === "http" && result.url) {
    result.httpUrl = result.url;
    delete result.url;
  }
  const timeoutValues = [
    Number(result.startup_timeout_sec) * 1000,
    Number(result.startup_timeout_ms),
    Number(result.tool_timeout_sec) * 1000,
    Number(result.tool_timeout_ms),
    Number(result.timeout),
  ].filter((value) => Number.isFinite(value) && value > 0);
  for (const key of [
    "startup_timeout_sec",
    "startup_timeout_ms",
    "tool_timeout_sec",
    "tool_timeout_ms",
  ]) delete result[key];
  if (timeoutValues.length) result.timeout = Math.max(...timeoutValues);
  return result;
}

function parseTomlPath(source) {
  const parts = [];
  let token = "";
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (quote) {
      token += character;
      if (escaped) escaped = false;
      else if (character === "\\" && quote === '"') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      token += character;
    } else if (character === ".") {
      parts.push(unquoteTomlPathToken(token.trim()));
      token = "";
    } else {
      token += character;
    }
  }
  if (token.trim()) parts.push(unquoteTomlPathToken(token.trim()));
  return parts;
}

function unquoteTomlPathToken(token) {
  if (token.startsWith('"') && token.endsWith('"')) {
    try {
      return JSON.parse(token);
    } catch (_error) {
      return token.slice(1, -1);
    }
  }
  if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1);
  return token;
}

function headerMatchesServer(parts, id, prefixes) {
  return prefixes.some((prefix) =>
    parts.length > prefix.length &&
    prefix.every((part, index) => parts[index] === part) &&
    parts[prefix.length] === id,
  );
}

function removeTomlServerBlocks(text, id, prefixes) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const headers = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/);
    if (match) headers.push({ index, parts: parseTomlPath(match[1]) });
  }
  const remove = new Set();
  for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
    const header = headers[headerIndex];
    if (!headerMatchesServer(header.parts, id, prefixes)) continue;
    const end = headers[headerIndex + 1]?.index ?? lines.length;
    for (let index = header.index; index < end; index += 1) remove.add(index);
  }
  const output = lines.filter((_line, index) => !remove.has(index));
  while (output.length && output[output.length - 1] === "") output.pop();
  return { text: output.join(eol), eol };
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function tomlScalar(value) {
  if (typeof value === "string") return tomlString(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(tomlScalar).join(", ")}]`;
  if (isPlainObject(value)) {
    return `{ ${Object.entries(value).map(([key, entry]) => `${tomlString(key)} = ${tomlScalar(entry)}`).join(", ")} }`;
  }
  return null;
}

function serializeTomlServer(id, spec, { grok = false, eol = "\n" } = {}) {
  const header = `[mcp_servers.${tomlString(id)}]`;
  const lines = [header];
  const nested = [];
  if (!grok) lines.push(`type = ${tomlString(spec.type || "stdio")}`);
  if (spec.type === "stdio") {
    lines.push(`command = ${tomlString(spec.command)}`);
    if (spec.args?.length) lines.push(`args = ${tomlScalar(spec.args)}`);
    if (spec.cwd) lines.push(`cwd = ${tomlString(spec.cwd)}`);
    if (spec.env && Object.keys(spec.env).length) nested.push(["env", spec.env]);
  } else {
    lines.push(`url = ${tomlString(spec.url)}`);
    if (spec.headers && Object.keys(spec.headers).length) {
      nested.push([grok ? "headers" : "http_headers", spec.headers]);
    }
  }

  const handled = new Set(["type", "command", "args", "cwd", "env", "url", "headers"]);
  for (const [key, value] of Object.entries(spec)) {
    if (handled.has(key)) continue;
    const encoded = tomlScalar(value);
    if (encoded != null) lines.push(`${key} = ${encoded}`);
  }
  for (const [section, values] of nested) {
    lines.push("", `[mcp_servers.${tomlString(id)}.${section}]`);
    for (const [key, value] of Object.entries(values)) lines.push(`${tomlString(key)} = ${tomlString(value)}`);
  }
  return lines.join(eol);
}

async function updateTomlServer(target, id, spec, { remove = false, grok = false, previewOnly = false } = {}) {
  const original = (await readTextIfPresent(target.configPath)) || "";
  if (original.trim()) {
    try {
      TOML.parse(original);
    } catch (error) {
      throw new Error(`${target.label} config.toml is invalid: ${error.message}`);
    }
  }
  const prefixes = grok ? [["mcp_servers"]] : [["mcp_servers"], ["mcp", "servers"]];
  const stripped = removeTomlServerBlocks(original, id, prefixes);
  let output = stripped.text;
  if (!remove) {
    if (output.trim()) output += `${stripped.eol}${stripped.eol}`;
    output += serializeTomlServer(id, spec, { grok, eol: stripped.eol });
  }
  if (output) output += stripped.eol;
  let parsedOutput;
  try {
    parsedOutput = TOML.parse(output);
  } catch (error) {
    throw new Error(`${target.label} config.toml cannot be updated safely: ${error.message}`);
  }
  const projected = grok
    ? parsedOutput.mcp_servers?.[id]
    : (parsedOutput.mcp_servers?.[id] ?? parsedOutput.mcp?.servers?.[id]);
  if (remove && projected !== undefined) {
    throw new Error(`${target.label} config.toml uses an unsupported inline MCP table; the original file was kept`);
  }
  if (!remove && projected === undefined) {
    throw new Error(`${target.label} config.toml did not accept the projected MCP server`);
  }
  if (!previewOnly && original !== output) await writeFileAtomic(target.configPath, output);
  return { before: original, after: output };
}

async function syncServerToTarget(server, target, options = {}) {
  if (!target.installed) return { target: target.id, status: "skipped" };
  let projection;
  if (target.id === "claude") {
    projection = await writeJsonSection({
      filePath: target.configPath,
      section: "mcpServers",
      id: server.id,
      value: toClaudeSpec(server.server, target, options),
      label: "Claude .claude.json",
      previewOnly: options.previewOnly,
    });
  } else if (target.id === "codex") {
    projection = await updateTomlServer(target, server.id, server.server, { previewOnly: options.previewOnly });
  } else if (target.id === "gemini") {
    projection = await writeJsonSection({
      filePath: target.configPath,
      section: "mcpServers",
      id: server.id,
      value: toGeminiSpec(server.server),
      label: "Gemini settings.json",
      previewOnly: options.previewOnly,
    });
  } else if (target.id === "grok") {
    projection = await updateTomlServer(target, server.id, server.server, {
      grok: true,
      previewOnly: options.previewOnly,
    });
  }
  return projectionResult(target, "synced", projection, options);
}

async function removeServerFromTarget(id, target, options = {}) {
  if (!target.installed || !pathExists(target.configPath)) {
    return { target: target.id, status: "skipped" };
  }
  const entries = await importTarget(target, options);
  if (!entries.some((entry) => entry.id === id)) {
    return { target: target.id, status: "not-found" };
  }
  let projection;
  if (target.id === "claude") {
    projection = await writeJsonSection({ filePath: target.configPath, section: "mcpServers", id, remove: true, label: "Claude .claude.json", previewOnly: options.previewOnly });
  } else if (target.id === "codex") {
    projection = await updateTomlServer(target, id, null, { remove: true, previewOnly: options.previewOnly });
  } else if (target.id === "gemini") {
    projection = await writeJsonSection({ filePath: target.configPath, section: "mcpServers", id, remove: true, label: "Gemini settings.json", previewOnly: options.previewOnly });
  } else if (target.id === "grok") {
    projection = await updateTomlServer(target, id, null, { remove: true, grok: true, previewOnly: options.previewOnly });
  }
  return projectionResult(target, "removed", projection, options);
}

async function runProjectionTasks(tasks) {
  const results = [];
  const warnings = [];
  for (const task of tasks) {
    try {
      results.push(await task.run());
    } catch (error) {
      warnings.push(`${task.label}: ${error.message}`);
    }
  }
  return { results, warnings };
}

function publicTarget(target) {
  return {
    id: target.id,
    label: target.label,
    installed: target.installed,
    configPath: target.configPath,
  };
}

async function getMcpState(options = {}) {
  const { servers, warnings } = await readLiveMcpServers(options);
  return {
    targets: resolveMcpTargets(options).map(publicTarget),
    servers: sortedServers(servers),
    warnings,
  };
}

async function upsertMcpServer(rawServer, options = {}) {
  const server = normalizeMcpServer(rawServer);
  const tasks = resolveMcpTargets(options).map((target) => ({
    label: target.label,
    run: () => server.apps[target.id]
      ? syncServerToTarget(server, target, options)
      : removeServerFromTarget(server.id, target, options),
  }));
  return { server, ...(await runProjectionTasks(tasks)) };
}

async function toggleMcpTarget(id, targetId, enabled, options = {}) {
  if (!TARGET_IDS.includes(targetId)) throw new Error(`Unsupported MCP target: ${targetId}`);
  const { servers } = await readLiveMcpServers(options);
  const current = servers.get(String(id));
  if (!current) throw new Error(`MCP server not found: ${id}`);
  const server = { ...current, apps: { ...current.apps, [targetId]: Boolean(enabled) } };
  const target = resolveMcpTargets(options).find((entry) => entry.id === targetId);
  const tasks = [{
    label: target.label,
    run: () => enabled
      ? syncServerToTarget(server, target, options)
      : removeServerFromTarget(server.id, target, options),
  }];
  return { server, ...(await runProjectionTasks(tasks)) };
}

async function deleteMcpServer(id, options = {}) {
  const serverId = String(id || "").trim();
  if (!SERVER_ID_PATTERN.test(serverId)) throw new Error("Invalid MCP server ID");
  const tasks = resolveMcpTargets(options).map((target) => ({
    label: target.label,
    run: () => removeServerFromTarget(serverId, target, options),
  }));
  return { removed: true, ...(await runProjectionTasks(tasks)) };
}

async function runMcpOperation(operation, options = {}) {
  const action = String(operation?.action || "");
  if (action === "upsert") return upsertMcpServer(operation.server, options);
  if (action === "toggle") {
    return toggleMcpTarget(operation.id, operation.target, Boolean(operation.enabled), options);
  }
  if (action === "delete") return deleteMcpServer(operation.id, options);
  throw new Error("Unknown MCP operation");
}

function reviewTokenForChanges(changes) {
  const fingerprints = changes.map((change) => ({
    target: change.target,
    configPath: change.configPath,
    beforeHash: change.beforeHash,
    afterHash: change.afterHash,
  }));
  return hashText(JSON.stringify(fingerprints));
}

async function previewMcpMutation(operation, options = {}) {
  const projected = await runMcpOperation(operation, { ...options, previewOnly: true });
  const changes = [];
  const results = (projected.results || []).map((result) => {
    const { change, ...publicResult } = result;
    if (change) changes.push(change);
    return publicResult;
  });
  return {
    ...projected,
    results,
    changes,
    reviewToken: reviewTokenForChanges(changes),
  };
}

async function commitMcpMutation(operation, reviewToken, options = {}) {
  const expectedToken = String(reviewToken || "").trim();
  if (!/^[a-f0-9]{64}$/.test(expectedToken)) throw new Error("A valid MCP review token is required");
  const latestPreview = await previewMcpMutation(operation, options);
  if (latestPreview.reviewToken !== expectedToken) {
    throw new Error("An MCP configuration file changed after review. Review the latest diff before writing.");
  }
  return runMcpOperation(operation, options);
}

function fromGeminiSpec(raw) {
  const spec = { ...raw };
  if (spec.httpUrl) {
    spec.url = spec.httpUrl;
    spec.type = "http";
    delete spec.httpUrl;
  } else if (!spec.type) {
    spec.type = spec.command ? "stdio" : "sse";
  }
  return spec;
}

function fromTomlSpec(raw, { grok = false } = {}) {
  const spec = { ...raw };
  if (spec.http_headers) {
    spec.headers = spec.http_headers;
    delete spec.http_headers;
  }
  if (!spec.type) spec.type = spec.command ? "stdio" : "http";
  if (grok && spec.headers) spec.headers = { ...spec.headers };
  return spec;
}

async function importTarget(target, options = {}) {
  const text = await readTextIfPresent(target.configPath);
  if (text == null || !text.trim()) return [];
  let entries = {};
  if (target.id === "claude") {
    entries = (await readJsonConfig(target.configPath, { label: "Claude .claude.json" })).value.mcpServers || {};
    return Object.entries(entries).map(([id, spec]) => ({ id, spec: fromClaudeSpec(spec, options) }));
  }
  if (target.id === "gemini") {
    entries = (await readJsonConfig(target.configPath, { label: "Gemini settings.json" })).value.mcpServers || {};
    return Object.entries(entries).map(([id, spec]) => ({ id, spec: fromGeminiSpec(spec) }));
  }
  let root;
  try {
    root = TOML.parse(text);
  } catch (error) {
    throw new Error(`${target.label} config.toml is invalid: ${error.message}`);
  }
  entries = target.id === "codex"
    ? { ...(root.mcp?.servers || {}), ...(root.mcp_servers || {}) }
    : (root.mcp_servers || {});
  return Object.entries(entries).map(([id, spec]) => ({
    id,
    spec: fromTomlSpec(spec, { grok: target.id === "grok" }),
  }));
}

function specsEqual(left, right) {
  return isDeepStrictEqual(left, right);
}

async function readLiveMcpServers(options = {}) {
  const servers = new Map();
  const warnings = [];
  for (const target of resolveMcpTargets(options)) {
    if (!target.installed) continue;
    let entries;
    try {
      entries = await importTarget(target, options);
    } catch (error) {
      warnings.push(`${target.label}: ${error.message}`);
      continue;
    }
    for (const entry of entries) {
      let spec;
      try {
        spec = normalizeServerSpec(entry.spec);
        if (!SERVER_ID_PATTERN.test(entry.id)) throw new Error("unsupported server ID");
      } catch (error) {
        warnings.push(`${target.label}/${entry.id}: ${error.message}`);
        continue;
      }
      const existing = servers.get(entry.id);
      if (existing) {
        existing.apps[target.id] = true;
        if (!specsEqual(existing.server, spec)) {
          warnings.push(`${target.label}/${entry.id}: configuration differs from ${existing.sourceLabel}`);
        }
      } else {
        servers.set(entry.id, {
          id: entry.id,
          name: entry.id,
          server: spec,
          apps: { ...defaultApps(), [target.id]: true },
          sourceLabel: target.label,
        });
      }
    }
  }
  for (const server of servers.values()) delete server.sourceLabel;
  return { servers, warnings };
}

module.exports = {
  TARGET_IDS,
  resolveMcpTargets,
  getMcpState,
  upsertMcpServer,
  toggleMcpTarget,
  deleteMcpServer,
  previewMcpMutation,
  commitMcpMutation,
  // Exported for focused format tests; not part of the local API contract.
  normalizeServerSpec,
  buildLineDiff,
  removeTomlServerBlocks,
  serializeTomlServer,
};
