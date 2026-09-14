using System.Collections.Specialized;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Media.Imaging;
using Clipboard = System.Windows.Clipboard;
using DataFormats = System.Windows.DataFormats;

namespace TokenTrackerWin;

/// <summary>STA clipboard listener owned by the tray, independent of dashboard lifetime.</summary>
internal sealed class ClipboardHistoryService : IDisposable
{
    private readonly ClipboardHistoryStore _store;
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 100 };
    private readonly SemaphoreSlim _captureGate = new(1, 1);
    private CancellationTokenSource _automaticCapture = new();
    private readonly ClipboardListener? _listener;
    private uint _lastSequence;
    private uint _ignoredSequence;
    private int _retry;
    private int _captureEpoch;
    private bool _disposed;

    public event Action? Changed;
    public string AssetsDirectory => _store.AssetsDirectory;
    public string? Error { get; private set; }

    public ClipboardHistoryService(ClipboardHistoryStore? store = null)
    {
        _store = store ?? new ClipboardHistoryStore(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokenTracker", "Clipboard"));
        Error = _store.LoadError;
        _timer.Tick += OnClipboardTick;
        try { _listener = new ClipboardListener(OnClipboardChanged); }
        catch (Win32Exception) { Error = "listener_unavailable"; }
        // Listen for future copies. Do not read a user's pre-existing clipboard on startup.
    }

    private void OnClipboardChanged()
    {
        if (_disposed || !_store.Enabled) return;
        _retry = 0;
        _timer.Stop();
        _timer.Start();
    }

    private async void OnClipboardTick(object? sender, EventArgs args)
    {
        _timer.Stop();
        if (_disposed || !_store.Enabled) return;
        var sequence = GetClipboardSequenceNumber();
        if (sequence == _lastSequence || sequence == _ignoredSequence) return;
        try
        {
            await CaptureAsync(manual: false);
            _lastSequence = sequence;
        }
        catch (OperationCanceledException) { /* paused or cleared while assets were being read */ }
        catch (ExternalException)
        {
            // A clipboard owner can briefly hold the global lock while publishing formats.
            if (++_retry < 6 && !_disposed) _timer.Start();
            else SetError("clipboard_busy");
        }
        catch (Exception error) { SetError(ErrorCode(error)); }
    }

    private void SetError(string? error)
    {
        Error = error ?? _store.LoadError ?? (_listener is null ? "listener_unavailable" : null);
        if (!_disposed) Changed?.Invoke();
    }

    private async Task<bool> CaptureAsync(bool manual)
    {
        var epoch = _captureEpoch;
        var cancellationToken = manual ? CancellationToken.None : _automaticCapture.Token;
        await _captureGate.WaitAsync(cancellationToken);
        try
        {
            if (_disposed || (!manual && (!_store.Enabled || epoch != _captureEpoch))) return false;
            var data = Clipboard.GetDataObject();
            if (data is null || IsExcludedFromHistory(data)) return false;
            Task<ClipboardRecord>? save = null;
            if (data.GetDataPresent(DataFormats.FileDrop) && data.GetData(DataFormats.FileDrop) is string[] paths)
            {
                save = _store.AddFilesAsync(paths, cancellationToken);
            }
            else if (data.GetDataPresent(DataFormats.Bitmap) || data.GetDataPresent("PNG"))
            {
                BitmapSource? bitmap = null;
                if (data.GetDataPresent("PNG") && data.GetData("PNG") is Stream png)
                {
                    if (png.CanSeek) png.Position = 0;
                    bitmap = BitmapDecoder.Create(png, BitmapCreateOptions.PreservePixelFormat,
                        BitmapCacheOption.OnLoad).Frames[0];
                }
                bitmap ??= Clipboard.GetImage();
                if (bitmap is not null)
                {
                    if ((long)bitmap.PixelWidth * bitmap.PixelHeight > 40_000_000)
                        throw new ClipboardHistoryException("too_large");
                    bitmap.Freeze();
                    var frozen = bitmap;
                    var bytes = await Task.Run(() => EncodePng(frozen));
                    if (!manual && (!_store.Enabled || epoch != _captureEpoch)) return false;
                    save = _store.AddImageAsync(bytes, bitmap.PixelWidth, bitmap.PixelHeight, cancellationToken);
                }
            }
            else if (data.GetDataPresent(DataFormats.UnicodeText) &&
                     data.GetData(DataFormats.UnicodeText) is string text && !string.IsNullOrWhiteSpace(text))
            {
                save = _store.AddTextAsync(text, cancellationToken);
            }
            if (save is null) return false;
            await save;
            SetError(null);
            return true;
        }
        finally { _captureGate.Release(); }
    }

    private static bool IsExcludedFromHistory(System.Windows.IDataObject data)
    {
        if (data.GetDataPresent("ExcludeClipboardContentFromMonitorProcessing")) return true;
        if (!data.GetDataPresent("CanIncludeInClipboardHistory")) return false;
        var flag = data.GetData("CanIncludeInClipboardHistory");
        return flag switch
        {
            int value => value == 0,
            bool value => !value,
            byte[] bytes when bytes.Length >= 4 => BitConverter.ToInt32(bytes, 0) == 0,
            Stream stream => ReadHistoryFlag(stream) == 0,
            _ => false,
        };
    }

    private static int ReadHistoryFlag(Stream stream)
    {
        if (stream.CanSeek) stream.Position = 0;
        Span<byte> flag = stackalloc byte[4];
        return stream.Read(flag) == 4 ? BitConverter.ToInt32(flag) : 1;
    }

    private static byte[] EncodePng(BitmapSource bitmap)
    {
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var stream = new MemoryStream();
        encoder.Save(stream);
        if (stream.Length > ClipboardHistoryStore.MaxEntryBytes) throw new ClipboardHistoryException("too_large");
        return stream.ToArray();
    }

    public async Task<object?> ExecuteAsync(string action, JsonElement args, System.Windows.Window owner)
    {
        var id = StringArg(args, "id");
        switch (action)
        {
            case "list":
                var limit = args.TryGetProperty("limit", out var count) && count.TryGetInt32(out var parsed) ? parsed : 60;
                var snapshot = await Task.Run(() => _store.Query(StringArg(args, "query"), StringArg(args, "kind"), limit));
                return new { snapshot, error = Error };
            case "detail":
                var record = _store.Get(id);
                return new { text = record.Kind == "text" ? await File.ReadAllTextAsync(_store.AssetPath(record.Files[0])) : "" };
            case "capture":
                if (!await CaptureAsync(manual: true)) throw new ClipboardHistoryException("empty");
                return true;
            case "import":
                var picker = new Microsoft.Win32.OpenFileDialog { Multiselect = true, Title = "添加到剪贴板记录", CheckFileExists = true };
                if (picker.ShowDialog(owner) != true) return false;
                await _store.AddFilesAsync(picker.FileNames);
                SetError(null);
                return true;
            case "enabled":
                CancelPendingCaptures();
                _timer.Stop();
                await _store.SetEnabledAsync(BoolArg(args, "enabled"));
                SetError(null);
                return true;
            case "pin":
                await _store.PinAsync(id, BoolArg(args, "pinned"));
                Changed?.Invoke();
                return true;
            case "delete":
                CancelPendingCaptures();
                await _store.DeleteAsync(id);
                SetError(null);
                return true;
            case "clear":
                CancelPendingCaptures();
                _timer.Stop();
                await _store.ClearUnpinnedAsync();
                SetError(null);
                return true;
            case "copy":
                await CopyAsync(_store.Get(id));
                return true;
            case "export":
                return await ExportAsync(_store.Get(id), owner);
            case "folder":
                var start = new ProcessStartInfo("explorer.exe") { UseShellExecute = true };
                start.ArgumentList.Add(Path.GetDirectoryName(AssetsDirectory)!);
                Process.Start(start);
                return true;
            default:
                throw new ClipboardHistoryException("unsupported");
        }
    }

    private async Task CopyAsync(ClipboardRecord item)
    {
        var data = new System.Windows.DataObject();
        if (item.Kind == "text")
            data.SetText(await File.ReadAllTextAsync(_store.AssetPath(item.Files[0])), System.Windows.TextDataFormat.UnicodeText);
        else if (item.Kind == "image")
        {
            var bytes = await File.ReadAllBytesAsync(_store.AssetPath(item.Files[0]));
            using var input = new MemoryStream(bytes);
            var bitmap = BitmapDecoder.Create(input, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad).Frames[0];
            data.SetImage(bitmap);
            // PNG preserves alpha in apps that support it; Bitmap remains the compatibility fallback.
            data.SetData("PNG", new MemoryStream(bytes));
        }
        else
        {
            var paths = new StringCollection();
            foreach (var file in item.Files)
            {
                var path = _store.AssetPath(file);
                if (!File.Exists(path)) throw new ClipboardHistoryException("not_found");
                paths.Add(path);
            }
            data.SetFileDropList(paths);
        }
        for (var attempt = 0; ; attempt++)
        {
            try { Clipboard.SetDataObject(data, copy: false); break; }
            catch (ExternalException) when (attempt < 4) { await Task.Delay(80); }
        }
        _ignoredSequence = GetClipboardSequenceNumber();
        // Other clipboard listeners may briefly open the clipboard immediately after
        // publication. Retry only Flush: republishing on each retry restarts that race.
        // Flushing lets copied content remain usable after this process exits.
        for (var attempt = 0; ; attempt++)
        {
            try { Clipboard.Flush(); break; }
            catch (ExternalException) when (attempt < 8) { await Task.Delay(80); }
        }
        _ignoredSequence = GetClipboardSequenceNumber();
    }

    private async Task<bool> ExportAsync(ClipboardRecord item, System.Windows.Window owner)
    {
        if (item.Files.Length == 1)
        {
            var file = item.Files[0];
            var picker = new Microsoft.Win32.SaveFileDialog
            {
                Title = "另存剪贴板内容", FileName = file.Name, OverwritePrompt = true,
            };
            if (picker.ShowDialog(owner) != true) return false;
            await CopyFileAsync(_store.AssetPath(file), picker.FileName);
            return true;
        }
        using var folder = new FolderBrowserDialog { Description = "选择文件保存位置", UseDescriptionForTitle = true };
        var handle = new System.Windows.Interop.WindowInteropHelper(owner).Handle;
        if (folder.ShowDialog(new WindowOwner(handle)) != DialogResult.OK) return false;
        foreach (var file in item.Files)
        {
            var name = Path.GetFileName(file.Name);
            var target = Path.Combine(folder.SelectedPath, name);
            for (var number = 1; File.Exists(target); number++)
                target = Path.Combine(folder.SelectedPath, $"{Path.GetFileNameWithoutExtension(name)} ({number}){Path.GetExtension(name)}");
            await CopyFileAsync(_store.AssetPath(file), target);
        }
        return true;
    }

    private static async Task CopyFileAsync(string source, string destination)
    {
        if (Path.GetFullPath(source).Equals(Path.GetFullPath(destination), StringComparison.OrdinalIgnoreCase)) return;
        await using var input = File.OpenRead(source);
        await using var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
        await input.CopyToAsync(output);
    }

    private sealed record WindowOwner(nint Handle) : IWin32Window;
    private static string StringArg(JsonElement args, string name) =>
        args.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";
    private static bool BoolArg(JsonElement args, string name) =>
        args.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    public static string ErrorCode(Exception error) => error switch
    {
        ClipboardHistoryException known => known.Message,
        FileNotFoundException or DirectoryNotFoundException => "not_found",
        ExternalException => "clipboard_busy",
        IOException or UnauthorizedAccessException => "storage_unavailable",
        _ => "operation_failed",
    };

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _captureEpoch++;
        _automaticCapture.Cancel();
        _automaticCapture.Dispose();
        _timer.Dispose();
        _listener?.Dispose();
    }

    private void CancelPendingCaptures()
    {
        _captureEpoch++;
        _automaticCapture.Cancel();
        _automaticCapture.Dispose();
        _automaticCapture = new CancellationTokenSource();
    }

    [DllImport("user32.dll")]
    private static extern uint GetClipboardSequenceNumber();

    private sealed class ClipboardListener : NativeWindow, IDisposable
    {
        private readonly Action _changed;
        public ClipboardListener(Action changed)
        {
            _changed = changed;
            CreateHandle(new CreateParams { Caption = "TokenTrackerClipboard", Parent = new nint(-3) });
            if (!AddClipboardFormatListener(Handle))
            {
                var error = Marshal.GetLastWin32Error();
                DestroyHandle();
                throw new Win32Exception(error);
            }
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x031D) _changed(); // WM_CLIPBOARDUPDATE
            base.WndProc(ref message);
        }

        public void Dispose()
        {
            if (Handle == nint.Zero) return;
            RemoveClipboardFormatListener(Handle);
            DestroyHandle();
        }

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool AddClipboardFormatListener(nint hwnd);
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool RemoveClipboardFormatListener(nint hwnd);
    }
}
