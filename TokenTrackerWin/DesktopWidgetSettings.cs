using System.IO;
using System.Text.Json.Nodes;

namespace TokenTrackerWin;

/// <summary>Persistent configuration for the four Windows desktop widgets.</summary>
internal static class DesktopWidgetSettings
{
    public const string Summary = "summary";
    public const string Heatmap = "heatmap";
    public const string TopModels = "topModels";
    public const string Limits = "limits";

    public const string Small = "small";
    public const string Medium = "medium";
    public const string Large = "large";
    public const string ExtraLarge = "extraLarge";

    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "TokenTracker", "native-settings.json");

    private static readonly WidgetDefinition[] Definitions =
    [
        new(Summary, Medium, [Small, Medium, Large, ExtraLarge]),
        new(Heatmap, Medium, [Medium, Large, ExtraLarge]),
        new(TopModels, Medium, [Small, Medium, Large]),
        new(Limits, Medium, [Medium, Large]),
    ];

    public readonly record struct WidgetDefinition(
        string Id,
        string DefaultSize,
        IReadOnlyList<string> SupportedSizes);

    public readonly record struct WidgetItem(
        string Id,
        bool Enabled,
        string Size,
        IReadOnlyList<string> SupportedSizes);

    public readonly record struct WidgetDimensions(double Width, double Height);

    public static IReadOnlyList<WidgetDefinition> SupportedWidgets => Definitions;

    public static IReadOnlyList<WidgetItem> Snapshot()
    {
        var root = ReadSettingsObject();
        var widgets = root?["DesktopWidgets"] as JsonObject;
        var items = widgets?["items"] as JsonObject;
        return Definitions.Select(definition =>
        {
            var item = items?[definition.Id] as JsonObject;
            var enabled = ReadBoolean(item, "enabled", false);
            var size = NormalizeSize(definition.Id, ReadString(item, "size"));
            return new WidgetItem(definition.Id, enabled, size, definition.SupportedSizes);
        }).ToArray();
    }

    public static bool StoredAlwaysOnTop
    {
        get
        {
            var widgets = ReadSettingsObject()?["DesktopWidgets"] as JsonObject;
            return ReadBoolean(widgets, "alwaysOnTop", true);
        }
    }

    public static bool IsEnabled(string id) =>
        Snapshot().FirstOrDefault(item => item.Id == id).Enabled;

    public static string GetSize(string id)
    {
        var definition = FindDefinition(id);
        if (definition is null) return Medium;
        return Snapshot().First(item => item.Id == definition.Value.Id).Size;
    }

    public static IReadOnlyList<string> GetSupportedSizes(string id) =>
        FindDefinition(id)?.SupportedSizes ?? Array.Empty<string>();

    public static string NormalizeSize(string id, string? value)
    {
        var definition = FindDefinition(id);
        if (definition is null) return Medium;
        var raw = string.IsNullOrWhiteSpace(value) ? "" : value.Trim();
        return definition.Value.SupportedSizes.Contains(raw, StringComparer.Ordinal)
            ? raw
            : definition.Value.DefaultSize;
    }

    public static WidgetDimensions GetDimensions(string id, string? size)
    {
        var normalized = NormalizeSize(id, size);
        return normalized switch
        {
            Small => new WidgetDimensions(236, 236),
            Large => new WidgetDimensions(396, 396),
            ExtraLarge => new WidgetDimensions(572, 300),
            _ => new WidgetDimensions(396, 212),
        };
    }

    public static void StoreWidget(string id, bool enabled, string? size)
    {
        var definition = FindDefinition(id);
        if (definition is null) return;
        WriteSettings(root =>
        {
            var widgets = GetOrCreateObject(root, "DesktopWidgets");
            var items = GetOrCreateObject(widgets, "items");
            var item = GetOrCreateObject(items, definition.Value.Id);
            item["enabled"] = enabled;
            item["size"] = NormalizeSize(definition.Value.Id, size);
        });
    }

    public static void StoreAlwaysOnTop(bool enabled) =>
        WriteSettings(root => GetOrCreateObject(root, "DesktopWidgets")["alwaysOnTop"] = enabled);

    public static (double X, double Y)? ReadPlacement(string id)
    {
        try
        {
            var widgets = ReadSettingsObject()?["DesktopWidgets"] as JsonObject;
            var item = (widgets?["items"] as JsonObject)?[id] as JsonObject;
            var x = item?["x"]?.GetValue<double>();
            var y = item?["y"]?.GetValue<double>();
            return x is { } left && y is { } top ? (left, top) : null;
        }
        catch
        {
            return null;
        }
    }

    public static void StorePlacement(string id, double x, double y)
    {
        if (FindDefinition(id) is null) return;
        WriteSettings(root =>
        {
            var item = GetOrCreateObject(GetOrCreateObject(
                GetOrCreateObject(root, "DesktopWidgets"), "items"), id);
            item["x"] = x;
            item["y"] = y;
        });
    }

    public static void ClearPlacements()
    {
        WriteSettings(root =>
        {
            var items = (root["DesktopWidgets"] as JsonObject)?["items"] as JsonObject;
            if (items is null) return;
            foreach (var definition in Definitions)
            {
                if (items[definition.Id] is not JsonObject item) continue;
                item.Remove("x");
                item.Remove("y");
            }
        });
    }

    private static WidgetDefinition? FindDefinition(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        foreach (var definition in Definitions)
        {
            if (string.Equals(definition.Id, id.Trim(), StringComparison.Ordinal)) return definition;
        }
        return null;
    }

    private static bool ReadBoolean(JsonObject? obj, string key, bool defaultValue)
    {
        try { return obj?[key]?.GetValue<bool>() ?? defaultValue; }
        catch { return defaultValue; }
    }

    private static string? ReadString(JsonObject? obj, string key)
    {
        try { return obj?[key]?.GetValue<string>(); }
        catch { return null; }
    }

    private static JsonObject? ReadSettingsObject()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return null;
            return JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
        }
        catch
        {
            return null;
        }
    }

    private static JsonObject GetOrCreateObject(JsonObject parent, string key)
    {
        if (parent[key] is JsonObject existing) return existing;
        var created = new JsonObject();
        parent[key] = created;
        return created;
    }

    private static void WriteSettings(Action<JsonObject> mutate)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
            var settings = ReadSettingsObject() ?? new JsonObject();
            mutate(settings);
            File.WriteAllText(SettingsPath, settings.ToJsonString());
        }
        catch
        {
            // Best-effort native preference cache. A failed write must not crash the tray app.
        }
    }
}
