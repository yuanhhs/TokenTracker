const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { buildDoctorReport } = require("../src/lib/doctor");
const { cmdDoctor } = require("../src/commands/doctor");
const { withHome } = require("./helpers/with-home");

test("doctor reports runtime config status", async () => {
  const report = await buildDoctorReport({
    runtime: {
      dashboardUrl: "https://example",
      httpTimeoutMs: 20_000,
      debug: false,
      sources: { dashboardUrl: "config", httpTimeoutMs: "default", debug: "default" },
    },
  });
  const dashboardCheck = report.checks.find((c) => c.id === "runtime.dashboard_url");
  const timeoutCheck = report.checks.find((c) => c.id === "runtime.http_timeout_ms");
  const debugCheck = report.checks.find((c) => c.id === "runtime.debug");

  assert.equal(dashboardCheck.status, "ok");
  assert.equal(dashboardCheck.meta.dashboard_url, "https://example");
  assert.equal(dashboardCheck.meta.source, "config");
  assert.equal(timeoutCheck.status, "ok");
  assert.equal(timeoutCheck.meta.http_timeout_ms, 20_000);
  assert.equal(debugCheck.status, "ok");
});

// Doctor is local-only now: the cloud base_url, device token, upload-error and
// network reachability checks were removed with the rest of the cloud stack.
test("doctor emits no cloud or network checks", async () => {
  const report = await buildDoctorReport({
    runtime: { dashboardUrl: "https://example" },
    diagnostics: { notify: {} },
  });
  const ids = report.checks.map((c) => c.id);

  assert.equal(ids.includes("runtime.base_url"), false);
  assert.equal(ids.includes("runtime.device_token"), false);
  assert.equal(ids.includes("runtime.auto_retry_no_spawn"), false);
  assert.equal(ids.includes("network.base_url"), false);
  assert.equal(ids.includes("upload.last_error"), false);
});

test("doctor marks invalid config.json as critical", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-doctor-"));
  const trackerDir = path.join(tmp, ".tokentracker", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  const configPath = path.join(trackerDir, "config.json");
  await fs.writeFile(configPath, "{bad", "utf8");

  const report = await buildDoctorReport({
    runtime: {},
    paths: { trackerDir, configPath },
  });
  const configCheck = report.checks.find((c) => c.id === "fs.config_json");

  assert.equal(configCheck.status, "fail");
  assert.equal(configCheck.critical, true);
});

test("doctor --out writes json to file and stdout", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-doctor-"));
  let restoreHome = () => {};
  const prevCwd = process.cwd();
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    restoreHome = withHome(tmp);
    process.chdir(tmp);
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = undefined;

    await cmdDoctor(["--out", "doctor.json"]);

    const out = outCapture.read();
    assert.ok(out.trim().startsWith("{"));
    const payload = JSON.parse(out);
    assert.equal(payload.version, 1);

    const filePayload = JSON.parse(await fs.readFile(path.join(tmp, "doctor.json"), "utf8"));
    assert.equal(filePayload.version, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    restoreHome();
    process.chdir(prevCwd);
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor sets exitCode on critical failures", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-doctor-"));
  let restoreHome = () => {};
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    restoreHome = withHome(tmp);
    const trackerDir = path.join(tmp, ".tokentracker", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.writeFile(path.join(trackerDir, "config.json"), "{bad", "utf8");
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json"]);

    assert.equal(process.exitCode, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    restoreHome();
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor rejects the removed cloud --base-url flag", async () => {
  await assert.rejects(
    () => cmdDoctor(["--json", "--base-url", "https://override.example"]),
    /Unknown option: --base-url/,
  );
});

test("doctor tolerates null config.json payload", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-doctor-"));
  let restoreHome = () => {};
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    restoreHome = withHome(tmp);
    const trackerDir = path.join(tmp, ".tokentracker", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.writeFile(path.join(trackerDir, "config.json"), "null", "utf8");
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json"]);

    const payload = JSON.parse(outCapture.read());
    assert.equal(payload.version, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    restoreHome();
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

function createWriteCapture() {
  let out = "";
  return {
    write(chunk, enc, cb) {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    },
    read() {
      return out;
    },
  };
}
