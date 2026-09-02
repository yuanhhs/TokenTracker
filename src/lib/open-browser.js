const cp = require("node:child_process");

/** Open a URL using the platform's default browser. Best effort only. */
function openInBrowser(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    if (process.platform === "win32") {
      cp.spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Start-Process -FilePath '${value.replace(/'/g, "''")}'`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (process.platform === "darwin") {
      cp.spawn("open", [value], { detached: true, stdio: "ignore" }).unref();
    } else {
      cp.spawn("xdg-open", [value], { detached: true, stdio: "ignore" }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = { openInBrowser };
