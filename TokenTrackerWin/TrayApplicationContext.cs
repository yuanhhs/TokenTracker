using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using Microsoft.Win32;

namespace TokenTrackerWin;

/// <summary>Resident tray controller for the local-only dashboard.</summary>
internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly System.Windows.Threading.Dispatcher _uiDispatcher =
        System.Windows.Application.Current?.Dispatcher
        ?? System.Windows.Threading.Dispatcher.CurrentDispatcher;
    private readonly NotifyIcon _trayIcon;
    private readonly ServerManager _server = new();
    private readonly UsagePoller _poller;
    private DashboardWindow? _dashboard;
    private readonly ContextMenuStrip _menu;
    private readonly TrayMenuRenderer _menuRenderer;
    private readonly ToolStripMenuItem _summaryItem;
    private readonly ToolStripMenuItem _openDashboardItem;
    private readonly ToolStripMenuItem _syncItem;
    private readonly ToolStripMenuItem _startupItem;
    private readonly ToolStripMenuItem _checkUpdatesItem;
    private readonly ToolStripMenuItem _starItem;
    private readonly ToolStripMenuItem _quitItem;
    private UsagePoller.UsageStats? _lastStats;
    private string _localePreference = NativeLocalization.CurrentPreference;
    private string _themePreference = NativeTheme.CurrentPreference;
    private TrayStrings _strings = TrayStrings.For(NativeLocalization.CurrentResolvedLocale);
    private TrayMenuRenderer.Palette _menuPalette =
        TrayMenuRenderer.PaletteFor(NativeTheme.ResolveIsLight(NativeTheme.CurrentPreference));
    private Font? _menuFont;
    private Font? _summaryFont;
    private readonly UpdateChecker _updateChecker = new();
    private UpdateStrings _updateStrings = UpdateStrings.For(NativeLocalization.CurrentResolvedLocale);
    private bool _updateBalloonShown;
    private readonly System.Windows.Forms.Timer _refreshTimer = new() { Interval = 2000 };
    private readonly System.Windows.Forms.Timer _syncTimer = new() { Interval = 5 * 60 * 1000 };

    public TrayApplicationContext()
    {
        _poller = new UsagePoller(() => _server.BaseUrl);
        _menuRenderer = new TrayMenuRenderer(_menuPalette);
        _summaryItem = CreateMenuItem("", (_, _) => OpenDashboard());
        _openDashboardItem = CreateMenuItem("", (_, _) => OpenDashboard());
        _syncItem = CreateMenuItem("", (_, _) => _server.TriggerSync());
        _startupItem = CreateMenuItem("", OnToggleStartup);
        _startupItem.Checked = LaunchAtStartup.IsEnabled;
        _checkUpdatesItem = CreateMenuItem("", (_, _) => OnCheckUpdatesClicked());
        _starItem = CreateMenuItem("", (_, _) => OpenInBrowser(Constants.GitHubUrl));
        _quitItem = CreateMenuItem("", (_, _) => Quit());

        _menu = new ContextMenuStrip
        {
            AllowTransparency = true,
            DropShadowEnabled = false,
            Renderer = _menuRenderer,
            BackColor = _menuPalette.MenuBackground,
            ForeColor = _menuPalette.Text,
            Padding = new Padding(6),
            ShowCheckMargin = true,
            ShowImageMargin = false,
        };
        _menu.Items.Add(_summaryItem);
        _menu.Items.Add(CreateSeparator());
        _menu.Items.Add(_openDashboardItem);
        _menu.Items.Add(_syncItem);
        _menu.Items.Add(CreateSeparator());
        _menu.Items.Add(_startupItem);
        _menu.Items.Add(_checkUpdatesItem);
        _menu.Items.Add(_starItem);
        _menu.Items.Add(CreateSeparator());
        _menu.Items.Add(_quitItem);
        ApplyLocaleToMenu();
        _menu.Opened += (_, _) => TrayMenuRenderer.ApplyRoundedRegion(_menu);
        _menu.SizeChanged += (_, _) => TrayMenuRenderer.ApplyRoundedRegion(_menu);
        _menu.Opening += (_, _) =>
        {
            RefreshThemeFromDashboard();
            RefreshLocaleFromDashboard();
            RefreshSummary();
        };

        _trayIcon = new NotifyIcon
        {
            Icon = LoadTrayIcon(),
            Text = Constants.AppDisplayName,
            Visible = true,
            ContextMenuStrip = _menu,
        };
        _trayIcon.MouseClick += (_, e) => { if (e.Button == MouseButtons.Left) ToggleDashboard(); };
        _server.StatusChanged += OnServerStatusChanged;
        _server.SyncStarted += OnSyncStarted;
        _server.SyncCompleted += OnSyncCompleted;
        _poller.StatsUpdated += OnStatsUpdated;
        _refreshTimer.Tick += (_, _) => RefreshSummary();
        _syncTimer.Tick += (_, _) => TriggerBackgroundSync();
        _refreshTimer.Start();
        _ = _server.EnsureServerRunningAsync();
        _updateChecker.Changed += () => PostToUi(RefreshUpdateMenuItem);
        _updateChecker.QuitRequested += () => PostToUi(Quit);
        _ = _updateChecker.CheckAsync(silent: true);
    }

    private ToolStripMenuItem CreateMenuItem(string text, EventHandler onClick) => new(text, null, onClick)
    {
        BackColor = _menuPalette.MenuBackground,
        ForeColor = _menuPalette.Text,
        Margin = new Padding(0, 1, 0, 1),
        Padding = new Padding(0, 6, 0, 6),
    };

    private ToolStripSeparator CreateSeparator() => new()
    {
        BackColor = _menuPalette.MenuBackground,
        ForeColor = _menuPalette.Border,
        Margin = new Padding(0, 4, 0, 4),
    };

    private void ApplyLocaleToMenu()
    {
        _strings = TrayStrings.For(NativeLocalization.ResolveLocale(_localePreference));
        _updateStrings = UpdateStrings.For(NativeLocalization.ResolveLocale(_localePreference));
        _menuFont?.Dispose();
        _summaryFont?.Dispose();
        _menuFont = new Font(_strings.FontFamily, 9.5f, FontStyle.Regular, GraphicsUnit.Point);
        _summaryFont = new Font(_strings.FontFamily, 9.5f, FontStyle.Bold, GraphicsUnit.Point);
        _menu.Font = _menuFont;
        _summaryItem.Font = _summaryFont;
        _summaryItem.Text = $"{_strings.TodayTitle}: {_strings.NoData}";
        _openDashboardItem.Text = _strings.OpenDashboard;
        _syncItem.Text = _strings.SyncNow;
        _startupItem.Text = _strings.LaunchAtLogin;
        _starItem.Text = _strings.StarOnGitHub;
        _quitItem.Text = _strings.Quit;
        RefreshUpdateMenuItem();
        ApplyThemeToMenu();
        RefreshSummary();
    }

    private void ApplyThemeToMenu()
    {
        _menuRenderer.SetPalette(_menuPalette);
        _menu.BackColor = _menuPalette.MenuBackground;
        _menu.ForeColor = _menuPalette.Text;
        foreach (ToolStripItem item in _menu.Items)
        {
            item.BackColor = _menuPalette.MenuBackground;
            item.ForeColor = item is ToolStripSeparator
                ? _menuPalette.Border
                : item.Enabled ? _menuPalette.Text : _menuPalette.DisabledText;
        }
        _menu.Invalidate(true);
    }

    private void ApplyThemePreference(string preference)
    {
        var normalized = NativeTheme.NormalizePreference(preference);
        var nextPalette = TrayMenuRenderer.PaletteFor(NativeTheme.ResolveIsLight(normalized));
        if (_themePreference == normalized && _menuPalette == nextPalette) return;
        _themePreference = normalized;
        _menuPalette = nextPalette;
        NativeTheme.StorePreference(normalized);
        ApplyThemeToMenu();
    }

    private async void RefreshThemeFromDashboard()
    {
        var preference = _dashboard is not null
            ? await _dashboard.ReadThemePreferenceAsync()
            : NativeTheme.CurrentPreference;
        ApplyThemePreference(preference);
    }

    private async void RefreshLocaleFromDashboard()
    {
        var preference = _dashboard is not null
            ? await _dashboard.ReadLocalePreferenceAsync()
            : NativeLocalization.CurrentPreference;
        preference = NativeLocalization.NormalizePreference(preference);
        if (_localePreference == preference) return;
        _localePreference = preference;
        NativeLocalization.StorePreference(preference);
        ApplyLocaleToMenu();
    }

    private void OpenDashboard() { EnsureDashboard(); _dashboard!.ShowDashboard(); }
    private void ToggleDashboard() { EnsureDashboard(); _dashboard!.ToggleDashboard(); }

    private void EnsureDashboard()
    {
        if (_dashboard is not null) return;
        var dashboard = new DashboardWindow(_server);
        _dashboard = dashboard;
        dashboard.ReleasedForIdle += OnDashboardReleasedForIdle;
        dashboard.CurrencyChanged += () => PostToUi(RefreshSummary);
        dashboard.LocaleChanged += () => PostToUi(RefreshLocaleFromDashboard);
        dashboard.ThemeChanged += () => PostToUi(RefreshThemeFromDashboard);
        dashboard.NotificationRequested += (title, body) => PostToUi(() =>
            _trayIcon.ShowBalloonTip(7000, title, body, ToolTipIcon.Warning));
    }

    private void OnDashboardReleasedForIdle(DashboardWindow dashboard)
    {
        if (!ReferenceEquals(_dashboard, dashboard)) return;
        dashboard.ReleasedForIdle -= OnDashboardReleasedForIdle;
        _dashboard = null;
    }

    private void OnServerStatusChanged(ServerManager.ServerStatus status)
    {
        PostToUi(() =>
        {
            if (status == ServerManager.ServerStatus.Running)
            {
                _poller.Start();
                _poller.RefreshNow();
                _syncTimer.Start();
                TriggerBackgroundSync();
            }
            else if (status == ServerManager.ServerStatus.Failed)
            {
                _syncTimer.Stop();
                _trayIcon.ShowBalloonTip(5000, Constants.AppDisplayName,
                    _server.LastError ?? "The local server stopped responding.", ToolTipIcon.Warning);
            }
        });
    }

    private void TriggerBackgroundSync()
    {
        if (_server.Status == ServerManager.ServerStatus.Running) _server.TriggerBackgroundSync();
    }

    private void OnSyncStarted() { }
    private void OnSyncCompleted() => _poller.RefreshNow();
    private void OnStatsUpdated(UsagePoller.UsageStats stats) { _lastStats = stats; PostToUi(RefreshSummary); }

    private async void RefreshSummary()
    {
        var (symbol, rate) = IsDashboardOpen()
            ? await _dashboard!.ReadCurrencyAsync()
            : Currency.ReadPersisted() ?? ("$", 1m);
        if (_lastStats is not { } s)
        {
            _summaryItem.Text = $"{_strings.TodayTitle}: {_strings.NoData}";
            return;
        }
        var cost = symbol + (s.TodayCostUsd * rate).ToString("0.00", CultureInfo.InvariantCulture);
        _summaryItem.Text = s.TodayTokens <= 0
            ? $"{_strings.TodayTitle}: {_strings.NoData}"
            : $"{_strings.TodayTitle}: {UsagePoller.FormatTokens(s.TodayTokens)} {_strings.TokensUnit} · {cost}";
        RefreshTrayIconForTheme();
    }

    private bool IsDashboardOpen() => _dashboard is not null && _dashboard.IsVisible
        && _dashboard.WindowState != System.Windows.WindowState.Minimized;

    private void PostToUi(Action action)
    {
        if (_uiDispatcher.HasShutdownStarted || _uiDispatcher.HasShutdownFinished) return;
        if (_uiDispatcher.CheckAccess()) action(); else _uiDispatcher.BeginInvoke(action);
    }

    private void OnToggleStartup(object? sender, EventArgs e)
    {
        LaunchAtStartup.Toggle();
        _startupItem.Checked = LaunchAtStartup.IsEnabled;
    }

    private void OnCheckUpdatesClicked()
    {
        if (_updateChecker.State == UpdateChecker.UpdateState.UpdateAvailable)
            _ = _updateChecker.DownloadAndInstallAsync();
        else if (_updateChecker.State == UpdateChecker.UpdateState.Idle) _ = RunManualCheckAsync();
    }

    private async Task RunManualCheckAsync()
    {
        var outcome = await _updateChecker.CheckAsync(silent: false);
        if (outcome == UpdateChecker.CheckOutcome.UpdateAvailable)
        {
            var confirm = MessageBox.Show(
                string.Format(_updateStrings.UpdateFoundPrompt, _updateChecker.LatestVersion, _updateChecker.CurrentVersion),
                _updateStrings.UpdateFoundTitle, MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (confirm == DialogResult.Yes) _ = _updateChecker.DownloadAndInstallAsync();
        }
        else if (outcome == UpdateChecker.CheckOutcome.UpToDate)
            MessageBox.Show(string.Format(_updateStrings.UpToDateMessage, _updateChecker.CurrentVersion),
                _updateStrings.UpToDateTitle, MessageBoxButtons.OK, MessageBoxIcon.Information);
        else if (outcome == UpdateChecker.CheckOutcome.Failed)
            MessageBox.Show(_updateStrings.ErrorMessage, _updateStrings.ErrorTitle,
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private void RefreshUpdateMenuItem()
    {
        switch (_updateChecker.State)
        {
            case UpdateChecker.UpdateState.Checking:
                _checkUpdatesItem.Text = _updateStrings.Checking; _checkUpdatesItem.Enabled = false; break;
            case UpdateChecker.UpdateState.UpdateAvailable:
                _checkUpdatesItem.Text = string.Format(_updateStrings.UpdateNow, _updateChecker.LatestVersion);
                _checkUpdatesItem.Enabled = true;
                if (!_updateBalloonShown)
                {
                    _updateBalloonShown = true;
                    _trayIcon.ShowBalloonTip(5000, Constants.AppDisplayName,
                        string.Format(_updateStrings.NewVersionBalloon, _updateChecker.LatestVersion), ToolTipIcon.Info);
                }
                break;
            case UpdateChecker.UpdateState.Downloading:
                _checkUpdatesItem.Text = string.Format(_updateStrings.Downloading, _updateChecker.ProgressPercent);
                _checkUpdatesItem.Enabled = false; break;
            case UpdateChecker.UpdateState.Installing:
                _checkUpdatesItem.Text = _updateStrings.Installing; _checkUpdatesItem.Enabled = false; break;
            default:
                _checkUpdatesItem.Text = _updateStrings.CheckForUpdates; _checkUpdatesItem.Enabled = true; break;
        }
        _checkUpdatesItem.ForeColor = _checkUpdatesItem.Enabled ? _menuPalette.Text : _menuPalette.DisabledText;
    }

    private bool? _lastIconLight;
    private Icon LoadTrayIcon()
    {
        _lastIconLight = IsTaskbarLight();
        return LoadMascotIcon(_lastIconLight.Value) ?? SystemIcons.Application;
    }

    private void RefreshTrayIconForTheme()
    {
        bool light = IsTaskbarLight();
        if (_lastIconLight == light) return;
        var icon = LoadMascotIcon(light);
        if (icon is null) return;
        _lastIconLight = light;
        var old = _trayIcon.Icon;
        _trayIcon.Icon = icon;
        old?.Dispose();
    }

    private static Icon? LoadMascotIcon(bool taskbarLight)
    {
        var file = taskbarLight ? "tray-mascot-onLight.ico" : "tray-mascot-onDark.ico";
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "assets", file);
            if (File.Exists(path)) return new Icon(path);
        }
        catch { }
        return null;
    }

    private static bool IsTaskbarLight()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return (key?.GetValue("SystemUsesLightTheme") as int?) == 1;
        }
        catch { return false; }
    }

    private static void OpenInBrowser(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    }

    private void Quit()
    {
        _refreshTimer.Stop(); _syncTimer.Stop(); _trayIcon.Visible = false;
        _poller.Dispose(); _server.StopServer(); ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _refreshTimer.Dispose(); _syncTimer.Dispose(); _poller.Dispose(); _server.Dispose();
            _trayIcon.Dispose(); _menu.Dispose(); _menuFont?.Dispose(); _summaryFont?.Dispose();
            _dashboard?.Shutdown();
        }
        base.Dispose(disposing);
    }
}
