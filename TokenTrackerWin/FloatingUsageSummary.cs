using System.Globalization;

namespace TokenTrackerWin;

internal sealed record FloatingUsageSummary(
    string Date, string? Tokens, string? ExactTokens, string? Cost, string? UpdatedAt)
{
    public static FloatingUsageSummary Create(UsagePoller.UsageStats? stats, DateTimeOffset? updatedAt,
        string symbol, decimal rate, DateTime localNow)
    {
        var today = localNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        if (stats is not { } s || s.Date != today) return new(today, null, null, null, null);
        return new(today,
            UsagePoller.FormatTokens(s.TodayTokens),
            s.TodayTokens.ToString("N0", CultureInfo.GetCultureInfo("zh-CN")),
            symbol + (s.TodayCostUsd * rate).ToString("0.00", CultureInfo.InvariantCulture),
            updatedAt?.ToString("O"));
    }
}
