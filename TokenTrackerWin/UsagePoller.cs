using System.Globalization;
using System.Net.Http;
using System.Text.Json;

namespace TokenTrackerWin;

/// <summary>
/// Polls the local server's usage summary for the tray's local-only figures.
/// </summary>
internal sealed class UsagePoller : IDisposable
{
    public readonly record struct UsageStats(
        long TodayTokens,
        decimal TodayCostUsd,
        string Date);

    // Local server only (127.0.0.1) — never route through a system/env proxy, or a
    // VPN/proxy user without a loopback bypass can't reach it (see ServerManager.Http).
    private static readonly HttpClient Http =
        new(new HttpClientHandler { UseProxy = false }) { Timeout = TimeSpan.FromSeconds(6) };
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
            decimal cost = 0m;
            if (totals.TryGetProperty("total_cost_usd", out var c)
                && decimal.TryParse(c.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                cost = parsed;

            return new UsageStats(tokens, cost, today);
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
}
