using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using WpfWindow = System.Windows.Window;

namespace TokenTrackerWin;

/// <summary>A transparent PicBoard-style ball and its compact clipboard/usage panel.</summary>
internal sealed class FloatingWindow : WpfWindow
{
    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokenTracker", "floating-window.json");
    private readonly ServerManager _server;
    private readonly ClipboardHistoryService _clipboard;
    private readonly FloatingWindowPreferences _preferences;
    private readonly string _settingsPath;
    private readonly WebView2CompositionControl _webView = new() { AllowExternalDrop = false };
    private readonly System.Windows.Threading.DispatcherTimer _cursorTimer = new() { Interval = TimeSpan.FromMilliseconds(50) };
    private nint _hwnd;
    private bool _coreReady;
    private bool _pageReady;
    private bool _initializing;
    private bool _expanded;
    private bool _dragging;
    private bool _exiting;
    private string? _lastState;
    private System.Drawing.Point? _lastCursor;
    private UsagePoller.UsageStats? _stats;
    private DateTimeOffset? _updatedAt;
    private string _currencySymbol = "$";
    private decimal _currencyRate = 1m;
    private string _themePreference = NativeTheme.CurrentPreference;

    public bool Enabled => _preferences.Enabled;
    public event Action? EnabledChanged;
    public event Action<string>? DashboardRequested;
    public event Action? RefreshRequested;
    public event Action? Failed;

    public FloatingWindow(ServerManager server, ClipboardHistoryService clipboard, string? preferencesPath = null)
    {
        _server = server;
        _clipboard = clipboard;
        _settingsPath = preferencesPath ?? SettingsPath;
        _preferences = FloatingWindowPreferences.Read(_settingsPath);
        Title = "TokenTracker 悬浮面板";
        Width = Height = FloatingWindowGeometry.BallSize;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = System.Windows.Media.Brushes.Transparent;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        Content = _webView;
        Loaded += async (_, _) => await InitializeAsync();
        _clipboard.Changed += OnClipboardChanged;
        _server.StatusChanged += OnServerStatusChanged;
        _cursorTimer.Tick += (_, _) => PublishCursor();
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        _hwnd = new WindowInteropHelper(this).Handle;
        HwndSource.FromHwnd(_hwnd)?.AddHook(WindowMessage);
        PlaceWindow();
    }

    private nint WindowMessage(nint hwnd, int message, nint wParam, nint lParam, ref bool handled)
    {
        if (message is 0x007E or 0x02E0) // WM_DISPLAYCHANGE / WM_DPICHANGED
            Dispatcher.BeginInvoke(new Action(() => { if (!_dragging && !_exiting) PlaceWindow(); }));
        return 0;
    }

    public void ShowFloating()
    {
        if (_exiting) return;
        _preferences.Enabled = true;
        _preferences.Save(_settingsPath);
        if (!IsVisible) Show();
        PlaceWindow();
        _cursorTimer.Start();
        EnabledChanged?.Invoke();
    }

    public void HideFloating()
    {
        if (_exiting) return;
        SetExpanded(false);
        _preferences.Enabled = false;
        _preferences.Save(_settingsPath);
        _cursorTimer.Stop();
        Hide();
        EnabledChanged?.Invoke();
    }

    public void ResetPosition()
    {
        _preferences.X = _preferences.Y = null;
        _expanded = false;
        ShowFloating();
        _lastState = null;
        PushState();
    }

    private void SetExpanded(bool expanded)
    {
        if (_exiting || _expanded == expanded) return;
        _expanded = expanded;
        PlaceWindow();
        PushState();
        if (expanded)
        {
            Activate();
            _webView.Focus();
            RefreshRequested?.Invoke();
        }
        else _lastCursor = null;
    }

    public void UpdateStats(UsagePoller.UsageStats stats)
    {
        _stats = stats;
        _updatedAt = DateTimeOffset.Now;
        PushState();
    }

    public void UpdateAppearance(string symbol, decimal rate, string theme)
    {
        _currencySymbol = symbol;
        _currencyRate = rate;
        _themePreference = theme;
        PushState();
    }

    private void PlaceWindow()
    {
        if (_hwnd == 0 || _exiting) return;
        var screen = _preferences.X is { } x && _preferences.Y is { } y
            ? Screen.FromPoint(new System.Drawing.Point(x, y)) : Screen.PrimaryScreen!;
        var area = screen.WorkingArea;
        var work = new FloatingRect(area.X, area.Y, area.Width, area.Height);
        var scale = MonitorScale(screen);
        var ball = FloatingWindowGeometry.Ball(_preferences.X, _preferences.Y, work, scale);
        _preferences.X = ball.X;
        _preferences.Y = ball.Y;
        var bounds = _expanded ? FloatingWindowGeometry.Panel(ball, work, scale) : ball;
        SetWindowPos(_hwnd, 0, bounds.X, bounds.Y, bounds.Width, bounds.Height, 0x0014); // no activate / z-order
        _preferences.Save(_settingsPath);
    }

    private double MonitorScale(Screen screen)
    {
        try
        {
            var point = new NativePoint { X = screen.Bounds.X + screen.Bounds.Width / 2, Y = screen.Bounds.Y + screen.Bounds.Height / 2 };
            var monitor = MonitorFromPoint(point, 2);
            if (GetDpiForMonitor(monitor, 0, out var dpi, out _) == 0 && dpi > 0) return dpi / 96d;
        }
        catch { /* Windows can change the monitor between enumeration and this query. */ }
        return Math.Max(96u, GetDpiForWindow(_hwnd)) / 96d;
    }

    private void BeginDrag()
    {
        if (_exiting || !IsVisible || _dragging || (GetAsyncKeyState(1) & 0x8000) == 0) return;
        GetWindowRect(_hwnd, out var before);
        _dragging = true;
        try
        {
            ReleaseCapture();
            SendMessage(_hwnd, 0x00A1, 2, 0); // WM_NCLBUTTONDOWN / HTCAPTION
            GetWindowRect(_hwnd, out var after);
            _preferences.X = (_preferences.X ?? before.Left) + after.Left - before.Left;
            _preferences.Y = (_preferences.Y ?? before.Top) + after.Top - before.Top;
        }
        finally { _dragging = false; PlaceWindow(); _lastCursor = null; }
    }

    private async Task InitializeAsync()
    {
        if (_initializing || _coreReady || _exiting) return;
        _initializing = true;
        try
        {
            var environment = await WebViewEnvironment.GetAsync();
            if (_exiting) return;
            await _webView.EnsureCoreWebView2Async(environment);
            if (_exiting) return;
            _webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);
            var core = _webView.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsPinchZoomEnabled = false;
            if (Directory.Exists(_clipboard.AssetsDirectory))
                core.SetVirtualHostNameToFolderMapping("clipboard.tokentracker.local", _clipboard.AssetsDirectory,
                    CoreWebView2HostResourceAccessKind.DenyCors);
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.NavigationStarting += (_, e) =>
            {
                e.Cancel = !FloatingBridgePolicy.IsTrustedDocument(e.Uri, _server.BaseUrl);
                if (!e.Cancel) { _pageReady = false; _lastState = null; }
            };
            core.WebMessageReceived += OnWebMessage;
            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "document.documentElement.classList.add('native-app','native-windows-app');");
            _coreReady = true;
            Navigate();
        }
        catch (Exception error)
        {
            if (!_exiting)
            {
                Diag.Log("floating", $"Window initialization failed: {error.GetType().Name}");
                HideFloating();
                Failed?.Invoke();
            }
        }
        finally { _initializing = false; }
    }

    private void Navigate()
    {
        if (!_coreReady || _exiting || _server.Status != ServerManager.ServerStatus.Running) return;
        var url = _server.BaseUrl + "/floating.html?app=1";
        if (_webView.CoreWebView2.Source != url) _webView.CoreWebView2.Navigate(url);
    }

    private void OnServerStatusChanged(ServerManager.ServerStatus status)
    {
        if (status == ServerManager.ServerStatus.Running && !_exiting)
            Dispatcher.BeginInvoke(new Action(Navigate));
    }

    private void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (_exiting || !FloatingBridgePolicy.IsTrustedDocument(e.Source, _server.BaseUrl)) return;
        try
        {
            using var document = JsonDocument.Parse(e.TryGetWebMessageAsString());
            var root = document.RootElement;
            var type = root.GetProperty("type").GetString();
            if (type == "clipboard:request") { _ = HandleClipboardAsync(root.Clone()); return; }
            if (type != "floating:request") return;
            switch (root.GetProperty("action").GetString())
            {
                case "ready": _pageReady = true; _lastState = null; PushState(); break;
                case "toggle": SetExpanded(!_expanded); break;
                case "collapse": SetExpanded(false); break;
                case "hide": HideFloating(); break;
                case "drag": Dispatcher.BeginInvoke(new Action(BeginDrag)); break;
                case "refresh": RefreshRequested?.Invoke(); break;
                case "clipboard": SetExpanded(false); DashboardRequested?.Invoke("clipboard"); break;
                case "dashboard": SetExpanded(false); DashboardRequested?.Invoke("dashboard"); break;
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException or ArgumentException)
        { /* Reject malformed bridge messages without logging clipboard contents. */ }
    }

    private async Task HandleClipboardAsync(JsonElement message)
    {
        if (!message.TryGetProperty("requestId", out var id) || id.ValueKind != JsonValueKind.String) return;
        var requestId = id.GetString();
        if (requestId is null || requestId.Length > 100) return;
        try
        {
            var action = message.GetProperty("action").GetString() ?? "";
            if (!FloatingBridgePolicy.IsClipboardActionAllowed(action)) throw new InvalidOperationException();
            var args = message.TryGetProperty("args", out var supplied) && supplied.ValueKind == JsonValueKind.Object
                ? supplied : JsonSerializer.SerializeToElement(new { });
            var result = await _clipboard.ExecuteAsync(action, args, this);
            Post(new { type = "clipboard:response", requestId, result });
        }
        catch (Exception error)
        {
            Post(new { type = "clipboard:response", requestId, error = ClipboardHistoryService.ErrorCode(error) });
        }
    }

    private void OnClipboardChanged() => Post(new { type = "clipboard:changed" });

    private void PushState()
    {
        if (!_coreReady || !_pageReady || _exiting) return;
        var summary = FloatingUsageSummary.Create(_stats, _updatedAt, _currencySymbol, _currencyRate, DateTime.Now);
        var state = new
        {
            expanded = _expanded,
            isLight = NativeTheme.ResolveIsLight(_themePreference),
            date = summary.Date,
            todayTokens = summary.Tokens,
            exactTokens = summary.ExactTokens,
            todayCost = summary.Cost,
            updatedAt = summary.UpdatedAt,
        };
        var json = JsonSerializer.Serialize(state);
        if (json == _lastState) return;
        _lastState = json;
        Post(new { type = "floating:state", state });
    }

    private void PublishCursor()
    {
        if (!_pageReady || _expanded || !IsVisible || _dragging) return;
        var position = System.Windows.Forms.Cursor.Position;
        if (_lastCursor == position) return;
        _lastCursor = position;
        var local = _webView.PointFromScreen(new System.Windows.Point(position.X, position.Y));
        Post(new { type = "floating:cursor", x = local.X, y = local.Y });
    }

    private void Post(object message)
    {
        if (_exiting) return;
        if (!Dispatcher.CheckAccess()) { Dispatcher.BeginInvoke(new Action(() => Post(message))); return; }
        if (!_coreReady || !_pageReady) return;
        try
        {
            if (FloatingBridgePolicy.IsTrustedDocument(_webView.CoreWebView2.Source, _server.BaseUrl))
                _webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message, ClipboardHistoryStore.JsonOptions));
        }
        catch (InvalidOperationException) { /* The window may have closed during a clipboard operation. */ }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_exiting)
        {
            e.Cancel = true;
            if (_expanded) SetExpanded(false); else HideFloating();
        }
        base.OnClosing(e);
    }

    public void Shutdown()
    {
        if (_exiting) return;
        _exiting = true;
        _cursorTimer.Stop();
        _clipboard.Changed -= OnClipboardChanged;
        _server.StatusChanged -= OnServerStatusChanged;
        if (_hwnd != 0) HwndSource.FromHwnd(_hwnd)?.RemoveHook(WindowMessage);
        Content = null;
        _coreReady = false;
        _webView.Dispose();
        Close();
    }

    [StructLayout(LayoutKind.Sequential)] private struct NativePoint { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] private struct NativeRect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool SetWindowPos(nint hwnd, nint after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint hwnd, out NativeRect rect);
    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern nint SendMessage(nint hwnd, uint message, nint wParam, nint lParam);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(nint hwnd);
    [DllImport("user32.dll")] private static extern nint MonitorFromPoint(NativePoint point, uint flags);
    [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(nint monitor, int type, out uint x, out uint y);
}
