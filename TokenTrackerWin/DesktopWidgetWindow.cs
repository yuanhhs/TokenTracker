using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace TokenTrackerWin;

/// <summary>
/// A transparent, borderless Windows host for one TokenTracker desktop widget.
/// The web content reads the same loopback APIs as the dashboard, so the native
/// host only owns window behavior, placement, appearance, and lifecycle.
/// </summary>
internal sealed class DesktopWidgetWindow : Window
{
    private readonly WebView2CompositionControl _webView = new() { AllowExternalDrop = false };
    private readonly ServerManager _server;
    private readonly string _kind;
    private readonly int _defaultIndex;
    private readonly System.Windows.Threading.DispatcherTimer _saveTimer;
    private bool _coreReady;
    private bool _exiting;
    private bool _dragging;
    private nint _hwnd;
    private string _size;
    private string _locale = NativeLocalization.CurrentResolvedLocale;
    private string _theme = NativeTheme.CurrentPreference;
    private string _currencySymbol = "$";
    private decimal _currencyRate = 1m;

    public event Action<string>? CloseRequested;
    public event Action? DashboardRequested;
    public event Action? SettingsRequested;

    public DesktopWidgetWindow(ServerManager server, string kind, int defaultIndex)
    {
        _server = server;
        _kind = kind;
        _defaultIndex = defaultIndex;
        _size = DesktopWidgetSettings.GetSize(kind);

        if (Currency.ReadPersisted() is { } cached)
        {
            _currencySymbol = cached.Symbol;
            _currencyRate = cached.Rate;
        }

        Title = $"{Constants.AppDisplayName} Widget - {kind}";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = System.Windows.Media.Brushes.Transparent;
        ShowInTaskbar = false;
        ShowActivated = false;
        WindowStartupLocation = WindowStartupLocation.Manual;
        Topmost = DesktopWidgetSettings.StoredAlwaysOnTop;
        Content = _webView;

        ApplyDimensions();
        RestorePlacement();

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
        var style = GetWindowExStyle(_hwnd).ToInt64() | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
        SetWindowExStyle(_hwnd, (nint)style);
        SetWindowPos(
            _hwnd,
            nint.Zero,
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    }

    private async Task InitializeWebViewAsync()
    {
        if (_coreReady) return;

        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TokenTracker", "WebView2Widgets", _kind);
        Directory.CreateDirectory(userDataFolder);
        Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");

        var options = new CoreWebView2EnvironmentOptions
        {
            AdditionalBrowserArguments =
                "--disable-background-timer-throttling " +
                "--disable-backgrounding-occluded-windows " +
                "--disable-renderer-backgrounding",
        };
        var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
        await _webView.EnsureCoreWebView2Async(environment);
        _coreReady = true;

        var core = _webView.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.WebMessageReceived += (_, args) =>
        {
            string message;
            try { message = args.TryGetWebMessageAsString(); }
            catch { return; }

            switch (message)
            {
                case "widget:drag":
                    BeginNativeDrag();
                    break;
                case "widget:close":
                    CloseRequested?.Invoke(_kind);
                    break;
                case "widget:dashboard":
                    DashboardRequested?.Invoke();
                    break;
                case "widget:settings":
                    SettingsRequested?.Invoke();
                    break;
                case "widget:refresh":
                    RefreshData();
                    break;
            }
        };
        core.NavigationCompleted += (_, _) => PushContext();
        NavigateWhenServerReady();
    }

    private void OnServerStatusChanged(ServerManager.ServerStatus status)
    {
        try
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                PushContext();
                if (status == ServerManager.ServerStatus.Running)
                {
                    NavigateWhenServerReady();
                    RefreshData();
                }
            }));
        }
        catch
        {
            // Window is shutting down.
        }
    }

    private void NavigateWhenServerReady()
    {
        if (!_coreReady || _server.Status != ServerManager.ServerStatus.Running) return;
        var url = _server.BaseUrl + "/widget.html?app=1&type="
            + Uri.EscapeDataString(_kind) + "&size=" + Uri.EscapeDataString(_size);
        if (!string.Equals(_webView.CoreWebView2.Source, url, StringComparison.OrdinalIgnoreCase))
            _webView.CoreWebView2.Navigate(url);
    }

    public void ShowWidget()
    {
        if (!IsVisible) Show();
        Topmost = DesktopWidgetSettings.StoredAlwaysOnTop;
        PushContext();
    }

    public void HideWidget()
    {
        _saveTimer.Stop();
        Hide();
    }

    public void ApplyConfiguration(string size, bool alwaysOnTop)
    {
        var normalized = DesktopWidgetSettings.NormalizeSize(_kind, size);
        var changed = !string.Equals(_size, normalized, StringComparison.Ordinal);
        _size = normalized;
        Topmost = alwaysOnTop;
        if (changed)
        {
            ApplyDimensions();
            ClampPlacement();
            SavePlacement();
        }
        PushContext();
    }

    public void ApplyAppearance(string locale, string theme, string currencySymbol, decimal currencyRate)
    {
        _locale = string.IsNullOrWhiteSpace(locale) ? "en" : locale;
        _theme = NativeTheme.NormalizePreference(theme);
        _currencySymbol = string.IsNullOrWhiteSpace(currencySymbol) ? "$" : currencySymbol;
        _currencyRate = currencyRate > 0 ? currencyRate : 1m;
        PushContext();
    }

    public void RefreshData()
    {
        if (!_coreReady) return;
        try
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                "window.dispatchEvent(new Event('widget:refresh'));true;");
        }
        catch
        {
            // Page is navigating.
        }
    }

    public void ResetPlacement()
    {
        var (left, top) = DefaultPlacement();
        Left = left;
        Top = top;
        ClampPlacement();
        SavePlacement();
    }

    public void Shutdown()
    {
        _exiting = true;
        Close();
    }

    private void PushContext()
    {
        if (!_coreReady) return;
        var context = JsonSerializer.Serialize(new
        {
            kind = _kind,
            size = _size,
            locale = _locale,
            theme = NativeTheme.ResolveIsLight(_theme) ? "light" : "dark",
            connected = _server.Status == ServerManager.ServerStatus.Running,
            currency = new { symbol = _currencySymbol, rate = _currencyRate },
        });
        try
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                $"window.__ttWidgetContext={context};" +
                "window.dispatchEvent(new CustomEvent('widget:context'));true;");
        }
        catch
        {
            // Page is navigating.
        }
    }

    private void ApplyDimensions()
    {
        var dimensions = DesktopWidgetSettings.GetDimensions(_kind, _size);
        Width = dimensions.Width;
        Height = dimensions.Height;
    }

    private void RestorePlacement()
    {
        if (DesktopWidgetSettings.ReadPlacement(_kind) is { } stored
            && IsOnScreen(stored.X, stored.Y))
        {
            Left = stored.X;
            Top = stored.Y;
            ClampPlacement();
            return;
        }
        var fallback = DefaultPlacement();
        Left = fallback.Left;
        Top = fallback.Top;
        ClampPlacement();
    }

    private (double Left, double Top) DefaultPlacement()
    {
        var workArea = SystemParameters.WorkArea;
        var column = _defaultIndex % 2;
        var row = _defaultIndex / 2;
        var left = workArea.Right - Width - 24 - column * 420;
        var top = workArea.Top + 24 + row * 230;
        return (left, top);
    }

    private void ClampPlacement()
    {
        var minX = SystemParameters.VirtualScreenLeft;
        var minY = SystemParameters.VirtualScreenTop;
        var maxX = minX + SystemParameters.VirtualScreenWidth - Width;
        var maxY = minY + SystemParameters.VirtualScreenHeight - Height;
        Left = Math.Max(minX, Math.Min(Left, Math.Max(minX, maxX)));
        Top = Math.Max(minY, Math.Min(Top, Math.Max(minY, maxY)));
    }

    private bool IsOnScreen(double x, double y)
    {
        if (!double.IsFinite(x) || !double.IsFinite(y)) return false;
        var left = SystemParameters.VirtualScreenLeft;
        var top = SystemParameters.VirtualScreenTop;
        var right = left + SystemParameters.VirtualScreenWidth;
        var bottom = top + SystemParameters.VirtualScreenHeight;
        return x + 64 > left && y + 64 > top && x < right && y < bottom;
    }

    private void SavePlacement()
    {
        if (_dragging || WindowState != WindowState.Normal
            || double.IsNaN(Left) || double.IsNaN(Top)) return;
        DesktopWidgetSettings.StorePlacement(_kind, Left, Top);
    }

    private void BeginNativeDrag()
    {
        if (_hwnd == nint.Zero) return;
        _dragging = true;
        try
        {
            ReleaseCapture();
            SendMessage(_hwnd, WM_NCLBUTTONDOWN, (nint)HTCAPTION, nint.Zero);
        }
        finally
        {
            _dragging = false;
            ClampPlacement();
            SavePlacement();
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_exiting)
        {
            e.Cancel = true;
            HideWidget();
            return;
        }
        SavePlacement();
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
    private const long WS_EX_TOOLWINDOW = 0x00000080L;
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
}
