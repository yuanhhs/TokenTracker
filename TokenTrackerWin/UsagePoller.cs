using System.Globalization;
using System.Net.Http;
using System.Text.Json;

namespace TokenTrackerWin;

/// <summary>
/// Polls the local server's usage summary for the tray's local-only figures.
/// </summary>
internal sealed class UsagePoller : IDisposable
{
    /// <summary>Optional top-model statistic retained for wire compatibility.</summary>
    public readonly record struct TopModelStat(string Name, string Percent, string Source);

    public readonly record struct UsageStats(
        long TodayTokens,
        decimal TodayCostUsd,
        int TodayConversations,
        long Last7dTokens,
        int Last7dActiveDays,
        long Last30dTokens,
        long Last30dAvgPerDay,
        int StreakDays,
        int ActiveDaysAllTime,
        IReadOnlyList<TopModelStat> TopModels);

    // Local server only (127.0.0.1) — never route through a system/env proxy, or a
    // VPN/proxy user without a loopback bypass can't reach it (see ServerManager.Http).
    private static readonly HttpClient Http =
        new(new HttpClientHandler { UseProxy = false }) { Timeout = TimeSpan.FromSeconds(6) };
    private static readonly IReadOnlyList<TopModelStat> NoModels = Array.Empty<TopModelStat>();
    private readonly Func<string> _baseUrl;
    private CancellationTokenSource? _cts;

    /// <summary>Raised on the thread-pool with fresh stats. UI must marshal to the UI thread.</summary>
    public event Action<UsageStats>? StatsUpdated;

    public UsagePoller(Func<string> baseUrl) => _baseUrl = baseUrl;

    public void Start()
    {
        _cts?.Cancel();
        _cts = new CancellationTokenSource();
        var token = _cts.Token;
        _ = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                var stats = await FetchAsync();
                if (stats is { } s && !token.IsCancellationRequested) StatsUpdated?.Invoke(s);
                try { await Task.Delay(TimeSpan.FromSeconds(60), token); }
                catch (TaskCanceledException) { break; }
            }
        }, token);
    }

    public void RefreshNow()
    {
        var token = _cts?.Token ?? CancellationToken.None;
        _ = Task.Run(async () =>
        {
            var stats = await FetchAsync();
            if (stats is { } s && !token.IsCancellationRequested) StatsUpdated?.Invoke(s);
        }, token);
    }

    private async Task<UsageStats?> FetchAsync()
    {
        try
        {
            var today = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var tzQuery = TimeZoneQuery();

            var summaryUrl = $"{_baseUrl()}/functions/tokentracker-usage-summary"
                             + $"?from={today}&to={today}{tzQuery}";

            using var resp = await Http.GetAsync(summaryUrl);
            if (!resp.IsSuccessStatusCode) return null;

            await using var stream = await resp.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;
            if (!root.TryGetProperty("totals", out var totals)) return null;

            long tokens = ResolveDisplayTokens(totals);
            int convos = (int)GetLong(totals, "conversation_count");
            decimal cost = 0m;
            if (totals.TryGetProperty("total_cost_usd", out var c)
                && decimal.TryParse(c.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                cost = parsed;

            // 7-day / 30-day rolling stats ride along in the same response — no extra call.
            long l7Tokens = 0, l30Tokens = 0, l30Avg = 0;
            int l7Active = 0;
            if (root.TryGetProperty("rolling", out var rolling))
            {
                if (rolling.TryGetProperty("last_7d", out var l7))
                {
                    l7Active = (int)GetLong(l7, "active_days");
                    if (l7.TryGetProperty("totals", out var l7t)) l7Tokens = ResolveDisplayTokens(l7t);
                }
                if (rolling.TryGetProperty("last_30d", out var l30))
                {
                    l30Avg = GetLong(l30, "avg_per_active_day");
                    if (l30.TryGetProperty("totals", out var l30t)) l30Tokens = ResolveDisplayTokens(l30t);
                }
            }

            return new UsageStats(
                tokens, cost, convos,
                l7Tokens, l7Active,
                l30Tokens, l30Avg,
                0, 0,
                NoModels);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Match the dashboard's resolveDisplayTokens semantics: prefer a positive
    /// billable total, otherwise fall back to a positive raw total. Keeping this
    /// policy here keeps the Windows tray consistent with the same
    /// usage-summary response rendered in the Dashboard.
    /// </summary>
    internal static long ResolveDisplayTokens(JsonElement totals)
    {
        var hasBillable = TryGetLong(totals, "billable_total_tokens", out var billable);
        var hasTotal = TryGetLong(totals, "total_tokens", out var total);
        if (hasBillable && billable > 0) return billable;
        if (hasTotal && total > 0) return total;
        if (hasBillable) return billable;
        if (hasTotal) return total;
        return 0;
    }

    private static bool TryGetLong(JsonElement obj, string name, out long value)
    {
        value = 0;
        if (!obj.TryGetProperty(name, out var el)) return false;
        switch (el.ValueKind)
        {
            case JsonValueKind.Number:
                value = el.TryGetInt64(out var numeric) ? numeric : (long)el.GetDouble();
                return true;
            case JsonValueKind.String:
                return long.TryParse(
                    el.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out value);
            default:
                return false;
        }
    }

    private static long GetLong(JsonElement obj, string name)
    {
        return TryGetLong(obj, name, out var value) ? value : 0;
    }

    /// <summary>The usage endpoints expect an IANA tz; Windows uses its own ids, so convert.</summary>
    private static string TimeZoneQuery()
    {
        var offsetMin = (int)DateTimeOffset.Now.Offset.TotalMinutes;
        var tz = ResolveIanaTimeZone();
        return $"&tz={Uri.EscapeDataString(tz)}&tz_offset_minutes={offsetMin}";
    }

    private static string ResolveIanaTimeZone()
    {
        try
        {
            if (TimeZoneInfo.TryConvertWindowsIdToIanaId(TimeZoneInfo.Local.Id, out var iana))
                return iana;
        }
        catch { /* fall back below */ }
        return "UTC";
    }

    public void Dispose()
    {
        _cts?.Cancel();
        _cts = null;
    }

    // ── Formatting (mirrors macOS TokenFormatter.formatCompact + cost) ──

    public static string FormatTokens(long n)
    {
        if (n >= 1_000_000_000) return (n / 1_000_000_000d).ToString("0.0", CultureInfo.InvariantCulture) + "B";
        if (n >= 1_000_000) return (n / 1_000_000d).ToString("0.0", CultureInfo.InvariantCulture) + "M";
        if (n >= 1_000) return (n / 1_000d).ToString("0.0", CultureInfo.InvariantCulture) + "K";
        return n.ToString(CultureInfo.InvariantCulture);
    }

    public static string FormatCost(decimal usd) =>
        "$" + usd.ToString("0.00", CultureInfo.InvariantCulture);
}
