namespace TokenTrackerWin;

internal readonly record struct FloatingRect(int X, int Y, int Width, int Height)
{
    public int Right => X + Width;
    public int Bottom => Y + Height;
}

/// <summary>Desktop coordinates are physical pixels, including negative monitor origins.</summary>
internal static class FloatingWindowGeometry
{
    public const int BallSize = 88;
    public const int PanelWidth = 408;
    public const int PanelHeight = 616;

    internal static int Pixels(double dips, double scale) =>
        (int)Math.Round(dips * (double.IsFinite(scale) && scale > 0 ? scale : 1));

    public static FloatingRect Clamp(FloatingRect bounds, FloatingRect workArea)
    {
        var width = Math.Clamp(bounds.Width, 1, Math.Max(1, workArea.Width));
        var height = Math.Clamp(bounds.Height, 1, Math.Max(1, workArea.Height));
        return new FloatingRect(
            Math.Clamp(bounds.X, workArea.X, workArea.Right - width),
            Math.Clamp(bounds.Y, workArea.Y, workArea.Bottom - height), width, height);
    }

    public static FloatingRect Ball(int? x, int? y, FloatingRect workArea, double scale)
    {
        var size = Pixels(BallSize, scale);
        return Clamp(new FloatingRect(
            x ?? workArea.Right - size - Pixels(20, scale),
            y ?? workArea.Bottom - size - Pixels(80, scale), size, size), workArea);
    }

    public static FloatingRect Panel(FloatingRect ball, FloatingRect workArea, double scale)
    {
        var width = Math.Min(Pixels(PanelWidth, scale), workArea.Width);
        var height = Math.Min(Pixels(PanelHeight, scale), workArea.Height);
        return Clamp(new FloatingRect(ball.Right - width, ball.Bottom - height, width, height), workArea);
    }
}
