const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const { ensureNamespacedCursors, ensureFlatCursor } = require("../src/lib/install-resolver");
const { multiInstallParse } = require("../src/lib/multi-install-parser");

test("flat cursor migrates to active namespace only", () => {
  const cursors = {
    agent: {
      lastCompletedStartedAt: 100,
      unfinishedSessionIds: ["s1", "s2"],
      snapshots: { s1: { in: 50, out: 25 } },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };

  const ns = ensureNamespacedCursors(cursors, "agent", "wsl");

  assert.ok(ns.native, "native namespace exists (empty)");
  assert.ok(ns.wsl, "wsl namespace exists");
  assert.equal(ns.native.lastCompletedStartedAt, undefined, "non-active namespace starts empty");
  assert.equal(ns.wsl.lastCompletedStartedAt, 100, "active namespace gets flat data");
  assert.deepEqual(ns.wsl.unfinishedSessionIds, ["s1", "s2"]);
  assert.deepEqual(ns.wsl.snapshots, { s1: { in: 50, out: 25 } });

  // Verify nested objects are independent copies
  ns.wsl.snapshots.s2 = { in: 99 };
  ns.wsl.unfinishedSessionIds.push("wsl-only");
  assert.equal(Object.keys(ns.wsl.snapshots).length, 2, "mutations work on wsl snapshots");
});

test("ensureFlatCursor merges namespaces with wsl-first default", () => {
  const cursors = {
    agent: {
      native: { lastCompletedStartedAt: 50, snapshots: {} },
      wsl: { lastCompletedStartedAt: 100, snapshots: {} },
    },
  };

  ensureFlatCursor(cursors, "agent", { TOKENTRACKER_WSL_MODE: "wsl-first" });

  assert.equal(cursors.agent.native, undefined, "native key should be removed");
  assert.equal(cursors.agent.wsl, undefined, "wsl key should be removed");
  assert.equal(cursors.agent.lastCompletedStartedAt, 100, "wsl value should win in wsl-first mode");
});

test("ensureFlatCursor respects native-first mode", () => {
  const cursors = {
    agent: {
      native: { lastCompletedStartedAt: 50, snapshots: {} },
      wsl: { lastCompletedStartedAt: 100, snapshots: {} },
    },
  };

  ensureFlatCursor(cursors, "agent", { TOKENTRACKER_WSL_MODE: "native-first" });

  assert.equal(cursors.agent.lastCompletedStartedAt, 50, "native value should win in native-first mode");
});

test("ensureFlatCursor no-ops on already-flat cursor", () => {
  const cursors = {
    agent: { lastCompletedStartedAt: 50, snapshots: {} },
  };

  ensureFlatCursor(cursors, "agent");

  assert.equal(cursors.agent.lastCompletedStartedAt, 50);
});

function mockParserFn() {
  return async ({ cursors: c }) => {
    c.agent = c.agent || {};
    c.agent.lastRun = c.agent.lastRun || 0;
    c.agent.lastRun += 1;
    c.agent.unfinishedSessionIds = c.agent.unfinishedSessionIds || [];
    c.agent.unfinishedSessionIds.push(`session-${Date.now()}`);
    return { recordsProcessed: 1 };
  };
}

function flatAgentCursors() {
  return {
    hourly: { buckets: {} },
    agent: { lastCompletedStartedAt: 100, unfinishedSessionIds: ["old"], snapshots: {} },
  };
}

async function runDualParse(t, { cursors, detectInstall }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-cursor-migrate-"));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  return await multiInstallParse({
    paths: { native: "/native-agent", wsl: "/wsl-agent" },
    parserFn: mockParserFn(),
    providerName: "agent",
    cursors,
    getParams: (p) => ({ agentPath: p }),
    queuePath: path.join(tmpDir, "queue.jsonl"),
    detectInstall,
  });
}

test("dual-parse migration backfills the unproven install when ownership is detected", async (t) => {
  const cursors = flatAgentCursors();
  const r = await runDualParse(t, {
    cursors,
    // Probe proves the flat cursor's sessions live in the WSL install.
    detectInstall: (installPath) => installPath === "/wsl-agent",
  });

  assert.equal(r.recordsProcessed, 2, "both installs should parse");
  assert.ok(cursors.agent.native.lastRun >= 1);
  assert.ok(cursors.agent.wsl.lastRun >= 1);
  assert.ok(cursors.agent.native.lastCompletedStartedAt === undefined,
    "unproven namespace starts empty so its history backfills");
  assert.ok(cursors.agent.wsl.lastCompletedStartedAt === 100,
    "proven namespace inherited flat cursor data");
});

test("dual-parse migration respects native ownership evidence", async (t) => {
  const cursors = flatAgentCursors();
  await runDualParse(t, {
    cursors,
    detectInstall: (installPath) => installPath === "/native-agent",
  });

  assert.ok(cursors.agent.native.lastCompletedStartedAt === 100,
    "proven native namespace inherited flat cursor data");
  assert.ok(cursors.agent.wsl.lastCompletedStartedAt === undefined,
    "unproven wsl namespace starts empty");
});

test("dual-parse migration seeds both namespaces without a probe", async (t) => {
  const cursors = flatAgentCursors();
  await runDualParse(t, { cursors });

  assert.ok(cursors.agent.native.lastCompletedStartedAt === 100,
    "no probe → native seeded (never double count)");
  assert.ok(cursors.agent.wsl.lastCompletedStartedAt === 100,
    "no probe → wsl seeded (never double count)");
});

test("dual-parse migration seeds both namespaces on ambiguous or failing probes", async (t) => {
  for (const detectInstall of [
    () => true, // both match — ambiguous
    () => false, // neither matches — no evidence
    () => { throw new Error("db locked"); }, // probe error
  ]) {
    const cursors = flatAgentCursors();
    await runDualParse(t, { cursors, detectInstall });
    assert.ok(cursors.agent.native.lastCompletedStartedAt === 100,
      "fallback seeds native with flat data");
    assert.ok(cursors.agent.wsl.lastCompletedStartedAt === 100,
      "fallback seeds wsl with flat data");
  }
});

test("dual-parse skips detection for already-namespaced cursors", async (t) => {
  const cursors = {
    hourly: { buckets: {} },
    agent: {
      native: { lastCompletedStartedAt: 50 },
      wsl: { lastCompletedStartedAt: 100 },
    },
  };
  let probeCalls = 0;
  await runDualParse(t, {
    cursors,
    detectInstall: () => { probeCalls += 1; return true; },
  });

  assert.equal(probeCalls, 0, "namespaced cursors never re-run the ownership probe");
  assert.equal(cursors.agent.native.lastCompletedStartedAt, 50);
  assert.equal(cursors.agent.wsl.lastCompletedStartedAt, 100);
});
