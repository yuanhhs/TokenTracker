/**
 * Dual-install cursor ownership probes.
 *
 * When a flat cursor migrates to { native, wsl } namespaces, these probes
 * decide whether an install's DB contains the flat cursor's own session ids —
 * the only evidence that lets the OTHER namespace start empty (full backfill)
 * without risking a double count. Verifies:
 *   - positive match on ids present in the DB
 *   - no match on foreign ids / empty cursor state / missing DB (fail-safe)
 *   - quote characters in ids are escaped, not executed
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const { runSql } = require("./helpers/sqlite-write");

const { gooseInstallOwnsCursor } = require("../src/lib/rollout");

function makeDb(dir, fileName, table, ids) {
  const dbPath = path.join(dir, fileName);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const inserts = ids
    .map((id) => `INSERT INTO ${table} (id) VALUES ('${String(id).replace(/'/g, "''")}');`)
    .join("\n");
  runSql(dbPath, `CREATE TABLE ${table} (id TEXT PRIMARY KEY);\n${inserts}`);
  return dbPath;
}

function tmpdir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("gooseInstallOwnsCursor matches when the DB holds a cursor session id", (t) => {
  const dir = tmpdir(t, "probe-goose-");
  const dbPath = makeDb(dir, "sessions.db", "sessions", ["g1", "g2"]);

  assert.equal(gooseInstallOwnsCursor(dbPath, { sessionTotals: { g2: { input: 1 } } }), true);
  assert.equal(gooseInstallOwnsCursor(dbPath, { sessionTotals: { other: { input: 1 } } }), false);
  assert.equal(gooseInstallOwnsCursor(dbPath, { sessionTotals: {} }), false, "empty cursor = no evidence");
  assert.equal(gooseInstallOwnsCursor(dbPath, {}), false);
  assert.equal(gooseInstallOwnsCursor(path.join(dir, "missing.db"), { sessionTotals: { g1: {} } }), false);
  assert.equal(gooseInstallOwnsCursor(null, { sessionTotals: { g1: {} } }), false);
});

test("ownership probes escape quote characters in ids", (t) => {
  const dir = tmpdir(t, "probe-quote-");
  const weird = "id'); DROP TABLE sessions;--";
  const dbPath = makeDb(dir, "sessions.db", "sessions", [weird]);

  assert.equal(gooseInstallOwnsCursor(dbPath, { sessionTotals: { [weird]: {} } }), true);
  // Table intact after the probe
  const out = cp.execFileSync("sqlite3", [dbPath, "SELECT COUNT(*) FROM sessions;"], {
    encoding: "utf8",
  });
  assert.equal(out.trim(), "1");
});
