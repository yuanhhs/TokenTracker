using System.Text.Json;
using Xunit;

namespace TokenTrackerWin;

public sealed class FloatingWindowTests
{
    [Theory]
    [InlineData(-1920, 0, 1920, 1040, 1)]
    [InlineData(0, 40, 1920, 1040, 1.25)]
    [InlineData(1920, -1440, 2560, 1400, 1.5)]
    [InlineData(0, 0, 800, 550, 2)]
    public void BallAndPanelStayWithinTheMonitorWorkArea(int x, int y, int width, int height, double scale)
    {
        var area = new FloatingRect(x, y, width, height);
        foreach (var point in new[] { (x, y), (x + width - 5, y + height - 5), (int.MinValue, int.MaxValue) })
        {
            var ball = FloatingWindowGeometry.Ball(point.Item1, point.Item2, area, scale);
            var panel = FloatingWindowGeometry.Panel(ball, area, scale);
            foreach (var rect in new[] { ball, panel })
            {
                Assert.InRange(rect.X, area.X, area.Right - rect.Width);
                Assert.InRange(rect.Y, area.Y, area.Bottom - rect.Height);
            }
            Assert.Equal((int)Math.Round(88 * scale), ball.Width);
        }
    }

    [Fact]
    public void ExpandingDoesNotChangeTheSavedBallAnchor()
    {
        var area = new FloatingRect(0, 0, 1920, 1040);
        var ball = FloatingWindowGeometry.Ball(1800, 850, area, 1);
        var panel = FloatingWindowGeometry.Panel(ball, area, 1);
        Assert.Equal(ball.Right, panel.Right);
        Assert.Equal(ball.Bottom, panel.Bottom);
        Assert.Equal(ball, FloatingWindowGeometry.Ball(ball.X, ball.Y, area, 1));
    }

    [Fact]
    public void PositionAndHiddenPreferenceSurviveRestartAndCorruptionUsesDefaults()
    {
        var directory = Path.Combine(Path.GetTempPath(), "TokenTrackerFloatingTests", Guid.NewGuid().ToString("N"));
        var path = Path.Combine(directory, "floating.json");
        try
        {
            new FloatingWindowPreferences { Enabled = false, X = -400, Y = 123 }.Save(path);
            var restored = FloatingWindowPreferences.Read(path);
            Assert.False(restored.Enabled);
            Assert.Equal(-400, restored.X);
            Assert.Equal(123, restored.Y);
            Assert.Single(Directory.GetFiles(directory));
            File.WriteAllText(path, "{broken");
            Assert.True(FloatingWindowPreferences.Read(path).Enabled);
            Assert.Null(FloatingWindowPreferences.Read(path).X);
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true); }
    }

    [Theory]
    [InlineData("http://127.0.0.1:7681/floating.html?app=1", true)]
    [InlineData("http://127.0.0.1:7682/floating.html", false)]
    [InlineData("https://127.0.0.1:7681/floating.html", false)]
    [InlineData("http://127.0.0.1:7681/dashboard", false)]
    [InlineData("http://127.0.0.1:7681.evil.test/floating.html", false)]
    [InlineData("https://example.com/floating.html", false)]
    [InlineData("file:///floating.html", false)]
    [InlineData("data:text/html,hello", false)]
    public void OnlyTheFloatingDocumentOnTheExactServerCanUseTheBridge(string source, bool expected)
    {
        Assert.Equal(expected, FloatingBridgePolicy.IsTrustedDocument(source, "http://127.0.0.1:7681"));
    }

    [Theory]
    [InlineData("list", true)]
    [InlineData("copy", true)]
    [InlineData("capture", true)]
    [InlineData("clear", false)]
    [InlineData("delete", false)]
    [InlineData("export", false)]
    public void CompactPanelOnlyExposesItsRequiredClipboardActions(string action, bool expected)
    {
        Assert.Equal(expected, FloatingBridgePolicy.IsClipboardActionAllowed(action));
    }

    [Fact]
    public void MidnightClearsYesterdayInsteadOfRelabelingItsTotals()
    {
        var yesterday = new UsagePoller.UsageStats(500_000, 3.5m, "2026-09-13");
        var summary = FloatingUsageSummary.Create(yesterday, DateTimeOffset.Now, "¥", 7.2m, new DateTime(2026, 9, 14));
        Assert.Equal("2026-09-14", summary.Date);
        Assert.Null(summary.Tokens);
        Assert.Null(summary.Cost);
        Assert.Null(summary.UpdatedAt);
    }

    [Fact]
    public void ZeroUsageIsDifferentFromLoadingAndCurrencyUsesTheDashboardRate()
    {
        var now = new DateTime(2026, 9, 14);
        var zero = new UsagePoller.UsageStats(0, 0m, "2026-09-14");
        var summary = FloatingUsageSummary.Create(zero, DateTimeOffset.Now, "$", 1m, now);
        Assert.Equal("0", summary.Tokens);
        Assert.Equal("$0.00", summary.Cost);
        Assert.Null(FloatingUsageSummary.Create(null, null, "$", 1m, now).Tokens);
        var usage = new UsagePoller.UsageStats(1_234_567, 1.25m, "2026-09-14");
        summary = FloatingUsageSummary.Create(usage, DateTimeOffset.Now, "¥", 7.2m, now);
        Assert.Equal("1.2M", summary.Tokens);
        Assert.Equal("1,234,567", summary.ExactTokens);
        Assert.Equal("¥9.00", summary.Cost);
    }

    [Theory]
    [InlineData("{\"billable_total_tokens\":\"2400\",\"total_tokens\":\"9000\"}", 2400)]
    [InlineData("{\"billable_total_tokens\":0,\"total_tokens\":9000}", 9000)]
    [InlineData("{\"total_tokens\":12345}", 12345)]
    public void FloatingAndTrayTokensKeepTheDashboardDisplaySemantics(string json, long expected)
    {
        using var document = JsonDocument.Parse(json);
        Assert.Equal(expected, UsagePoller.ResolveDisplayTokens(document.RootElement));
    }
}
