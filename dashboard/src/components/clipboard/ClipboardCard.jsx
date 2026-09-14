import React from "react";
import {
  Copy,
  Download,
  File,
  FileText,
  Image,
  Pin,
  PinOff,
  ScanEye,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";

export function clipboardTypeLabel(kind) {
  return kind === "text"
    ? copy("clipboard.type.text")
    : kind === "image"
      ? copy("clipboard.type.image")
      : copy("clipboard.type.files");
}

export function clipboardSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clipboardTime(value) {
  const date = new Date(value);
  const today = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    "zh-CN",
    today
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
  ).format(date);
}

export const clipboardButton =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-oai-gray-200 bg-white px-3 text-xs font-medium text-oai-gray-600 transition-colors hover:bg-oai-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800";

function Action({ label, children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(clipboardButton, "w-9 px-0")}
      {...props}
    >
      {children}
    </button>
  );
}

export function ClipboardCard({
  entry,
  listView,
  disabled,
  native,
  onPin,
  onCopy,
  onPreview,
  onExport,
  onDelete,
}) {
  const Icon =
    entry.kind === "text" ? FileText : entry.kind === "image" ? Image : File;
  const label = clipboardTypeLabel(entry.kind);
  const moreFiles = entry.files.length - (listView ? 2 : 3);
  return (
    <article
      data-clipboard-id={entry.id}
      aria-label={copy("clipboard.entry_label", {
        type: label,
        time: clipboardTime(entry.updatedAt),
      })}
      className={cn(
        "group min-w-0 rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-oai-gray-900",
        entry.pinned
          ? "border-amber-300/90 shadow-sm dark:border-amber-700/70"
          : "border-oai-gray-200 dark:border-oai-gray-800",
        listView && "sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-5",
      )}
    >
      <div
        className={cn(
          "mb-3 flex min-w-0 items-center gap-2",
          listView && "sm:col-span-2",
        )}
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            entry.kind === "text"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : entry.kind === "image"
                ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        {entry.pinned && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <Pin className="h-3 w-3" aria-hidden />
            {copy("clipboard.pinned")}
          </span>
        )}
        <time
          className="ml-auto shrink-0 text-xs tabular-nums text-oai-gray-400"
          dateTime={entry.updatedAt}
          title={new Date(entry.updatedAt).toLocaleString("zh-CN")}
        >
          {clipboardTime(entry.updatedAt)}
        </time>
      </div>
      <button
        type="button"
        onClick={onPreview}
        disabled={disabled}
        aria-label={copy("clipboard.preview")}
        className={cn(
          "relative flex w-full min-w-0 items-start overflow-hidden rounded-xl bg-oai-gray-50 p-3.5 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-oai-brand-500 dark:bg-oai-gray-950/60",
          listView ? "h-24" : "h-44",
        )}
      >
        {entry.kind === "text" && (
          <pre
            className={cn(
              "w-full whitespace-pre-wrap break-words font-sans text-sm leading-6 text-oai-gray-700 [overflow-wrap:anywhere] dark:text-oai-gray-200",
              listView ? "line-clamp-3" : "line-clamp-6",
            )}
          >
            {entry.text}
          </pre>
        )}
        {entry.kind === "image" && (
          <img
            className="h-full w-full object-contain"
            src={entry.previewUrl}
            alt={copy("clipboard.image_alt")}
            loading="lazy"
          />
        )}
        {entry.kind === "files" && (
          <div className="flex w-full flex-col gap-3">
            {entry.files.slice(0, listView ? 2 : 3).map((file, index) => (
              <div key={index} className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet-500 shadow-sm dark:bg-oai-gray-800">
                  <File className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm text-oai-gray-700 dark:text-oai-gray-200"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <span className="text-xs text-oai-gray-400">
                    {clipboardSize(file.bytes)}
                  </span>
                </span>
              </div>
            ))}
            {Math.max(0, moreFiles) !== 0 && (
              <span className="text-xs text-oai-gray-400">
                {copy("clipboard.more_files", { count: moreFiles })}
              </span>
            )}
          </div>
        )}
        <ScanEye
          className="absolute bottom-2 right-2 h-4 w-4 text-oai-gray-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-oai-gray-100 pt-3 dark:border-oai-gray-800",
          listView &&
            "sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0",
        )}
      >
        <div className="flex items-center gap-2 text-xs tabular-nums text-oai-gray-400">
          <span>
            {entry.kind === "text"
              ? copy("clipboard.characters", { count: entry.characterCount })
              : entry.kind === "image"
                ? `${entry.width} × ${entry.height}`
                : copy("clipboard.file_count", { count: entry.files.length })}
          </span>
          <span
            className="h-3 w-px bg-oai-gray-200 dark:bg-oai-gray-700"
            aria-hidden
          />
          <span>{clipboardSize(entry.bytes)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Action
            label={
              entry.pinned ? copy("clipboard.unpin") : copy("clipboard.pin")
            }
            disabled={disabled}
            onClick={onPin}
          >
            {entry.pinned ? (
              <PinOff className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            ) : (
              <Pin className="h-3.5 w-3.5" aria-hidden />
            )}
          </Action>
          <button
            type="button"
            onClick={onCopy}
            disabled={disabled || (!native && entry.kind === "files")}
            title={
              !native && entry.kind === "files"
                ? copy("clipboard.error.file_copy")
                : undefined
            }
            className={cn(
              clipboardButton,
              "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/70",
            )}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copy("clipboard.copy")}
          </button>
          <Action
            label={copy("clipboard.export")}
            disabled={disabled}
            onClick={onExport}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </Action>
          <Action
            label={copy("clipboard.delete")}
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Action>
        </div>
      </div>
    </article>
  );
}
