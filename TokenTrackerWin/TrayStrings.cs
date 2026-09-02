namespace TokenTrackerWin;

internal sealed record TrayStrings(
    string FontFamily,
    string TodayTitle,
    string NoData,
    string TokensUnit,
    string OpenDashboard,
    string CloseDashboard,
    string SyncNow,
    string ShowIsland,
    string HideIsland,
    string LaunchAtLogin,
    string StarOnGitHub,
    string Quit)
{
    public static TrayStrings For(string locale) => locale switch
    {
        NativeLocalization.ChineseLocale => new(
            "Microsoft YaHei UI", "今日", "暂无数据", "tokens", "打开仪表盘", "关闭仪表盘",
            "立即同步", "显示灵动岛", "隐藏灵动岛", "开机时启动", "在 GitHub 上 Star", "退出"),
        _ => new(
            "Segoe UI Variable Text", "Today", "No data", "tokens", "Open Dashboard", "Close Dashboard",
            "Sync Now", "Show Dynamic Island", "Hide Dynamic Island", "Launch at Startup", "Star on GitHub", "Quit"),
    };
}
