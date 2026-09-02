using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace TokenTrackerWin;

/// <summary>
/// Transparent, always-on-top Windows Dynamic Island. It consumes snapshots from
/// the tray's shared poller instead of running its own usage polling loop.
/// </summary>
internal sealed class IslandWindow : Window
{
    private const double HostWidth = 500;
    private const double HostHeight = 330;
    private const double CompactWidth = 326;
    private const double CompactHeight = 44;
    private const double ExpandedWidth = 460;
    private const double ExpandedHeight = 300;
    private const double ExpandedWithoutLimitsHeight = 170;
    private const long CollapseDelayMs = 250;
    private static readonly HashSet<string> KnownMetricIds = new(StringComparer.Ordinal)
    {
        "none", "todayTokens", "todayCost", "last7dTokens", "last7dCost",
        "last30dTokens", "last30dCost", "totalTokens", "totalCost",
        "claude5h", "claude7d", "claudeOpus",
        "codex5h", "codex7d", "codexCredits", "codexSpark5h", "codexSpark7d",
        "cursorPlan", "cursorAuto", "cursorAPI", "cursorGrok",
        "geminiPro", "geminiFlash", "geminiLite",
        "kimiWeekly", "kimi5h", "kimiTotal",
        "kiroMonth", "kiroBonus", "grokMonth", "grokOndemand",
        "copilotPremium", "copilotChat",
        "antigravityClaudeWeekly", "antigravityClaude5h",
        "antigravityGeminiWeekly", "antigravityGemini5h",
        "zcode5h", "zcodeWeekly", "zcodeTools", "zcodeGlm52", "zcodeGlm5Turbo",
    };

    private readonly WebView2CompositionControl _webView = new() { AllowExternalDrop = false };
    private readonly ServerManager _server;
    private readonly System.Windows.Threading.DispatcherTimer _hoverTimer;
    private readonly System.Windows.Threading.DispatcherTimer _saveTimer;
    private bool _coreReady;
    private bool _exiting;
    private bool _expanded;
    private bool _suppressExpandUntilExit;
    private bool _clickThrough;
    private bool _dragging;
    private bool _autoCollapse;
    private bool _showLimits;
    private bool _compactMode;
    private string _limitDisplayMode = "used";
    private string[] _metrics = ["todayTokens", "todayCost"];
    private long _lastInsideTick;
    private nint _hwnd;
    private string _currencySymbol = "$";
    private decimal _currencyRate = 1m;
    private string _locale = "en";
    private bool _connected;
    private JsonNode? _limits;
    private UsagePoller.UsageStats _stats;

    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "TokenTracker", "native-settings.json");

    public event Action? DashboardRequested;
    public event Action? HideRequested;
    public event Action? MenuRequested;

    public IslandWindow(ServerManager server)
    {
        _server = server;
        _connected = server.Status == ServerManager.ServerStatus.Running;
        _autoCollapse = StoredAutoCollapse;
        _showLimits = StoredShowLimits;
        _compactMode = StoredCompactMode;
        _limitDisplayMode = StoredLimitDisplayMode;
        _metrics = StoredMetrics;
        if (Currency.ReadPersisted() is { } cached)
        {
            _currencySymbol = cached.Symbol;
            _currencyRate = cached.Rate;
        }

        Title = Constants.AppDisplayName + " Dynamic Island";
        Width = HostWidth;
        Height = HostHeight;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = System.Windows.Media.Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        WindowStartupLocation = WindowStartupLocation.Manual;
        RestorePlacement();
        Content = _webView;

        _hoverTimer = new System.Windows.Threading.DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(50),
        };
        _hoverTimer.Tick += (_, _) => HoverTick();

        _saveTimer = new System.Windows.Threading.DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(500),
        };
        _saveTimer.Tick += (_, _) =>
        {
            _saveTimer.Stop();
            SavePlacement();
        };
        LocationChanged += (_, _) =>
        {
            if (_dragging) return;
            _saveTimer.Stop();
            _saveTimer.Start();
        };

        Loaded += async (_, _) => await InitializeWebViewAsync();
        _server.StatusChanged += OnServerStatusChanged;
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        _hwnd = new WindowInteropHelper(this).Handle;
        var style = GetWindowExStyle(_hwnd).ToInt64() | WS_EX_NOACTIVATE;
        SetWindowExStyle(_hwnd, (nint)style);
        _clickThrough = (style & WS_EX_TRANSPARENT) != 0;
        SetWindowPos(
            _hwnd,
            nint.Zero,
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        HoverTick();
    }

    private async Task InitializeWebViewAsync()
    {
        if (_coreReady) return;

        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TokenTracker", "WebView2Island");
        Directory.CreateDirectory(userDataFolder);
        Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");

        var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, null);
        await _webView.EnsureCoreWebView2Async(env);
        _coreReady = true;
        _webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);

        var core = _webView.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        await core.AddScriptToExecuteOnDocumentCreatedAsync(
            "try{var s=document.createElement('style');" +
            "s.textContent='html,body,#island-root{background:transparent!important}';" +
            "(document.head||document.documentElement).appendChild(s);}catch(e){}");

        core.WebMessageReceived += (_, e) =>
        {
            string message;
            try { message = e.TryGetWebMessageAsString(); }
            catch { return; }

            switch (message)
            {
                case "island:drag":
                    BeginNativeDrag();
                    break;
                case "island:dashboard":
                    DashboardRequested?.Invoke();
                    break;
                case "island:hide":
                    HideRequested?.Invoke();
                    break;
                case "island:menu":
                    MenuRequested?.Invoke();
                    break;
                case "island:collapse":
                    _suppressExpandUntilExit = true;
                    SetExpanded(false);
                    break;
            }
        };
        core.NavigationCompleted += (_, _) => PushContext();
        NavigateWhenServerReady();
    }

    private void OnServerStatusChanged(ServerManager.ServerStatus status)
    {
        ApplyConnected(status == ServerManager.ServerStatus.Running);
        if (status != ServerManager.ServerStatus.Running) return;
        try { Dispatcher.BeginInvoke(new Action(NavigateWhenServerReady)); }
        catch { /* window is closing */ }
    }

    private void NavigateWhenServerReady()
    {
        if (!_coreReady || _server.Status != ServerManager.ServerStatus.Running) return;
        _webView.CoreWebView2.Navigate(_server.BaseUrl + "/island.html?app=1");
    }

    public void ShowIsland()
    {
        if (!IsVisible) Show();
        Topmost = true;
        _suppressExpandUntilExit = false;
        _lastInsideTick = Environment.TickCount64;
        _hoverTimer.Start();
        PushContext();
        HoverTick();
    }

    public void HideIsland()
    {
        _hoverTimer.Stop();
        _saveTimer.Stop();
        _suppressExpandUntilExit = false;
        SetExpanded(false);
        SetClickThrough(false);
        Hide();
    }

    public void Shutdown()
    {
        _exiting = true;
        Close();
    }

    public void ApplyStats(UsagePoller.UsageStats stats)
    {
        _stats = stats;
        PushContext();
    }

    public void ApplyLimits(string? json)
    {
        try
        {
            _limits = string.IsNullOrWhiteSpace(json) ? null : JsonNode.Parse(json);
        }
        catch
        {
            return;
        }
        PushContext();
    }

    public void ApplyCurrency(string symbol, decimal rate)
    {
        _currencySymbol = string.IsNullOrWhiteSpace(symbol) ? "$" : symbol;
        _currencyRate = rate > 0 ? rate : 1m;
        PushContext();
    }

    public void ApplyLocale(string locale)
    {
        _locale = string.IsNullOrWhiteSpace(locale) ? "en" : locale;
        PushContext();
    }

    public void ApplyConnected(bool connected)
    {
        _connected = connected;
        PushContext();
    }

    public void ApplyPreferences(
        bool autoCollapse,
        bool showLimits,
        bool compactMode,
        string limitDisplayMode,
        IReadOnlyList<string> metrics)
    {
        _autoCollapse = autoCollapse;
        _showLimits = showLimits;
        _compactMode = compactMode;
        _limitDisplayMode = NormalizeLimitDisplayMode(limitDisplayMode);
        _metrics = NormalizeMetrics(metrics);
        PushContext();
        HoverTick();
    }

    public void ResetPlacement()
    {
        var workArea = SystemParameters.WorkArea;
        Left = ClampX(workArea.Left + (workArea.Width - HostWidth) / 2);
        Top = ClampY(workArea.Top);
        SavePlacement();
    }

    private void PushContext()
    {
        if (!_coreReady) return;
        var currencyJson = JsonSerializer.Serialize(new
        {
            symbol = _currencySymbol,
            rate = _currencyRate,
        });
        var localeJson = JsonSerializer.Serialize(_locale);
        var statsJson = JsonSerializer.Serialize(new
        {
            todayTokens = _stats.TodayTokens,
            todayCostUsd = _stats.TodayCostUsd,
            todayConversations = _stats.TodayConversations,
            last7dTokens = _stats.Last7dTokens,
            last7dCostUsd = _stats.Last7dCostUsd,
            last7dActiveDays = _stats.Last7dActiveDays,
            last30dTokens = _stats.Last30dTokens,
            last30dCostUsd = _stats.Last30dCostUsd,
            last30dAvgPerDay = _stats.Last30dAvgPerDay,
            totalTokens = _stats.TotalTokens,
            totalCostUsd = _stats.TotalCostUsd,
        });
        var limitsJson = _limits?.ToJsonString() ?? "null";
        var connected = _connected ? "true" : "false";
        var expanded = _expanded ? "true" : "false";
        var showLimits = _showLimits ? "true" : "false";
        var compactMode = _compactMode ? "true" : "false";
        var limitDisplayModeJson = JsonSerializer.Serialize(_limitDisplayMode);
        var metricsJson = JsonSerializer.Serialize(_metrics);

        try
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                $"window.__ttIslandCurrency={currencyJson};" +
                $"window.__ttIslandLocale={localeJson};" +
                $"window.__ttIslandStats={statsJson};" +
                $"window.__ttIslandLimits={limitsJson};" +
                $"window.__ttIslandConnected={connected};" +
                $"window.__ttIslandExpanded={expanded};" +
                $"window.__ttIslandShowLimits={showLimits};" +
                $"window.__ttIslandCompactMode={compactMode};" +
                $"window.__ttIslandLimitDisplayMode={limitDisplayModeJson};" +
                $"window.__ttIslandMetrics={metricsJson};" +
                "window.dispatchEvent(new Event('island:context'));");
        }
        catch { /* page is navigating */ }
    }

    private void SetExpanded(bool expanded)
    {
        if (_expanded == expanded) return;
        _expanded = expanded;
        if (!_coreReady) return;
        var value = expanded ? "true" : "false";
        try
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                $"window.__ttIslandExpanded={value};" +
                "window.dispatchEvent(new Event('island:expanded'));");
        }
        catch { /* page is navigating */ }
    }

    private void HoverTick()
    {
        if (!IsVisible || _hwnd == nint.Zero || _dragging || !GetCursorPos(out var cursor)) return;
        var inside = IsPointOnIsland(new System.Windows.Point(cursor.X, cursor.Y));
        var now = Environment.TickCount64;
        if (inside)
        {
            _lastInsideTick = now;
            SetClickThrough(false);
            if (!_suppressExpandUntilExit) SetExpanded(true);
            return;
        }

        _suppressExpandUntilExit = false;
        SetClickThrough(true);
        if (_autoCollapse && _expanded && now - _lastInsideTick >= CollapseDelayMs) SetExpanded(false);
    }

    private bool IsPointOnIsland(System.Windows.Point screenPoint)
    {
        try
        {
            var point = PointFromScreen(screenPoint);
            var width = _expanded ? ExpandedWidth : CompactWidth;
            var height = _expanded
                ? (_showLimits ? ExpandedHeight : ExpandedWithoutLimitsHeight)
                : CompactHeight;
            var left = (ActualWidth - width) / 2;
            return point.X >= left && point.X <= left + width && point.Y >= 0 && point.Y <= height;
        }
        catch
        {
            return false;
        }
    }

    private void BeginNativeDrag()
    {
        if (_hwnd == nint.Zero) return;
        _dragging = true;
        SetClickThrough(false);
        try
        {
            ReleaseCapture();
            SendMessage(_hwnd, WM_NCLBUTTONDOWN, (nint)HTCAPTION, nint.Zero);
        }
        finally
        {
            _dragging = false;
            _lastInsideTick = Environment.TickCount64;
            _saveTimer.Stop();
            SavePlacement();
        }
    }

    private void SetClickThrough(bool enabled)
    {
        if (_hwnd == nint.Zero || enabled == _clickThrough) return;
        var style = GetWindowExStyle(_hwnd).ToInt64();
        var updated = enabled ? style | WS_EX_TRANSPARENT : style & ~WS_EX_TRANSPARENT;
        SetWindowExStyle(_hwnd, (nint)updated);
        _clickThrough = enabled;
        SetWindowPos(
            _hwnd,
            nint.Zero,
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    }

    public static bool StoredEnabled
    {
        get
        {
            try
            {
                if (!File.Exists(SettingsPath)) return false;
                var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
                return settings?["IslandEnabled"]?.GetValue<bool>() == true;
            }
            catch { return false; }
        }
    }

    public static void StoreEnabled(bool enabled) => WriteSettings(settings => settings["IslandEnabled"] = enabled);

    public static bool StoredAutoCollapse => ReadBooleanSetting("IslandAutoCollapse", defaultValue: true);

    public static bool StoredShowLimits => ReadBooleanSetting("IslandShowLimits", defaultValue: true);

    public static bool StoredCompactMode => ReadBooleanSetting("IslandCompactMode", defaultValue: false);

    public static string StoredLimitDisplayMode
    {
        get
        {
            try
            {
                if (!File.Exists(SettingsPath)) return "used";
                var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
                return NormalizeLimitDisplayMode(settings?["IslandLimitDisplayMode"]?.GetValue<string>());
            }
            catch { return "used"; }
        }
    }

    public static string[] StoredMetrics
    {
        get
        {
            try
            {
                if (!File.Exists(SettingsPath)) return ["todayTokens", "todayCost"];
                var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
                var values = settings?["IslandMetrics"]?.AsArray()
                    .Select(node => node?.GetValue<string>() ?? "")
                    .ToArray();
                return NormalizeMetrics(values);
            }
            catch { return ["todayTokens", "todayCost"]; }
        }
    }

    public static void StoreAutoCollapse(bool enabled) =>
        WriteSettings(settings => settings["IslandAutoCollapse"] = enabled);

    public static void StoreShowLimits(bool enabled) =>
        WriteSettings(settings => settings["IslandShowLimits"] = enabled);

    public static void StoreCompactMode(bool enabled) =>
        WriteSettings(settings => settings["IslandCompactMode"] = enabled);

    public static void StoreLimitDisplayMode(string mode) =>
        WriteSettings(settings => settings["IslandLimitDisplayMode"] = NormalizeLimitDisplayMode(mode));

    public static void StoreMetrics(IReadOnlyList<string> metrics) =>
        WriteSettings(settings => settings["IslandMetrics"] = new JsonArray(
            NormalizeMetrics(metrics)
                .Select(value => (JsonNode?)JsonValue.Create(value))
                .ToArray()));

    private void RestorePlacement()
    {
        var workArea = SystemParameters.WorkArea;
        var left = workArea.Left + (workArea.Width - HostWidth) / 2;
        var top = workArea.Top;
        try
        {
            if (File.Exists(SettingsPath)
                && JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject() is { } settings
                && settings["IslandX"]?.GetValue<double>() is { } storedX
                && settings["IslandY"]?.GetValue<double>() is { } storedY
                && IsOnScreen(storedX, storedY))
            {
                left = storedX;
                top = storedY;
            }
        }
        catch { /* use top-center default */ }
        Left = ClampX(left);
        Top = ClampY(top);
    }

    private void SavePlacement()
    {
        if (_dragging || WindowState != WindowState.Normal || double.IsNaN(Left) || double.IsNaN(Top)) return;
        WriteSettings(settings =>
        {
            settings["IslandX"] = Left;
            settings["IslandY"] = Top;
        });
    }

    private static bool IsOnScreen(double x, double y)
    {
        var minX = SystemParameters.VirtualScreenLeft;
        var minY = SystemParameters.VirtualScreenTop;
        var maxX = minX + SystemParameters.VirtualScreenWidth;
        var maxY = minY + SystemParameters.VirtualScreenHeight;
        return x + HostWidth >= minX + 40 && y + CompactHeight >= minY
            && x <= maxX - 40 && y <= maxY - 20;
    }

    private static double ClampX(double x)
    {
        var min = SystemParameters.VirtualScreenLeft;
        var max = min + SystemParameters.VirtualScreenWidth - HostWidth;
        return Math.Max(min, Math.Min(x, Math.Max(min, max)));
    }

    private static double ClampY(double y)
    {
        var min = SystemParameters.VirtualScreenTop;
        var max = min + SystemParameters.VirtualScreenHeight - CompactHeight;
        return Math.Max(min, Math.Min(y, Math.Max(min, max)));
    }

    private static void WriteSettings(Action<JsonObject> mutate)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
            JsonObject settings;
            try
            {
                settings = File.Exists(SettingsPath)
                    ? JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject() ?? new JsonObject()
                    : new JsonObject();
            }
            catch { settings = new JsonObject(); }
            mutate(settings);
            File.WriteAllText(SettingsPath, settings.ToJsonString());
        }
        catch { /* best-effort native setting */ }
    }

    private static bool ReadBooleanSetting(string key, bool defaultValue)
    {
        try
        {
            if (!File.Exists(SettingsPath)) return defaultValue;
            var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
            return settings?[key]?.GetValue<bool>() ?? defaultValue;
        }
        catch { return defaultValue; }
    }

    private static string NormalizeLimitDisplayMode(string? value) =>
        string.Equals(value, "remaining", StringComparison.OrdinalIgnoreCase) ? "remaining" : "used";

    private static string[] NormalizeMetrics(IEnumerable<string>? values)
    {
        var result = new List<string>(2);
        foreach (var raw in values ?? [])
        {
            var value = string.IsNullOrWhiteSpace(raw) ? "" : raw.Trim();
            if (value.Length == 0) continue;
            if (!KnownMetricIds.Contains(value) && !value.StartsWith("claudeScoped:", StringComparison.Ordinal)) continue;
            if (value != "none" && result.Contains(value, StringComparer.Ordinal)) continue;
            result.Add(value);
            if (result.Count == 2) break;
        }
        if (result.Count == 0) result.Add("todayTokens");
        if (result.Count == 1) result.Add(result[0] == "todayCost" ? "todayTokens" : "todayCost");
        return result.ToArray();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_exiting)
        {
            e.Cancel = true;
            HideIsland();
            return;
        }
        SavePlacement();
        _hoverTimer.Stop();
        _saveTimer.Stop();
        _server.StatusChanged -= OnServerStatusChanged;
        base.OnClosing(e);
    }

    protected override void OnClosed(EventArgs e)
    {
        try { _webView.Dispose(); } catch { }
        base.OnClosed(e);
    }

    private const int WM_NCLBUTTONDOWN = 0xA1;
    private const int HTCAPTION = 2;
    private const int GWL_EXSTYLE = -20;
    private const long WS_EX_TRANSPARENT = 0x00000020L;
    private const long WS_EX_NOACTIVATE = 0x08000000L;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_FRAMECHANGED = 0x0020;

    private static nint GetWindowExStyle(nint hWnd) => IntPtr.Size == 8
        ? GetWindowLongPtr64(hWnd, GWL_EXSTYLE)
        : (nint)GetWindowLong32(hWnd, GWL_EXSTYLE);

    private static nint SetWindowExStyle(nint hWnd, nint style) => IntPtr.Size == 8
        ? SetWindowLongPtr64(hWnd, GWL_EXSTYLE, style)
        : (nint)SetWindowLong32(hWnd, GWL_EXSTYLE, style.ToInt32());

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern nint GetWindowLongPtr64(nint hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
    private static extern int GetWindowLong32(nint hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern nint SetWindowLongPtr64(nint hWnd, int nIndex, nint dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
    private static extern int SetWindowLong32(nint hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
        nint hWnd,
        nint hWndInsertAfter,
        int x,
        int y,
        int cx,
        int cy,
        uint uFlags);

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern nint SendMessage(nint hWnd, int msg, nint wParam, nint lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT point);
}
