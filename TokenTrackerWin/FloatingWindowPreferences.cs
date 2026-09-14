using System.IO;
using System.Text.Json;

namespace TokenTrackerWin;

internal sealed class FloatingWindowPreferences
{
    public bool Enabled { get; set; } = true;
    public int? X { get; set; }
    public int? Y { get; set; }

    public static FloatingWindowPreferences Read(string path)
    {
        try
        {
            return JsonSerializer.Deserialize<FloatingWindowPreferences>(File.ReadAllText(path)) ?? new();
        }
        catch { return new(); }
    }

    public void Save(string path)
    {
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(temporary, JsonSerializer.Serialize(this));
            File.Move(temporary, path, overwrite: true);
        }
        catch { /* Position preferences must not interrupt copying or window operations. */ }
        finally { try { if (File.Exists(temporary)) File.Delete(temporary); } catch { } }
    }
}
