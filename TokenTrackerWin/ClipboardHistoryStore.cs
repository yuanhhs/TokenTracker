using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TokenTrackerWin;

internal sealed class ClipboardHistoryException(string code) : Exception(code);

internal sealed record ClipboardAsset(string Name, string Asset, long Bytes);
internal sealed record ClipboardContent(string Name, byte[] Data);
internal sealed record ClipboardRecord(
    string Id, string Kind, string Text, string Hash, ClipboardAsset[] Files,
    long Bytes, int CharacterCount, int Width, int Height,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, bool Pinned = false);
internal sealed record ClipboardState(int Version, bool Enabled, ClipboardRecord[] Items);

/// <summary>
/// Single-writer local archive. Publish the index only after every asset is durable;
/// delete assets only after publishing their removal. A failed write never changes
/// the live state. No clipboard contents are logged or sent to the Node server.
/// </summary>
internal sealed class ClipboardHistoryStore
{
    public const int MaxEntryBytes = 20 * 1024 * 1024;
    public const int MaxTextBytes = 1024 * 1024;
    public const int MaxEntries = 1000;
    public const long MaxStorageBytes = 256L * 1024 * 1024;
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex AssetName = new("^[a-f0-9]{32}/[0-9]+/[^/\\\\]+$", RegexOptions.CultureInvariant);
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _indexPath;
    private ClipboardState _state = new(1, true, []);

    public string AssetsDirectory { get; }
    public string? LoadError { get; }
    public bool Enabled => _state.Enabled && LoadError is null;

    public ClipboardHistoryStore(string directory)
    {
        AssetsDirectory = Path.Combine(Path.GetFullPath(directory), "assets");
        _indexPath = Path.Combine(Path.GetFullPath(directory), "history.json");
        try
        {
            Directory.CreateDirectory(AssetsDirectory);
            if (!File.Exists(_indexPath)) return;
            var state = JsonSerializer.Deserialize<ClipboardState>(File.ReadAllText(_indexPath), JsonOptions);
            if (state is null || state.Version != 1 || state.Items is null ||
                state.Items.Any(item => item is null || !Guid.TryParseExact(item.Id, "N", out _) ||
                    item.Kind is not ("text" or "image" or "files") || item.Files is null ||
                    item.Files.Length == 0 || item.Files.Any(file => file is null || !IsSafeAsset(file.Asset))))
                throw new InvalidDataException();
            _state = state;
        }
        catch
        {
            // Preserve an unreadable archive for recovery; never overwrite it with an empty one.
            LoadError = "storage_unavailable";
        }
    }

    public ClipboardRecord Get(string id) =>
        _state.Items.FirstOrDefault(item => item.Id == id) ?? throw new ClipboardHistoryException("not_found");

    public string AssetPath(ClipboardAsset asset)
    {
        if (!IsSafeAsset(asset.Asset)) throw new ClipboardHistoryException("not_found");
        return Path.Combine(AssetsDirectory, asset.Asset.Replace('/', Path.DirectorySeparatorChar));
    }

    private static bool IsSafeAsset(string? asset)
    {
        if (asset is null || !AssetName.IsMatch(asset)) return false;
        var name = asset.Split('/')[2];
        return name is not ("." or "..") && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
    }

    public object Query(string? query, string? kind, int limit = 60)
    {
        var state = _state;
        var search = (query ?? "").Trim();
        var matching = state.Items.Where(item => (kind is null or "" or "all" || item.Kind == kind) &&
            (search.Length == 0 || Matches(item, search))).OrderByDescending(item => item.Pinned)
            .ThenByDescending(item => item.UpdatedAt).ThenBy(item => item.Id).ToArray();
        return new
        {
            items = matching.Take(Math.Clamp(limit, 1, MaxEntries)).Select(item => new
            {
                item.Id, item.Kind, text = item.Text, item.Bytes, item.CharacterCount,
                item.Width, item.Height, item.CreatedAt, item.UpdatedAt, item.Pinned,
                files = item.Files.Select(file => new { file.Name, file.Bytes }),
                previewUrl = item.Kind == "image" ? "https://clipboard.tokentracker.local/" +
                    string.Join('/', item.Files[0].Asset.Split('/').Select(Uri.EscapeDataString)) : null,
            }),
            total = state.Items.Length,
            matched = matching.Length,
            totalBytes = state.Items.Sum(item => item.Bytes),
            counts = new
            {
                all = state.Items.Length,
                text = state.Items.Count(item => item.Kind == "text"),
                image = state.Items.Count(item => item.Kind == "image"),
                files = state.Items.Count(item => item.Kind == "files"),
                pinned = state.Items.Count(item => item.Pinned),
            },
            enabled = Enabled,
            error = LoadError,
        };
    }

    private bool Matches(ClipboardRecord item, string query)
    {
        if (item.Text.Contains(query, StringComparison.OrdinalIgnoreCase) ||
            item.Files.Any(file => file.Name.Contains(query, StringComparison.OrdinalIgnoreCase))) return true;
        if (item.Kind != "text" || item.CharacterCount <= 2000) return false;
        try { return File.ReadAllText(AssetPath(item.Files[0])).Contains(query, StringComparison.OrdinalIgnoreCase); }
        catch (IOException) { return false; }
    }

    public Task<ClipboardRecord> AddTextAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text)) throw new ClipboardHistoryException("empty");
        var bytes = Encoding.UTF8.GetBytes(text);
        if (bytes.Length > MaxTextBytes) throw new ClipboardHistoryException("too_large");
        var preview = string.Concat(text.EnumerateRunes().Take(2000).Select(rune => rune.ToString()));
        return AddAsync("text", [new("文本.txt", bytes)], preview, text.EnumerateRunes().Count(), cancellationToken: cancellationToken);
    }

    public Task<ClipboardRecord> AddImageAsync(byte[] png, int width, int height, CancellationToken cancellationToken = default) =>
        AddAsync("image", [new("截图.png", png)], width: width, height: height, cancellationToken: cancellationToken);

    public async Task<ClipboardRecord> AddFilesAsync(IEnumerable<string> paths, CancellationToken cancellationToken = default)
    {
        var files = paths.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (files.Length is 0 or > 32) throw new ClipboardHistoryException("unsupported");
        var contents = new List<ClipboardContent>();
        var remaining = MaxEntryBytes;
        foreach (var file in files)
        {
            if (Directory.Exists(file)) throw new ClipboardHistoryException("folders_unsupported");
            var bytes = await ReadBoundedAsync(file, remaining, cancellationToken);
            remaining -= bytes.Length;
            contents.Add(new(Path.GetFileName(file), bytes));
        }
        return await AddAsync("files", contents, cancellationToken: cancellationToken);
    }

    private static async Task<byte[]> ReadBoundedAsync(string path, int limit, CancellationToken cancellationToken)
    {
        await using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        if (file.Length > limit) throw new ClipboardHistoryException("too_large");
        using var data = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await file.ReadAsync(buffer.AsMemory(), cancellationToken)) > 0)
        {
            if (data.Length + read > limit) throw new ClipboardHistoryException("too_large");
            data.Write(buffer, 0, read);
        }
        return data.ToArray();
    }

    private async Task<ClipboardRecord> AddAsync(string kind, IReadOnlyList<ClipboardContent> contents,
        string text = "", int characterCount = 0, int width = 0, int height = 0, CancellationToken cancellationToken = default)
    {
        var size = contents.Sum(content => (long)content.Data.Length);
        if (size > MaxEntryBytes) throw new ClipboardHistoryException("too_large");
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Encoding.UTF8.GetBytes(kind));
        foreach (var content in contents)
        {
            if (kind == "files") hash.AppendData(Encoding.UTF8.GetBytes(content.Name + "\0"));
            hash.AppendData(BitConverter.GetBytes(content.Data.LongLength));
            hash.AppendData(content.Data);
        }
        var fingerprint = Convert.ToHexString(hash.GetHashAndReset());
        await _gate.WaitAsync(cancellationToken);
        var createdAssets = new List<string>();
        try
        {
            EnsureReady();
            cancellationToken.ThrowIfCancellationRequested();
            var existing = _state.Items.FirstOrDefault(item => item.Hash == fingerprint);
            if (existing is not null)
            {
                var updated = existing with { UpdatedAt = DateTimeOffset.UtcNow };
                await PersistAsync(_state with { Items = _state.Items.Select(item => item.Id == updated.Id ? updated : item).ToArray() });
                return updated;
            }
            if (_state.Items.Length >= MaxEntries || _state.Items.Sum(item => item.Bytes) + size > MaxStorageBytes)
                throw new ClipboardHistoryException("storage_full");
            var id = Guid.NewGuid().ToString("N");
            var assets = new List<ClipboardAsset>();
            for (var i = 0; i < contents.Count; i++)
            {
                var content = contents[i];
                var asset = new ClipboardAsset(content.Name, $"{id}/{i}/{content.Name}", content.Data.LongLength);
                var assetPath = AssetPath(asset);
                Directory.CreateDirectory(Path.GetDirectoryName(assetPath)!);
                createdAssets.Add(assetPath);
                await File.WriteAllBytesAsync(assetPath, content.Data);
                assets.Add(asset);
            }
            var now = DateTimeOffset.UtcNow;
            var record = new ClipboardRecord(id, kind, text, fingerprint, assets.ToArray(), size,
                characterCount, width, height, now, now);
            await PersistAsync(_state with { Items = [.. _state.Items, record] });
            return record;
        }
        catch
        {
            foreach (var file in createdAssets) DeleteAssetFile(file);
            throw;
        }
        finally { _gate.Release(); }
    }

    public async Task SetEnabledAsync(bool enabled)
    {
        await _gate.WaitAsync();
        try { await PersistAsync(_state with { Enabled = enabled }); }
        finally { _gate.Release(); }
    }

    public async Task PinAsync(string id, bool pinned)
    {
        await _gate.WaitAsync();
        try
        {
            _ = Get(id);
            await PersistAsync(_state with { Items = _state.Items.Select(item => item.Id == id ? item with { Pinned = pinned } : item).ToArray() });
        }
        finally { _gate.Release(); }
    }

    public Task DeleteAsync(string id) => RemoveAsync(item => item.Id == id);
    public Task ClearUnpinnedAsync() => RemoveAsync(item => !item.Pinned);

    private async Task RemoveAsync(Func<ClipboardRecord, bool> predicate)
    {
        await _gate.WaitAsync();
        try
        {
            var removed = _state.Items.Where(predicate).ToArray();
            await PersistAsync(_state with { Items = _state.Items.Where(item => !predicate(item)).ToArray() });
            foreach (var asset in removed.SelectMany(item => item.Files)) DeleteAssetFile(AssetPath(asset));
        }
        finally { _gate.Release(); }
    }

    private void EnsureReady()
    {
        if (LoadError is not null) throw new ClipboardHistoryException(LoadError);
    }

    private async Task PersistAsync(ClipboardState state)
    {
        EnsureReady();
        var temp = _indexPath + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None,
                4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, state, JsonOptions);
                await stream.FlushAsync();
            }
            File.Move(temp, _indexPath, true);
            _state = state;
        }
        finally { TryDelete(temp); }
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void DeleteAssetFile(string path)
    {
        TryDelete(path);
        // Every validated asset lives at assets/<record-id>/<index>/<original-name>.
        // Remove only its two empty parent directories; never recurse into user files.
        var directory = Path.GetDirectoryName(path)!;
        for (var level = 0; level < 2; level++)
        {
            try { Directory.Delete(directory, recursive: false); }
            catch (IOException) { break; }
            catch (UnauthorizedAccessException) { break; }
            directory = Path.GetDirectoryName(directory)!;
        }
    }
}
