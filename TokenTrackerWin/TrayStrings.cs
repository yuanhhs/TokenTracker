namespace TokenTrackerWin;

internal sealed record TrayStrings(
    string FontFamily,
    string TodayTitle,
    string NoData,
    string TokensUnit,
    string OpenDashboard,
    string CloseDashboard,
    string SyncNow,
    string LaunchAtLogin,
    string StarOnGitHub,
    string Quit)
{
    public static TrayStrings Default { get; } = new(
        "Microsoft YaHei UI", "今日", "暂无数据", "tokens", "打开仪表板", "关闭仪表板",
        "立即同步", "开机时启动", "在 GitHub 上 Star", "退出");
}
