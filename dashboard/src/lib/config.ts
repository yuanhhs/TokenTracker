export const STATUSPAGE_URL = "https://tokentracker.statuspage.io/";

export const REPO_URL = "https://github.com/xiufengsun/TokenTracker";
export const PRIVACY_URL = `${REPO_URL}/blob/main/README.md#privacy`;
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
// The Windows release workflow uploads this stable installer alias.
export const WIN_SETUP_URL = `${RELEASES_URL}/download/TokenTracker-Setup.exe`;

/**
 * 仪表盘/用量等：本地 localhost 一律用空字符串（相对路径走 CLI 内置 API），不访问云端。
 */
export function getBackendBaseUrl() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalhost) return "";

  return "";
}
