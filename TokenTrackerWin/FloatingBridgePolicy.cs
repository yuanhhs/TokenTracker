namespace TokenTrackerWin;

internal static class FloatingBridgePolicy
{
    public static bool IsTrustedDocument(string source, string baseUrl) =>
        Uri.TryCreate(source, UriKind.Absolute, out var uri) &&
        uri.AbsolutePath == "/floating.html" &&
        uri.GetLeftPart(UriPartial.Authority).Equals(baseUrl, StringComparison.OrdinalIgnoreCase);

    public static bool IsClipboardActionAllowed(string action) => action is "list" or "copy" or "capture";
}
