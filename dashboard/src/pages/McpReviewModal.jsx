import React, { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, ChevronRight, FileCode2, Loader2, X } from "lucide-react";

import { cn } from "../lib/cn";
import { copy } from "../lib/copy";
import { Button } from "../ui/components";
import { ProviderIcon } from "../ui/dashboard/components/ProviderIcon.jsx";

function compactDiffLines(lines, expandedHunks) {
  const visible = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].type !== "context") {
      visible.push(lines[index]);
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < lines.length && lines[end].type === "context") end += 1;
    const run = lines.slice(index, end);
    const hunkId = `${index}:${end}`;
    if (run.length <= 6 || expandedHunks.has(hunkId)) {
      visible.push(...run);
    } else {
      const atStart = index === 0;
      const atEnd = end === lines.length;
      const keepBefore = atEnd ? 3 : atStart ? 0 : 2;
      const keepAfter = atStart ? 3 : atEnd ? 0 : 2;
      visible.push(...run.slice(0, keepBefore));
      visible.push({
        type: "collapsed",
        count: run.length - keepBefore - keepAfter,
        hunkId,
      });
      if (keepAfter) visible.push(...run.slice(-keepAfter));
    }
    index = end;
  }
  return visible;
}

function configFileName(configPath) {
  return String(configPath || "").split(/[\\/]/).filter(Boolean).pop() || configPath;
}

function HighlightedConfigLine({ text }) {
  if (/^\s*\[.*\]\s*$/.test(text)) {
    return <span className="text-sky-700 dark:text-sky-300">{text}</span>;
  }

  const tokens = [];
  const matcher = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null)\b|\b-?\d+(?:\.\d+)?\b/g;
  let cursor = 0;
  let match;
  while ((match = matcher.exec(text)) !== null) {
    if (match.index > cursor) tokens.push({ text: text.slice(cursor, match.index), type: "plain" });
    const value = match[0];
    const rest = text.slice(match.index + value.length).trimStart();
    const quoted = value.startsWith('"') || value.startsWith("'");
    tokens.push({
      text: value,
      type: quoted ? (rest.startsWith(":") || rest.startsWith("=") ? "key" : "string") : "literal",
    });
    cursor = match.index + value.length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor), type: "plain" });
  if (!tokens.length) return text;

  return tokens.map((token, index) => (
    <span
      key={`${index}:${token.text}`}
      className={cn(
        token.type === "key" && "text-sky-700 dark:text-sky-300",
        token.type === "string" && "text-lime-700 dark:text-lime-300",
        token.type === "literal" && "text-violet-700 dark:text-violet-300",
      )}
    >
      {token.text}
    </span>
  ));
}

function DiffRow({ line, onExpand }) {
  if (line.type === "collapsed") {
    return (
      <div className="grid min-w-max grid-cols-[3rem_3rem_minmax(42rem,1fr)] border-y border-oai-gray-200 bg-oai-gray-50 dark:border-oai-gray-800 dark:bg-oai-gray-900/80">
        <span className="border-r border-oai-gray-200 dark:border-oai-gray-800" />
        <span className="border-r border-oai-gray-200 dark:border-oai-gray-800" />
        <div className="flex min-h-11 items-center justify-center px-4">
          <button
            type="button"
            onClick={onExpand}
            className="rounded-lg border border-oai-gray-200 bg-white px-3 py-1 text-xs text-oai-gray-600 shadow-sm hover:border-oai-gray-300 hover:text-oai-black dark:border-oai-gray-700 dark:bg-oai-gray-950 dark:text-oai-gray-300 dark:hover:border-oai-gray-600 dark:hover:text-white"
          >
            {copy("skills.mcp.review.unchanged_count", { count: line.count })}
          </button>
        </div>
      </div>
    );
  }

  const added = line.type === "add";
  const removed = line.type === "remove";
  return (
    <div
      data-testid={`mcp-diff-row-${line.type}`}
      className={cn(
        "grid min-w-max grid-cols-[3rem_3rem_minmax(42rem,1fr)] font-mono text-[13px] leading-6",
        added && "bg-emerald-100/70 text-emerald-950 dark:bg-emerald-950/45 dark:text-emerald-100",
        removed && "bg-red-100/70 text-red-950 dark:bg-red-950/45 dark:text-red-100",
        !added && !removed && "bg-white text-oai-gray-800 dark:bg-oai-gray-950 dark:text-oai-gray-200",
      )}
    >
      <span className={cn(
        "select-none border-r border-oai-gray-200 px-2 text-right text-oai-gray-400 dark:border-oai-gray-800 dark:text-oai-gray-600",
        added && "bg-emerald-100/80 dark:bg-emerald-950/55",
        removed && "bg-red-100/80 dark:bg-red-950/55",
      )}>
        {line.oldLine ?? ""}
      </span>
      <span className={cn(
        "select-none border-r border-oai-gray-200 px-2 text-right text-oai-gray-400 dark:border-oai-gray-800 dark:text-oai-gray-600",
        added && "bg-emerald-100/80 dark:bg-emerald-950/55",
        removed && "bg-red-100/80 dark:bg-red-950/55",
      )}>
        {line.newLine ?? ""}
      </span>
      <code className="whitespace-pre px-3 pr-8">
        <HighlightedConfigLine text={line.text || " "} />
      </code>
    </div>
  );
}

function FileDiff({ change }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedHunks, setExpandedHunks] = useState(() => new Set());
  const lines = compactDiffLines(change.lines || [], expandedHunks);
  const fileName = configFileName(change.configPath);

  const expandHunk = (hunkId) => {
    setExpandedHunks((current) => {
      const next = new Set(current);
      next.add(hunkId);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-950">
      <button
        type="button"
        data-testid="mcp-file-diff-header"
        onClick={() => setCollapsed((current) => !current)}
        aria-label={copy(collapsed ? "skills.mcp.review.file_expand" : "skills.mcp.review.file_collapse")}
        className="flex w-full items-center justify-between gap-4 bg-white px-4 py-3 text-left hover:bg-oai-gray-50 dark:bg-oai-gray-950 dark:hover:bg-oai-gray-900"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderIcon provider={change.target} size={17} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-oai-black dark:text-white">{fileName}</span>
              <span className="text-xs text-oai-gray-400 dark:text-oai-gray-500">{change.label}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-oai-gray-400 dark:text-oai-gray-500" title={change.configPath}>
              {change.configPath}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">+{change.additions}</span>
          <span className="text-red-500 dark:text-red-400">−{change.deletions}</span>
          <span className="text-oai-gray-400 dark:text-oai-gray-500">
            {collapsed
              ? <ChevronRight className="h-4 w-4" aria-hidden />
              : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </div>
      </button>
      {!collapsed ? (
        <div className="overflow-x-auto border-t border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-950">
          {lines.map((line, index) => (
            <DiffRow
              key={`${line.type}:${line.oldLine ?? ""}:${line.newLine ?? ""}:${line.hunkId || index}`}
              line={line}
              onExpand={() => expandHunk(line.hunkId)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function McpReviewModal({ open, operation, review, busy, error, onClose, onConfirm }) {
  const reviewKey = review?.reviewToken || "pending";
  const changes = review?.changes || [];
  const destructive = operation?.action === "delete";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[111] flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup className="relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-oai-gray-200 transition data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 dark:bg-oai-gray-950 dark:ring-oai-gray-800">
            <div className="flex items-start justify-between gap-4 border-b border-oai-gray-200 px-5 py-4 dark:border-oai-gray-800 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold text-oai-black dark:text-white">
                  {copy("skills.mcp.review.title")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-6 text-oai-gray-500 dark:text-oai-gray-400">
                  {copy("skills.mcp.review.description")}
                </Dialog.Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label={copy("shared.action.close")}
                className="rounded-md p-1.5 text-oai-gray-400 hover:bg-oai-gray-100 hover:text-oai-black disabled:opacity-40 dark:hover:bg-oai-gray-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-oai-gray-50/70 px-4 py-4 dark:bg-black/10 sm:px-5">
              {review?.warnings?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-medium">{copy("skills.mcp.review.warning_title")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {review.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
                  {error}
                </div>
              ) : null}
              {changes.length ? changes.map((change) => (
                <FileDiff
                  key={`${reviewKey}:${change.target}:${change.configPath}`}
                  change={change}
                />
              )) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-oai-gray-200 px-6 py-10 text-center dark:border-oai-gray-800">
                  <FileCode2 className="h-8 w-8 text-oai-gray-300 dark:text-oai-gray-600" aria-hidden />
                  <p className="text-sm text-oai-gray-500 dark:text-oai-gray-400">
                    {copy("skills.mcp.review.no_changes")}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-oai-gray-200 px-5 py-4 dark:border-oai-gray-800 sm:px-6">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
                {copy("shared.action.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !changes.length}
                onClick={onConfirm}
                className={cn(
                  destructive && "!bg-red-600 hover:!bg-red-700 dark:!bg-red-600 dark:hover:!bg-red-500",
                )}
              >
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {copy(destructive ? "skills.mcp.review.confirm_delete" : "skills.mcp.review.confirm_write")}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
