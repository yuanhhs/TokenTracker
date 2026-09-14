import { copy } from "./copy";
import {
  browserClipboardAddFiles,
  browserClipboardAddText,
  browserClipboardGet,
  browserClipboardList,
  browserClipboardMutate,
  ClipboardError,
  type ClipboardQuery,
  type ClipboardSnapshot,
} from "./clipboard-store";

type WebView = {
  postMessage(message: string): void;
  addEventListener(type: string, callback: (event: MessageEvent) => void): void;
  removeEventListener(
    type: string,
    callback: (event: MessageEvent) => void,
  ): void;
};
const webview = () =>
  (window as unknown as { chrome?: { webview?: WebView } }).chrome?.webview;
const localChanges = new EventTarget();

function nativeRequest<T>(action: string, args: object = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const bridge = webview();
    if (!bridge) return reject(new ClipboardError("native_unavailable"));
    const requestId = crypto.randomUUID();
    const finish = () => {
      clearTimeout(timer);
      bridge.removeEventListener("message", onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== "clipboard:response" || data.requestId !== requestId)
        return;
      finish();
      if (data.error) reject(new ClipboardError(data.error));
      else resolve(data.result as T);
    };
    const timer = setTimeout(
      () => {
        finish();
        reject(new ClipboardError("timeout"));
      },
      action === "import" || action === "export" ? 300_000 : 20_000,
    );
    bridge.addEventListener("message", onMessage);
    try {
      bridge.postMessage(
        JSON.stringify({ type: "clipboard:request", requestId, action, args }),
      );
    } catch {
      finish();
      reject(new ClipboardError("native_unavailable"));
    }
  });
}

const ERROR_KEYS: Record<string, string> = {
  empty: "clipboard.error.empty",
  too_large: "clipboard.error.too_large",
  storage_full: "clipboard.error.storage_full",
  storage_unavailable: "clipboard.error.storage_unavailable",
  listener_unavailable: "clipboard.error.listener_unavailable",
  clipboard_busy: "clipboard.error.clipboard_busy",
  not_found: "clipboard.error.not_found",
  folders_unsupported: "clipboard.error.folders_unsupported",
  native_unavailable: "clipboard.error.native_unavailable",
  unsupported: "clipboard.error.unsupported",
  timeout: "clipboard.error.timeout",
  permission: "clipboard.error.permission",
  file_copy: "clipboard.error.file_copy",
};

export function clipboardErrorMessage(error: unknown): string {
  const code =
    typeof error === "string"
      ? error
      : error instanceof ClipboardError
        ? error.code
        : error instanceof Error && error.name === "NotAllowedError"
          ? "permission"
          : "operation_failed";
  return copy(ERROR_KEYS[code] ?? "clipboard.error.operation_failed");
}

async function pngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new ClipboardError("operation_failed")),
      "image/png",
    ),
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** The caller gates the host with isNativeWindowsApp(). Browser mode records only explicit pastes/imports. */
export function createClipboardClient(native: boolean) {
  const changed = () => localChanges.dispatchEvent(new Event("change"));
  return {
    native,
    async list(query: ClipboardQuery): Promise<ClipboardSnapshot> {
      if (!native) return browserClipboardList(query);
      const result = await nativeRequest<{
        snapshot: ClipboardSnapshot;
        error?: string;
      }>("list", query);
      return {
        ...result.snapshot,
        error: result.error || result.snapshot.error,
      };
    },
    subscribe(callback: () => void) {
      if (!native) {
        localChanges.addEventListener("change", callback);
        return () => localChanges.removeEventListener("change", callback);
      }
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === "clipboard:changed") callback();
      };
      const bridge = webview();
      bridge?.addEventListener("message", onMessage);
      return () => bridge?.removeEventListener("message", onMessage);
    },
    async detail(id: string): Promise<{ text: string; previewUrl?: string }> {
      if (native) return nativeRequest("detail", { id });
      const entry = await browserClipboardGet(id);
      return {
        text: entry.text,
        previewUrl:
          entry.kind === "image" && entry.files[0]?.blob
            ? URL.createObjectURL(entry.files[0].blob)
            : undefined,
      };
    },
    async capture(): Promise<boolean> {
      if (native) return nativeRequest("capture");
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((type) => type === "image/png");
          if (imageType) {
            const blob = await item.getType(imageType);
            await browserClipboardAddFiles([
              new File([blob], copy("clipboard.default_image_name"), {
                type: imageType,
              }),
            ]);
            changed();
            return true;
          }
        }
        for (const item of items) {
          if (item.types.includes("text/plain")) {
            await browserClipboardAddText(
              await (await item.getType("text/plain")).text(),
            );
            changed();
            return true;
          }
        }
        throw new ClipboardError("empty");
      }
      if (!navigator.clipboard?.readText)
        throw new ClipboardError("permission");
      await browserClipboardAddText(await navigator.clipboard.readText());
      changed();
      return true;
    },
    async paste(data: DataTransfer): Promise<boolean> {
      if (native) return nativeRequest("capture");
      // Read the event's data synchronously, before the browser clears its clipboardData.
      const files = Array.from(data.files);
      const text = data.getData("text/plain");
      if (files.length) await browserClipboardAddFiles(files);
      else await browserClipboardAddText(text);
      changed();
      return true;
    },
    async importFiles(files?: File[]): Promise<boolean> {
      if (native) return nativeRequest("import");
      if (!files?.length) return false;
      await browserClipboardAddFiles(files);
      changed();
      return true;
    },
    async pin(id: string, pinned: boolean) {
      if (native) await nativeRequest("pin", { id, pinned });
      else {
        await browserClipboardMutate("pin", id, pinned);
        changed();
      }
    },
    async remove(id: string) {
      if (native) await nativeRequest("delete", { id });
      else {
        await browserClipboardMutate("delete", id);
        changed();
      }
    },
    async clear() {
      if (native) await nativeRequest("clear");
      else {
        await browserClipboardMutate("clear");
        changed();
      }
    },
    async setEnabled(enabled: boolean) {
      await nativeRequest("enabled", { enabled });
    },
    async copy(id: string) {
      if (native) {
        await nativeRequest("copy", { id });
        return;
      }
      const entry = await browserClipboardGet(id);
      if (entry.kind === "files") throw new ClipboardError("file_copy");
      if (!navigator.clipboard) throw new ClipboardError("permission");
      if (entry.kind === "text")
        await navigator.clipboard.writeText(entry.text);
      else {
        const blob = entry.files[0]?.blob;
        if (!blob || !window.ClipboardItem)
          throw new ClipboardError("unsupported");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": await pngBlob(blob) }),
        ]);
      }
    },
    async export(id: string): Promise<boolean> {
      if (native) return nativeRequest("export", { id });
      const entry = await browserClipboardGet(id);
      if (entry.kind === "text")
        download(
          new Blob([entry.text], { type: "text/plain;charset=utf-8" }),
          copy("clipboard.default_text_name"),
        );
      else
        for (const file of entry.files)
          if (file.blob) download(file.blob, file.name);
      return true;
    },
    async openFolder() {
      await nativeRequest("folder");
    },
  };
}
