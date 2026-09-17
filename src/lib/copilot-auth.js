const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const { readSqliteJsonRows, readSqliteJsonRowsAsync } = require("./sqlite-reader");

const execFileAsync = promisify(cp.execFile);

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Copilot credential discovery.
// Reuses the OAuth token from the user's existing Copilot install. Older clients
// keep it in plaintext (`~/.config/github-copilot/{apps,hosts}.json`); newer
// copilot-language-server clients migrate it into SQLite `auth.db`. Schema v0
// stores the OAuth token as a plaintext BLOB, while later schemas use AES-GCM
// ciphertext with the key in the OS credential store. Read legacy plaintext
// first, then auth.db. No device flow needed either way.
//
// `status` reports whether a Copilot token and OTEL export are present so the
// user can tell why the Copilot sync source is (or isn't) producing rows.
// ─────────────────────────────────────────────────────────────────────────────

const MACOS_SECURITY_BIN = "/usr/bin/security";
// copilot-language-server stores the OAuth token as AES-256-GCM ciphertext in
// auth.db (`oauth_tokens.token_ciphertext`) and the 32-byte key in the macOS
// Keychain (service `copilot-language-server`, account `oauth-token-key`,
// base64-encoded). Ciphertext layout: iv(12) ‖ ciphertext ‖ authTag(16).
const COPILOT_LS_KEYCHAIN_SERVICE = "copilot-language-server";
const COPILOT_LS_KEYCHAIN_ACCOUNT = "oauth-token-key";
const COPILOT_AUTH_DB_SQL =
  "SELECT user_login, auth_authority, scopes, token_schema_version, hex(token_ciphertext) AS token_hex, "
  + "last_used_at, updated_at FROM oauth_tokens ORDER BY last_used_at DESC, updated_at DESC";

function readPlaintextCopilotOauthToken({ home }) {
  const candidates = [
    path.join(home, ".config", "github-copilot", "apps.json"),
    path.join(home, ".config", "github-copilot", "hosts.json"),
  ];
  // Keys are either "github.com", "github.example.com" (enterprise), or a
  // composite like "github.com:Iv1.b507a08c87ecfe98". We always hit
  // api.github.com, so prefer the public-host token; only fall back to
  // whatever's there if no public-host entry exists.
  let fallback = null;
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (_e) {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const token = typeof value.oauth_token === "string" ? value.oauth_token : "";
      if (!token) continue;
      const host = String(key).split(":")[0];
      if (host === "github.com") return token;
      if (!fallback) fallback = token;
    }
  }
  return fallback;
}

function readMacosKeychainGenericPassword({ service, account, securityRunner } = {}) {
  const runner = typeof securityRunner === "function" ? securityRunner : cp.spawnSync;
  if (runner === cp.spawnSync && !fs.existsSync(MACOS_SECURITY_BIN)) return null;
  const args = ["find-generic-password", "-s", service];
  if (account) args.push("-a", account);
  args.push("-w");
  const result = runner(MACOS_SECURITY_BIN, args, {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 2000,
    encoding: "utf8",
  });
  if (!result || result.error || result.status !== 0) return null;
  const stdout =
    typeof result.stdout === "string"
      ? result.stdout
      : Buffer.isBuffer(result.stdout)
        ? result.stdout.toString("utf8")
        : "";
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readMacosKeychainGenericPasswordAsync({ service, account, securityRunner } = {}) {
  if (typeof securityRunner === "function") {
    return readMacosKeychainGenericPassword({ service, account, securityRunner });
  }
  if (!fs.existsSync(MACOS_SECURITY_BIN)) return null;
  const args = ["find-generic-password", "-s", service];
  if (account) args.push("-a", account);
  args.push("-w");
  try {
    const result = await execFileAsync(MACOS_SECURITY_BIN, args, {
      timeout: 2000,
      encoding: "utf8",
    });
    const stdout =
      typeof result?.stdout === "string"
        ? result.stdout
        : Buffer.isBuffer(result?.stdout)
          ? result.stdout.toString("utf8")
          : "";
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (_e) {
    return null;
  }
}

function decryptCopilotAuthDbToken(keyBase64, ciphertextHex) {
  if (typeof keyBase64 !== "string" || typeof ciphertextHex !== "string") return null;
  let key;
  let blob;
  try {
    key = Buffer.from(keyBase64, "base64");
    blob = Buffer.from(ciphertextHex, "hex");
  } catch (_e) {
    return null;
  }
  if (key.length !== 32) return null; // AES-256 key
  if (blob.length < 12 + 16 + 1) return null; // iv(12) + authTag(16) + >=1 byte token
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(blob.length - 16);
  const data = blob.subarray(12, blob.length - 16);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    const token = out.toString("utf8").trim();
    return token.length > 0 ? token : null;
  } catch (_e) {
    return null;
  }
}

function isLikelyGithubOauthToken(token) {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return /^gh[opsur]_[A-Za-z0-9]{20,}$/.test(trimmed)
    || /^github_pat_[A-Za-z0-9_]{20,}$/.test(trimmed);
}

function parseCopilotAuthDbSchemaVersion(value) {
  if (value === null || value === undefined || value === "") return null;
  const version = Number(value);
  return Number.isInteger(version) ? version : null;
}

function decodeUtf8HexString(value) {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  try {
    return Buffer.from(value, "hex").toString("utf8").trim();
  } catch (_e) {
    return null;
  }
}

function decodeCopilotSchemaV0Token(row) {
  const candidates = [];
  const tokenHex = typeof row?.token_hex === "string" ? row.token_hex : null;
  if (tokenHex) candidates.push(decodeUtf8HexString(tokenHex));

  const rawCiphertext = row?.token_ciphertext;
  if (Buffer.isBuffer(rawCiphertext)) {
    candidates.push(rawCiphertext.toString("utf8").trim());
  } else if (typeof rawCiphertext === "string") {
    candidates.push(rawCiphertext.trim());
    candidates.push(decodeUtf8HexString(rawCiphertext));
  }

  for (const candidate of candidates) {
    if (isLikelyGithubOauthToken(candidate)) return candidate.trim();
  }
  return null;
}

function orderCopilotAuthDbRows(rows) {
  const githubRows = [];
  const fallbackRows = [];
  for (const row of rows) {
    const host = String(row?.auth_authority || "").split(":")[0];
    if (host === "github.com") {
      githubRows.push(row);
    } else {
      fallbackRows.push(row);
    }
  }
  return githubRows.concat(fallbackRows);
}

function readCopilotAuthDbRows({ home, sqliteReader, asyncReader = false } = {}) {
  const resolvedHome = home || os.homedir();
  const dbPath = path.join(resolvedHome, ".config", "github-copilot", "auth.db");
  const reader = typeof sqliteReader === "function"
    ? sqliteReader
    : asyncReader
      ? readSqliteJsonRowsAsync
      : readSqliteJsonRows;
  return reader(dbPath, COPILOT_AUTH_DB_SQL, { label: "GitHub Copilot" });
}

function resolveCopilotAuthDbTokenFromRows(rows, {
  platform = process.platform,
  securityRunner,
  keychainReader = readMacosKeychainGenericPassword,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Prefer the public github.com host (mirrors the plaintext reader); rows are
  // already ordered most-recently-used first.
  const orderedRows = orderCopilotAuthDbRows(rows);
  let keyBase64 = null;
  let attemptedKeychain = false;
  for (const row of orderedRows) {
    const schemaVersion = parseCopilotAuthDbSchemaVersion(row?.token_schema_version);
    if (schemaVersion === 0) {
      const plaintextToken = decodeCopilotSchemaV0Token(row);
      if (plaintextToken) return plaintextToken;
      continue;
    }

    const ciphertextHex = typeof row?.token_hex === "string" ? row.token_hex : null;
    if (!ciphertextHex || platform !== "darwin") continue;
    // The decryption key lives in the macOS Keychain. On Linux/Windows the
    // copilot-language-server uses libsecret / Credential Manager instead, which
    // we don't read yet.
    if (!attemptedKeychain) {
      keyBase64 = keychainReader({
        service: COPILOT_LS_KEYCHAIN_SERVICE,
        account: COPILOT_LS_KEYCHAIN_ACCOUNT,
        securityRunner,
      });
      attemptedKeychain = true;
    }
    if (!keyBase64) continue;
    const token = decryptCopilotAuthDbToken(keyBase64, ciphertextHex);
    if (token) return token;
  }
  return null;
}

async function resolveCopilotAuthDbTokenFromRowsAsync(rows, {
  platform = process.platform,
  securityRunner,
  keychainReader = readMacosKeychainGenericPasswordAsync,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const orderedRows = orderCopilotAuthDbRows(rows);
  let keyBase64 = null;
  let attemptedKeychain = false;
  for (const row of orderedRows) {
    const schemaVersion = parseCopilotAuthDbSchemaVersion(row?.token_schema_version);
    if (schemaVersion === 0) {
      const plaintextToken = decodeCopilotSchemaV0Token(row);
      if (plaintextToken) return plaintextToken;
      continue;
    }

    const ciphertextHex = typeof row?.token_hex === "string" ? row.token_hex : null;
    if (!ciphertextHex || platform !== "darwin") continue;
    if (!attemptedKeychain) {
      keyBase64 = await keychainReader({
        service: COPILOT_LS_KEYCHAIN_SERVICE,
        account: COPILOT_LS_KEYCHAIN_ACCOUNT,
        securityRunner,
      });
      attemptedKeychain = true;
    }
    if (!keyBase64) continue;
    const token = decryptCopilotAuthDbToken(keyBase64, ciphertextHex);
    if (token) return token;
  }
  return null;
}

function readCopilotAuthDbToken({ home, platform = process.platform, securityRunner, sqliteReader } = {}) {
  let rows;
  try {
    rows = readCopilotAuthDbRows({ home, sqliteReader });
  } catch (_e) {
    return null;
  }
  return resolveCopilotAuthDbTokenFromRows(rows, { platform, securityRunner });
}

async function readCopilotAuthDbTokenAsync({ home, platform = process.platform, securityRunner, sqliteReader } = {}) {
  let rows;
  try {
    rows = await readCopilotAuthDbRows({ home, sqliteReader, asyncReader: true });
  } catch (_e) {
    return null;
  }
  return resolveCopilotAuthDbTokenFromRowsAsync(rows, { platform, securityRunner });
}

function readCopilotOauthToken({
  home = os.homedir(),
  platform = process.platform,
  securityRunner,
  sqliteReader,
} = {}) {
  const plaintext = readPlaintextCopilotOauthToken({ home });
  if (plaintext) return plaintext;
  // No plaintext token found — recover the live one from the encrypted auth.db.
  return readCopilotAuthDbToken({ home, platform, securityRunner, sqliteReader });
}

async function readCopilotOauthTokenAsync({
  home = os.homedir(),
  platform = process.platform,
  securityRunner,
  sqliteReader,
} = {}) {
  const plaintext = readPlaintextCopilotOauthToken({ home });
  if (plaintext) return plaintext;
  return readCopilotAuthDbTokenAsync({ home, platform, securityRunner, sqliteReader });
}

function describeCopilotOtelStatus({ home, env = process.env } = {}) {
  const resolvedHome = home || env.HOME || os.homedir();
  const enabled = String(env.COPILOT_OTEL_ENABLED || "").toLowerCase() === "true";
  const exporterType = String(env.COPILOT_OTEL_EXPORTER_TYPE || "").toLowerCase();
  const explicitPath = typeof env.COPILOT_OTEL_FILE_EXPORTER_PATH === "string"
    ? env.COPILOT_OTEL_FILE_EXPORTER_PATH
    : "";
  const defaultDirs = [
    path.join(resolvedHome, ".copilot", "otel"),
    path.join(resolvedHome, ".copilot-otel"),
  ];
  const detectedPaths = [];
  for (const defaultDir of defaultDirs) {
    try {
      if (!fs.existsSync(defaultDir)) continue;
      for (const entry of fs.readdirSync(defaultDir)) {
        if (entry.endsWith(".jsonl")) {
          detectedPaths.push(path.join(defaultDir, entry));
        }
      }
    } catch (_e) {}
  }
  if (explicitPath && fs.existsSync(explicitPath)) detectedPaths.push(explicitPath);
  return {
    otel_enabled: enabled && (exporterType === "" || exporterType === "file"),
    otel_exporter_type: exporterType || null,
    otel_path: explicitPath || null,
    otel_default_dir: defaultDirs[0],
    otel_default_dirs: defaultDirs,
    otel_detected_paths: detectedPaths,
    otel_has_files: detectedPaths.length > 0,
  };
}

module.exports = {
  readPlaintextCopilotOauthToken,
  readCopilotOauthToken,
  readCopilotOauthTokenAsync,
  readCopilotAuthDbToken,
  readCopilotAuthDbTokenAsync,
  decryptCopilotAuthDbToken,
  describeCopilotOtelStatus,
};
