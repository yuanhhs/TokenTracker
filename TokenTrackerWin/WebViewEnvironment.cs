using System.IO;
using Microsoft.Web.WebView2.Core;

namespace TokenTrackerWin;

/// <summary>Reopened dashboard windows reuse the local profile and browser-process options.</summary>
internal static class WebViewEnvironment
{
    private static Task<CoreWebView2Environment>? _environment;

    public static Task<CoreWebView2Environment> GetAsync() => _environment ??= CreateAsync();

    private static async Task<CoreWebView2Environment> CreateAsync()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokenTracker");
        var profile = Path.Combine(root, "LocalWebView2");
        Directory.CreateDirectory(profile);
        Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");
        return await CoreWebView2Environment.CreateAsync(null, profile, new CoreWebView2EnvironmentOptions
        {
            AdditionalBrowserArguments = "--disable-background-timer-throttling " +
                "--disable-renderer-backgrounding --disable-backgrounding-occluded-windows",
        });
    }
}
