using System.Text;
using System.Text.Json;
using Xunit;

namespace TokenTrackerWin;

public sealed class ClipboardHistoryStoreTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "TokenTrackerClipboardTests", Guid.NewGuid().ToString("N"));
    private ClipboardHistoryStore Store() => new(Path.Combine(_directory, "archive"));
    private static JsonElement Snapshot(ClipboardHistoryStore store, string query = "", string kind = "all", int limit = 60) =>
        JsonSerializer.SerializeToElement(store.Query(query, kind, limit), ClipboardHistoryStore.JsonOptions);

    [Fact]
    public async Task RestoresTextPinsAndPausedStateAfterRestart()
    {
        var store = Store();
        var text = "中文记录\n第二行 🧪";
        var item = await store.AddTextAsync(text);
        await store.PinAsync(item.Id, true);
        await store.SetEnabledAsync(false);
        var restored = Store();
        Assert.False(restored.Enabled);
        Assert.True(restored.Get(item.Id).Pinned);
        Assert.Equal(10, restored.Get(item.Id).CharacterCount);
        Assert.Equal(text, await File.ReadAllTextAsync(restored.AssetPath(restored.Get(item.Id).Files[0])));
    }

    [Fact]
    public async Task FileCopiesKeepOriginalNamesAndSurviveSourceDeletion()
    {
        var store = Store();
        var source = Path.Combine(_directory, "项目说明.txt");
        await File.WriteAllTextAsync(source, "需要持久保存的文件内容");
        var item = await store.AddFilesAsync([source]);
        File.Delete(source);
        var restored = Store();
        var asset = restored.Get(item.Id).Files.Single();
        Assert.Equal("项目说明.txt", Path.GetFileName(restored.AssetPath(asset)));
        Assert.Equal("需要持久保存的文件内容", await File.ReadAllTextAsync(restored.AssetPath(asset)));
    }

    [Fact]
    public async Task IdenticalCopiesAreDeduplicatedWithoutLosingPin()
    {
        var store = Store();
        var first = await store.AddTextAsync("重复的内容");
        await store.PinAsync(first.Id, true);
        var second = await store.AddTextAsync("重复的内容");
        Assert.Equal(first.Id, second.Id);
        Assert.True(second.Pinned);
        Assert.True(second.UpdatedAt >= first.UpdatedAt);
        Assert.Equal(1, Snapshot(Store()).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task ClearKeepsPinnedAssetsAndPermanentlyRemovesOnlyUnpinnedRecords()
    {
        var store = Store();
        var keep = await store.AddTextAsync("长期保留");
        var remove = await store.AddImageAsync([1, 2, 3], 10, 20);
        await store.PinAsync(keep.Id, true);
        await store.ClearUnpinnedAsync();
        var restored = Store();
        Assert.Equal(1, Snapshot(restored).GetProperty("total").GetInt32());
        Assert.True(File.Exists(restored.AssetPath(keep.Files[0])));
        Assert.False(File.Exists(restored.AssetPath(remove.Files[0])));
        await restored.DeleteAsync(keep.Id);
        Assert.Equal(0, Snapshot(Store()).GetProperty("total").GetInt32());
        Assert.False(File.Exists(restored.AssetPath(keep.Files[0])));
    }

    [Fact]
    public async Task SearchFindsFullTextBeyondPreviewAndSupportsTypeFilters()
    {
        var store = Store();
        var text = new string('中', 2200) + "UniqueNeedle";
        var item = await store.AddTextAsync(text);
        Assert.DoesNotContain("UniqueNeedle", item.Text);
        Assert.Equal(1, Snapshot(store, "uniqueneedle").GetProperty("matched").GetInt32());
        Assert.Equal(0, Snapshot(store, "uniqueneedle", "image").GetProperty("matched").GetInt32());
        Assert.Equal(text, await File.ReadAllTextAsync(store.AssetPath(item.Files[0])));
    }

    [Fact]
    public async Task ConcurrentCapturesDoNotLoseHistoryOrCreateDuplicates()
    {
        var store = Store();
        await Task.WhenAll(Enumerable.Range(0, 20).Select(index => store.AddTextAsync($"record {index % 10}")));
        Assert.Equal(10, Snapshot(Store()).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task UnreadableIndexIsPreservedInsteadOfOverwritten()
    {
        _ = Store();
        var index = Path.Combine(_directory, "archive", "history.json");
        await File.WriteAllTextAsync(index, "damaged archive");
        var store = Store();
        Assert.Equal("storage_unavailable", store.LoadError);
        await Assert.ThrowsAsync<ClipboardHistoryException>(() => store.AddTextAsync("must not overwrite"));
        Assert.Equal("damaged archive", await File.ReadAllTextAsync(index));
    }

    [Fact]
    public async Task FailedCommitLeavesExistingIndexAndAssetsIntact()
    {
        var store = Store();
        var existing = await store.AddTextAsync("已经保存");
        var index = Path.Combine(_directory, "archive", "history.json");
        var original = await File.ReadAllTextAsync(index);
        Directory.CreateDirectory(index + ".tmp");
        await Assert.ThrowsAnyAsync<Exception>(() => store.AddTextAsync("写入失败"));
        Assert.Equal(original, await File.ReadAllTextAsync(index));
        Assert.Equal(1, Snapshot(store).GetProperty("total").GetInt32());
        Assert.True(File.Exists(store.AssetPath(existing.Files[0])));
        Assert.Single(Directory.GetFiles(store.AssetsDirectory, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task CancelledPendingCaptureDoesNotRepopulateClearedHistory()
    {
        var store = Store();
        await store.AddTextAsync("要清空的内容");
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await store.ClearUnpinnedAsync();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.AddTextAsync("延迟的剪贴板消息", cancellation.Token));
        Assert.Equal(0, Snapshot(Store()).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task RejectsOversizedTextWithoutCreatingRecord()
    {
        var store = Store();
        var error = await Assert.ThrowsAsync<ClipboardHistoryException>(() => store.AddTextAsync(new string('a', ClipboardHistoryStore.MaxTextBytes + 1)));
        Assert.Equal("too_large", error.Message);
        Assert.Equal(0, Snapshot(Store()).GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("../../outside.txt")]
    [InlineData("00000000000000000000000000000000/0/..")]
    [InlineData("C:\\private.txt")]
    public void RejectsAssetPathsOutsideArchive(string path)
    {
        Assert.Throws<ClipboardHistoryException>(() => Store().AssetPath(new("file", path, 1)));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory)) Directory.Delete(_directory, true);
    }
}
