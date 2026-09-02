namespace TokenTrackerWin;

/// <summary>
/// Localized strings for the "check for updates" tray flow, mirroring the
/// <see cref="TrayStrings"/> per-locale pattern. Kept separate so the (already
/// long) positional <see cref="TrayStrings"/> record stays focused on the core
/// menu. Format placeholders: <c>{0}</c> = version, and for
/// <see cref="UpToDateMessage"/> the current version.
/// </summary>
internal sealed record UpdateStrings(
    string CheckForUpdates,
    string Checking,
    string UpdateNow,          // "{0}" = new version
    string Downloading,        // "{0}" = percent
    string Installing,
    string UpToDateTitle,
    string UpToDateMessage,    // "{0}" = current version
    string UpdateFoundTitle,
    string UpdateFoundPrompt,  // "{0}" = new version, "{1}" = current version
    string ErrorTitle,
    string ErrorMessage,
    string NewVersionBalloon)  // "{0}" = new version
{
    public static UpdateStrings For(string locale)
    {
        return locale switch
        {
            NativeLocalization.ChineseLocale => new(
                "检查更新",
                "正在检查更新…",
                "更新到 {0}",
                "正在下载 {0}%",
                "正在安装更新…",
                "已是最新版本",
                "你正在使用最新版本（{0}）。",
                "发现新版本",
                "新版本 {0} 可用（当前 {1}）。现在更新吗？",
                "检查更新失败",
                "无法连接到更新服务器，请稍后重试或前往 GitHub 手动下载。",
                "新版本 {0} 可用，点击托盘菜单「更新」即可升级。"),
            _ => new(
                "Check for Updates",
                "Checking for updates…",
                "Update to {0}",
                "Downloading {0}%",
                "Installing update…",
                "You're up to date",
                "You're on the latest version ({0}).",
                "Update available",
                "Version {0} is available (current {1}). Update now?",
                "Update check failed",
                "Couldn't reach the update server. Try again later or download manually from GitHub.",
                "Version {0} is available — choose \"Update\" in the tray menu to upgrade."),
        };
    }
}
