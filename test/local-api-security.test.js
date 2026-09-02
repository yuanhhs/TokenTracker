const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

function createRequest({ method = "GET", headers = {}, body } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = headers;

  process.nextTick(() => {
    if (body != null) req.emit("data", Buffer.from(body));
    req.emit("end");
  });

  return req;
}

function createResponse() {
  return {
    statusCode: null,
    headers: null,
    body: Buffer.alloc(0),
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk ? Buffer.from(chunk) : Buffer.alloc(0);
    },
  };
}

async function getLocalAuthToken(handler) {
  const req = createRequest({ method: "GET" });
  const res = createResponse();
  const handled = await handler(req, res, new URL("http://127.0.0.1/api/local-auth"));
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  const body = JSON.parse(res.body.toString("utf8"));
  assert.equal(typeof body.token, "string");
  assert.ok(body.token.length > 0);
  return body.token;
}

function loadLocalApiWithSpawn(fakeSpawn) {
  const childProcess = require("node:child_process");
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = fakeSpawn;
  delete require.cache[require.resolve("../src/lib/local-api")];
  const mod = require("../src/lib/local-api");
  return {
    mod,
    restore() {
      childProcess.spawn = originalSpawn;
      delete require.cache[require.resolve("../src/lib/local-api")];
    },
  };
}

function createSuccessfulSpawn(calls) {
  return (cmd, args, options) => {
    calls.push({ cmd, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.emit("data", "sync ok");
      child.emit("close", 0);
    });
    return child;
  };
}

function createHandler(mod) {
  return mod.createLocalApiHandler({
    queuePath: path.join(os.tmpdir(), "tokentracker-local-api-security-queue.jsonl"),
  });
}

test("local auth endpoint mints a non-cacheable loopback token", async () => {
  const { mod, restore } = loadLocalApiWithSpawn(createSuccessfulSpawn([]));

  try {
    const handler = createHandler(mod);
    const first = await getLocalAuthToken(handler);
    const second = await getLocalAuthToken(handler);

    // The token is per-process, so a second read returns the same secret.
    assert.equal(first, second);
  } finally {
    restore();
  }
});

test("local sync rejects requests without the local auth token", async () => {
  const calls = [];
  const { mod, restore } = loadLocalApiWithSpawn(createSuccessfulSpawn(calls));

  try {
    const handler = createHandler(mod);
    const req = createRequest({ method: "POST", body: JSON.stringify({ auto: true }) });
    const res = createResponse();

    const handled = await handler(
      req,
      res,
      new URL("http://127.0.0.1/functions/tokentracker-local-sync"),
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(JSON.parse(res.body.toString("utf8")), { ok: false, error: "Unauthorized" });
    assert.equal(calls.length, 0, "an unauthorized request must not spawn a sync");
  } finally {
    restore();
  }
});

test("local sync rejects a wrong local auth token", async () => {
  const calls = [];
  const { mod, restore } = loadLocalApiWithSpawn(createSuccessfulSpawn(calls));

  try {
    const handler = createHandler(mod);
    const req = createRequest({
      method: "POST",
      headers: { "x-tokentracker-local-auth": "not-the-token" },
      body: JSON.stringify({ auto: true }),
    });
    const res = createResponse();

    const handled = await handler(
      req,
      res,
      new URL("http://127.0.0.1/functions/tokentracker-local-sync"),
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("local sync runs the local sync command once authorized", async () => {
  const calls = [];
  const { mod, restore } = loadLocalApiWithSpawn(createSuccessfulSpawn(calls));

  try {
    const handler = createHandler(mod);
    const token = await getLocalAuthToken(handler);
    const req = createRequest({
      method: "POST",
      headers: { "x-tokentracker-local-auth": token },
      body: JSON.stringify({ auto: true }),
    });
    const res = createResponse();

    const handled = await handler(
      req,
      res,
      new URL("http://127.0.0.1/functions/tokentracker-local-sync"),
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, [path.join(process.cwd(), "bin/tracker.js"), "sync", "--auto"]);
  } finally {
    restore();
  }
});

// Account login, the desktop pet, achievements, cloud sync preferences, and
// machine-id registration are gone. Their routes must stay explicitly dead
// rather than silently 404 into some future handler.
test("removed account, pet, and cloud routes answer 410 Gone", async () => {
  const { mod, restore } = loadLocalApiWithSpawn(createSuccessfulSpawn([]));

  try {
    const handler = createHandler(mod);
    const removedPaths = [
      "/api/auth/login",
      "/api/auth-bridge/verifier",
      "/api/pets/state",
      "/functions/tokentracker-pets",
      "/functions/tokentracker-cloud-sync-pref",
      "/functions/tokentracker-machine-id",
      "/functions/tokentracker-achievements",
    ];

    for (const removedPath of removedPaths) {
      const req = createRequest({ method: "GET" });
      const res = createResponse();
      const handled = await handler(req, res, new URL(`http://127.0.0.1${removedPath}`));

      assert.equal(handled, true, `${removedPath} should be handled`);
      assert.equal(res.statusCode, 410, `${removedPath} should be 410 Gone`);
      assert.deepEqual(JSON.parse(res.body.toString("utf8")), {
        ok: false,
        error: "This local-only feature has been removed",
      });
    }
  } finally {
    restore();
  }
});
