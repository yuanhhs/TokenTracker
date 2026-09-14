import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  Download,
  File,
  FileText,
  FolderOpen,
  Image,
  LayoutGrid,
  List,
  Loader2,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ClipboardCard,
  clipboardButton,
  clipboardSize,
  clipboardTypeLabel,
} from "../components/clipboard/ClipboardCard.jsx";
import { ConfirmModal } from "../ui/components/ConfirmModal.jsx";
import { showToast } from "../ui/components/Toast.jsx";
import {
  createClipboardClient,
  clipboardErrorMessage,
} from "../lib/clipboard-api";
import { releaseClipboardPreviews } from "../lib/clipboard-store";
import { isNativeWindowsApp } from "../lib/native-bridge.js";
import { copy } from "../lib/copy";
import { cn } from "../lib/cn";

function readView() {
  try {
    return localStorage.getItem("tt.clipboard.view") === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
}

export function ClipboardPage() {
  const client = useMemo(() => createClipboardClient(isNativeWindowsApp()), []);
  const [snapshot, setSnapshot] = useState(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(60);
  const [view, setView] = useState(readView);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInput = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setLimit(60);
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const unsubscribe = client.subscribe(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [client]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    client
      .list({ query: search, kind, limit })
      .then((next) => {
        if (!active) {
          releaseClipboardPreviews(next);
          return;
        }
        setSnapshot(next);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(clipboardErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, search, kind, limit, revision]);

  useEffect(() => () => releaseClipboardPreviews(snapshot), [snapshot]);
  useEffect(
    () => () => releaseClipboardPreviews(preview ? { items: [preview] } : null),
    [preview],
  );

  const run = useCallback(async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      if (mounted.current && result !== false && success)
        showToast({ title: success });
      return true;
    } catch (cause) {
      if (mounted.current) showToast({ title: clipboardErrorMessage(cause) });
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (event) => {
      if (
        busy ||
        confirm ||
        preview ||
        event.defaultPrevented ||
        !event.clipboardData
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable='true']")
      )
        return;
      event.preventDefault();
      void run(
        () => client.paste(event.clipboardData),
        copy("clipboard.saved"),
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, client, confirm, preview, run]);

  const openPreview = (entry) =>
    run(async () => {
      const detail = await client.detail(entry.id);
      const next = {
        ...entry,
        ...detail,
        previewUrl: detail.previewUrl || entry.previewUrl,
      };
      if (mounted.current) setPreview(next);
      else releaseClipboardPreviews({ items: [next] });
    });

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem("tt.clipboard.view", next);
    } catch {
      /* preference is optional */
    }
  };
  const unpinned = (snapshot?.total ?? 0) - (snapshot?.counts.pinned ?? 0);
  const filters = [
    { id: "all", label: copy("clipboard.type.all"), Icon: LayoutGrid },
    { id: "text", label: copy("clipboard.type.text"), Icon: FileText },
    { id: "image", label: copy("clipboard.type.image"), Icon: Image },
    { id: "files", label: copy("clipboard.type.files"), Icon: File },
  ];
  const activeError =
    error || (snapshot?.error ? clipboardErrorMessage(snapshot.error) : null);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 font-oai sm:px-6 sm:py-9 lg:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Clipboard className="h-6 w-6" strokeWidth={1.7} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-oai-black dark:text-white sm:text-3xl">
              {copy("clipboard.title")}
            </h1>
            <p className="mt-1.5 text-xs leading-5 text-oai-gray-500 sm:text-sm">
              {copy("clipboard.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {client.native && (
            <button
              type="button"
              className={clipboardButton}
              disabled={busy || !snapshot}
              onClick={() => run(() => client.setEnabled(!snapshot.enabled))}
            >
              {snapshot?.enabled ? (
                <Pause className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {snapshot?.enabled
                ? copy("clipboard.pause")
                : copy("clipboard.resume")}
            </button>
          )}
          <button
            type="button"
            className={clipboardButton}
            disabled={busy}
            onClick={() =>
              client.native
                ? run(() => client.importFiles(), copy("clipboard.saved"))
                : fileInput.current?.click()
            }
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {copy("clipboard.import")}
          </button>
          <button
            type="button"
            className={cn(
              clipboardButton,
              "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600",
            )}
            disabled={busy}
            onClick={() => run(() => client.capture(), copy("clipboard.saved"))}
          >
            <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
            {copy("clipboard.capture")}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            aria-label={copy("clipboard.import")}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length)
                void run(
                  () => client.importFiles(files),
                  copy("clipboard.saved"),
                );
            }}
          />
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-oai-gray-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                client.native && snapshot?.enabled && !activeError
                  ? "bg-emerald-500"
                  : "bg-oai-gray-400",
              )}
              aria-hidden
            />
            {client.native
              ? snapshot?.enabled
                ? copy("clipboard.recording")
                : copy("clipboard.paused")
              : copy("clipboard.manual")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {copy("clipboard.local")}
          </span>
          {snapshot && (
            <span>
              {copy("clipboard.summary", {
                count: snapshot.total,
                size: clipboardSize(snapshot.totalBytes),
              })}
            </span>
          )}
        </div>
        {client.native ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded text-oai-gray-500 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500 dark:hover:text-emerald-400"
            onClick={() => run(() => client.openFolder())}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            {copy("clipboard.open_folder")}
          </button>
        ) : (
          <span>{copy("clipboard.paste_hint")}</span>
        )}
      </div>

      <div className="sticky top-0 z-10 -mx-1 mb-5 flex flex-wrap items-center gap-3 bg-white/95 px-1 py-3 backdrop-blur-sm dark:bg-oai-gray-900/95">
        <label className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oai-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy("clipboard.search")}
            aria-label={copy("clipboard.search")}
            className="h-10 w-full rounded-xl border border-oai-gray-200 bg-oai-gray-50/60 pl-9 pr-3 text-sm text-oai-black outline-none placeholder:text-oai-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-oai-gray-700 dark:bg-oai-gray-950/40 dark:text-white"
          />
        </label>
        <div
          role="group"
          aria-label={copy("clipboard.filter")}
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-oai-gray-100 p-1 dark:bg-oai-gray-950/60"
        >
          {filters.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => {
                setKind(id);
                setLimit(60);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500",
                kind === id
                  ? "bg-white font-medium text-oai-black shadow-sm dark:bg-oai-gray-800 dark:text-white"
                  : "text-oai-gray-500 hover:text-oai-gray-800 dark:hover:text-oai-gray-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
              <span className="text-[10px] tabular-nums text-oai-gray-400">
                {snapshot?.counts[id] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label={copy("clipboard.view")}
          className="flex items-center rounded-lg border border-oai-gray-200 p-0.5 dark:border-oai-gray-700"
        >
          {[
            {
              id: "grid",
              Icon: LayoutGrid,
              label: copy("clipboard.view.grid"),
            },
            { id: "list", Icon: List, label: copy("clipboard.view.list") },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={view === id}
              onClick={() => changeView(id)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500",
                view === id
                  ? "bg-oai-gray-100 text-oai-black dark:bg-oai-gray-800 dark:text-white"
                  : "text-oai-gray-400 hover:text-oai-gray-600",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || unpinned === 0}
          onClick={() => setConfirm({ type: "clear" })}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs text-oai-gray-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {copy("clipboard.clear")}
        </button>
      </div>

      {activeError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <span>{activeError}</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setRevision((value) => value + 1)}
          >
            {copy("clipboard.retry")}
          </button>
        </div>
      )}

      {!snapshot && loading && (
        <div
          role="status"
          className="flex min-h-64 items-center justify-center gap-2 text-sm text-oai-gray-400"
        >
          <Loader2
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {copy("clipboard.loading")}
        </div>
      )}
      {Boolean(snapshot?.items.length) && (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-oai-gray-400">
            <span>
              {search || kind !== "all"
                ? copy("clipboard.results", { count: snapshot.matched })
                : copy("clipboard.order_hint")}
            </span>
            <span aria-live="polite">
              {loading
                ? copy("clipboard.refreshing")
                : copy("clipboard.pin_hint")}
            </span>
          </div>
          <div
            aria-busy={loading}
            className={cn(
              "grid min-w-0 gap-4",
              view === "grid"
                ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
                : "grid-cols-1",
            )}
          >
            {snapshot.items.map((entry) => (
              <ClipboardCard
                key={entry.id}
                entry={entry}
                listView={view === "list"}
                disabled={busy}
                native={client.native}
                onPin={() => run(() => client.pin(entry.id, !entry.pinned))}
                onCopy={() =>
                  run(() => client.copy(entry.id), copy("clipboard.copied"))
                }
                onPreview={() => openPreview(entry)}
                onExport={() =>
                  run(() => client.export(entry.id), copy("clipboard.exported"))
                }
                onDelete={() => setConfirm({ type: "delete", entry })}
              />
            ))}
          </div>
          {snapshot.items.length < snapshot.matched && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loading}
                className={clipboardButton}
                onClick={() => setLimit((value) => value + 60)}
              >
                {copy("clipboard.load_more")}
              </button>
            </div>
          )}
        </>
      )}
      {!loading && !snapshot?.items.length && !activeError && (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-oai-gray-200 px-5 py-12 text-center dark:border-oai-gray-700">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-oai-gray-50 text-oai-gray-300 dark:bg-oai-gray-800 dark:text-oai-gray-600">
            {query || kind !== "all" ? (
              <Search className="h-8 w-8" aria-hidden />
            ) : (
              <ClipboardPaste
                className="h-9 w-9"
                strokeWidth={1.4}
                aria-hidden
              />
            )}
          </span>
          <h2 className="text-base font-medium text-oai-gray-700 dark:text-oai-gray-200">
            {query || kind !== "all"
              ? copy("clipboard.no_results")
              : copy("clipboard.empty_title")}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-oai-gray-400">
            {query || kind !== "all"
              ? copy("clipboard.no_results_hint")
              : client.native
                ? copy("clipboard.empty_native")
                : copy("clipboard.empty_browser")}
          </p>
        </div>
      )}

      <p className="mt-7 text-center text-xs leading-5 text-oai-gray-400">
        {copy("clipboard.capacity_hint")}
      </p>

      <ConfirmModal
        open={Boolean(confirm)}
        title={
          confirm?.type === "clear"
            ? copy("clipboard.clear_title")
            : copy("clipboard.delete_title")
        }
        description={
          confirm?.type === "clear"
            ? copy("clipboard.clear_description", { count: unpinned })
            : confirm?.entry?.pinned
              ? copy("clipboard.delete_pinned_description")
              : copy("clipboard.delete_description")
        }
        confirmLabel={
          confirm?.type === "clear"
            ? copy("clipboard.clear_confirm")
            : copy("clipboard.delete")
        }
        cancelLabel={copy("clipboard.cancel")}
        destructive
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const ok = await run(
            () =>
              confirm.type === "clear"
                ? client.clear()
                : client.remove(confirm.entry.id),
            copy("clipboard.deleted"),
          );
          if (ok && mounted.current) setConfirm(null);
        }}
      />

      <Dialog.Root
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
          <Dialog.Viewport className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-8">
            <Dialog.Popup className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none dark:bg-oai-gray-900">
              <div className="flex items-center justify-between border-b border-oai-gray-100 px-5 py-4 dark:border-oai-gray-800">
                <div>
                  <Dialog.Title className="font-semibold text-oai-black dark:text-white">
                    {copy("clipboard.preview_title", {
                      type: clipboardTypeLabel(preview?.kind),
                    })}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs text-oai-gray-400">
                    {copy("clipboard.preview_description")}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  disabled={busy}
                  aria-label={copy("clipboard.close")}
                  className="rounded-lg p-2 text-oai-gray-400 hover:bg-oai-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500 dark:hover:bg-oai-gray-800"
                >
                  <X className="h-5 w-5" aria-hidden />
                </Dialog.Close>
              </div>
              <div className="min-h-0 overflow-auto p-5">
                {preview?.kind === "text" && (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-oai-gray-700 [overflow-wrap:anywhere] dark:text-oai-gray-200">
                    {preview.text}
                  </pre>
                )}
                {preview?.kind === "image" && (
                  <img
                    className="mx-auto max-h-[65vh] max-w-full object-contain"
                    src={preview.previewUrl}
                    alt={copy("clipboard.image_alt")}
                  />
                )}
                {preview?.kind === "files" && (
                  <ul className="space-y-3">
                    {preview.files.map((file, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-3 rounded-xl bg-oai-gray-50 p-4 dark:bg-oai-gray-950"
                      >
                        <File
                          className="h-5 w-5 shrink-0 text-violet-500"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 break-all text-sm text-oai-gray-700 dark:text-oai-gray-200">
                          {file.name}
                        </span>
                        <span className="shrink-0 text-xs text-oai-gray-400">
                          {clipboardSize(file.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-oai-gray-100 px-5 py-4 dark:border-oai-gray-800">
                <button
                  type="button"
                  disabled={busy}
                  className={clipboardButton}
                  onClick={() =>
                    run(
                      () => client.export(preview.id),
                      copy("clipboard.exported"),
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {copy("clipboard.export")}
                </button>
                <button
                  type="button"
                  disabled={
                    busy || (!client.native && preview?.kind === "files")
                  }
                  title={
                    !client.native && preview?.kind === "files"
                      ? copy("clipboard.error.file_copy")
                      : undefined
                  }
                  className={clipboardButton}
                  onClick={() =>
                    run(() => client.copy(preview.id), copy("clipboard.copied"))
                  }
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {copy("clipboard.copy")}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
