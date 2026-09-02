import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";

import { copy } from "../lib/copy";
import { cn } from "../lib/cn";
import {
  commitMcpMutation,
  getMcpState,
  previewMcpMutation,
} from "../lib/mcp-api";
import { Button, Card, Input } from "../ui/components";
import { ProviderIcon } from "../ui/dashboard/components/ProviderIcon.jsx";
import { showToast } from "../ui/components/Toast.jsx";
import { McpIcon } from "../ui/icons/McpIcon.jsx";
import { McpReviewModal } from "./McpReviewModal.jsx";

const TARGET_IDS = ["claude", "codex", "gemini", "grok"];

function emptyApps() {
  return Object.fromEntries(TARGET_IDS.map((id) => [id, false]));
}

function serverSummary(server) {
  if (server.server?.type === "stdio") {
    return [server.server.command, ...(server.server.args || [])].filter(Boolean).join(" ");
  }
  return server.server?.url || "";
}

function warningToast(result) {
  const count = result?.warnings?.length || 0;
  if (!count) return false;
  showToast({ title: copy("skills.mcp.toast.partial", { count }) });
  return true;
}

function operationKey(operation) {
  if (operation.action === "upsert") return `upsert:${operation.server?.id || "new"}`;
  if (operation.action === "toggle") return `toggle:${operation.id}:${operation.target}`;
  return `delete:${operation.id}`;
}

function operationSuccessKey(operation) {
  return operation.action === "delete" ? "skills.mcp.toast.deleted" : "skills.mcp.toast.saved";
}

function TargetToggle({ target, enabled, busy, onToggle }) {
  const stateText = enabled
    ? copy("skills.mcp.target.enabled", { agent: target.label })
    : copy("skills.mcp.target.disabled", { agent: target.label });
  const installText = target.installed ? "" : ` ${copy("skills.mcp.target.not_detected")}`;
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={`${stateText}${installText}`}
      title={`${stateText}${installText}`}
      disabled={busy || !target.installed}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
        enabled
          ? "border-oai-gray-400 bg-oai-gray-100 text-oai-black dark:border-oai-gray-600 dark:bg-oai-gray-800 dark:text-white"
          : "border-oai-gray-200 bg-white text-oai-gray-500 hover:border-oai-gray-300 dark:border-oai-gray-800 dark:bg-oai-gray-900 dark:text-oai-gray-400 dark:hover:border-oai-gray-700",
        !target.installed && "border-dashed opacity-65",
        busy && "cursor-wait opacity-50",
        !target.installed && "cursor-not-allowed",
      )}
    >
      <ProviderIcon provider={target.id} size={15} />
      <span>{target.label}</span>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          enabled ? "bg-emerald-500" : "bg-oai-gray-300 dark:bg-oai-gray-600",
        )}
      />
    </button>
  );
}

function parseStringMap(value, label) {
  if (!String(value || "").trim()) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label}: ${copy("skills.mcp.form.object_required")}`);
  }
  for (const entry of Object.values(parsed)) {
    if (typeof entry !== "string") throw new Error(`${label}: ${copy("skills.mcp.form.string_values")}`);
  }
  return parsed;
}

function McpEditorModal({ open, server, targets, busy, onClose, onSave }) {
  const editing = Boolean(server);
  const [id, setId] = useState("");
  const [type, setType] = useState("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [env, setEnv] = useState("");
  const [headers, setHeaders] = useState("");
  const [apps, setApps] = useState(emptyApps);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const spec = server?.server || {};
    setId(server?.id || "");
    setType(spec.type || "stdio");
    setCommand(spec.command || "");
    setArgs((spec.args || []).join("\n"));
    setUrl(spec.url || "");
    setEnv(spec.env ? JSON.stringify(spec.env, null, 2) : "");
    setHeaders(spec.headers ? JSON.stringify(spec.headers, null, 2) : "");
    setApps({ ...emptyApps(), ...(server?.apps || {}) });
    setError("");
  }, [open, server]);

  const submit = async () => {
    try {
      const trimmedId = id.trim();
      if (!trimmedId) throw new Error(copy("skills.mcp.form.id_required"));
      if (!Object.values(apps).some(Boolean)) {
        throw new Error(copy("skills.mcp.form.target_required"));
      }
      const parsedEnv = type === "stdio" ? parseStringMap(env, copy("skills.mcp.form.env")) : undefined;
      const parsedHeaders = type !== "stdio" ? parseStringMap(headers, copy("skills.mcp.form.headers")) : undefined;
      const spec = type === "stdio"
        ? {
            type,
            command: command.trim(),
            args: args.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean),
            ...(parsedEnv ? { env: parsedEnv } : {}),
          }
        : {
            type,
            url: url.trim(),
            ...(parsedHeaders ? { headers: parsedHeaders } : {}),
          };
      if (type === "stdio" && !spec.command) throw new Error(copy("skills.mcp.form.command_required"));
      if (type !== "stdio" && !spec.url) throw new Error(copy("skills.mcp.form.url_required"));
      await onSave({
        id: trimmedId,
        server: spec,
        apps,
      });
    } catch (submitError) {
      setError(submitError?.message || String(submitError));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[101] flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup className="relative my-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-oai-gray-200 transition data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 dark:bg-oai-gray-950 dark:ring-oai-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-oai-black dark:text-white">
                  {copy(editing ? "skills.mcp.form.edit_title" : "skills.mcp.form.add_title")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-oai-gray-500 dark:text-oai-gray-400">
                  {copy("skills.mcp.form.description")}
                </Dialog.Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label={copy("shared.action.close")}
                className="rounded-md p-1.5 text-oai-gray-400 hover:bg-oai-gray-100 hover:text-oai-black dark:hover:bg-oai-gray-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5">
              <Input label={copy("skills.mcp.form.id")} value={id} onChange={(event) => setId(event.target.value)} disabled={editing || busy} />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-oai-gray-700 dark:text-oai-gray-300" htmlFor="mcp-transport">
                {copy("skills.mcp.form.transport")}
              </label>
              <select
                id="mcp-transport"
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={busy}
                className="h-10 w-full rounded-md border border-oai-gray-300 bg-white px-3 text-sm text-oai-black focus:border-oai-brand focus:outline-none focus:ring-1 focus:ring-oai-brand/30 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-white"
              >
                {["stdio", "http", "sse"].map((transport) => (
                  <option key={transport} value={transport}>{transport}</option>
                ))}
              </select>
            </div>

            {type === "stdio" ? (
              <div className="mt-4 grid gap-4">
                <Input label={copy("skills.mcp.form.command")} value={command} onChange={(event) => setCommand(event.target.value)} disabled={busy} />
                <label className="block text-sm font-medium text-oai-gray-700 dark:text-oai-gray-300">
                  {copy("skills.mcp.form.args")}
                  <textarea
                    value={args}
                    onChange={(event) => setArgs(event.target.value)}
                    disabled={busy}
                    rows={3}
                    className="mt-1.5 w-full rounded-md border border-oai-gray-300 bg-white px-3 py-2 font-mono text-sm text-oai-black focus:border-oai-brand focus:outline-none focus:ring-1 focus:ring-oai-brand/30 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-white"
                  />
                </label>
                <label className="block text-sm font-medium text-oai-gray-700 dark:text-oai-gray-300">
                  {copy("skills.mcp.form.env")}
                  <textarea
                    value={env}
                    onChange={(event) => setEnv(event.target.value)}
                    disabled={busy}
                    rows={4}
                    placeholder={'{\n  "TOKEN": "..."\n}'}
                    className="mt-1.5 w-full rounded-md border border-oai-gray-300 bg-white px-3 py-2 font-mono text-sm text-oai-black focus:border-oai-brand focus:outline-none focus:ring-1 focus:ring-oai-brand/30 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-white"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <Input label={copy("skills.mcp.form.url")} value={url} onChange={(event) => setUrl(event.target.value)} disabled={busy} />
                <label className="block text-sm font-medium text-oai-gray-700 dark:text-oai-gray-300">
                  {copy("skills.mcp.form.headers")}
                  <textarea
                    value={headers}
                    onChange={(event) => setHeaders(event.target.value)}
                    disabled={busy}
                    rows={4}
                    placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
                    className="mt-1.5 w-full rounded-md border border-oai-gray-300 bg-white px-3 py-2 font-mono text-sm text-oai-black focus:border-oai-brand focus:outline-none focus:ring-1 focus:ring-oai-brand/30 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-white"
                  />
                </label>
              </div>
            )}

            <div className="mt-5">
              <p className="text-sm font-medium text-oai-gray-700 dark:text-oai-gray-300">
                {copy("skills.mcp.form.apps")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {targets.map((target) => (
                  <TargetToggle
                    key={target.id}
                    target={target}
                    enabled={Boolean(apps[target.id])}
                    busy={busy}
                    onToggle={(enabled) => setApps((current) => ({ ...current, [target.id]: enabled }))}
                  />
                ))}
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
                {copy("shared.action.cancel")}
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={submit}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {copy("shared.action.save")}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function McpPanel() {
  const [data, setData] = useState({ servers: [], targets: [], warnings: [] });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);
  const [reviewError, setReviewError] = useState("");

  const load = async ({ notifyWarnings = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      const next = await getMcpState();
      setData(next);
      if (notifyWarnings) warningToast(next);
    } catch (loadError) {
      setError(loadError?.message || copy("skills.mcp.error.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const targets = data.targets || [];
  const servers = data.servers || [];
  const filteredServers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return servers;
    return servers.filter((server) =>
      [server.id, server.name, server.description, serverSummary(server)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, servers]);

  const counts = useMemo(() => Object.fromEntries(targets.map((target) => [
    target.id,
    servers.filter((server) => server.apps?.[target.id]).length,
  ])), [servers, targets]);

  const run = async (key, task, successKey) => {
    setBusyKey(key);
    setError("");
    try {
      const result = await task();
      const warned = warningToast(result);
      await load({ notifyWarnings: false });
      if (!warned && successKey) showToast({ title: copy(successKey) });
      return result;
    } catch (runError) {
      setError(runError?.message || copy("skills.mcp.error.operation"));
      throw runError;
    } finally {
      setBusyKey("");
    }
  };

  const requestReview = async (operation) => {
    setBusyKey(`preview:${operationKey(operation)}`);
    setError("");
    setReviewError("");
    try {
      const review = await previewMcpMutation(operation);
      setPendingReview({ operation, review });
      return review;
    } catch (previewError) {
      setError(previewError?.message || copy("skills.mcp.error.preview"));
      throw previewError;
    } finally {
      setBusyKey("");
    }
  };

  const save = (server) => requestReview({ action: "upsert", server });

  const toggle = async (server, target, enabled) => {
    try {
      await requestReview({ action: "toggle", id: server.id, target: target.id, enabled });
    } catch (_error) {
      // Error banner already contains the backend detail.
    }
  };

  const confirmReview = async () => {
    if (!pendingReview) return;
    const { operation, review } = pendingReview;
    setReviewError("");
    try {
      await run(
        `commit:${operationKey(operation)}`,
        () => commitMcpMutation(operation, review.reviewToken),
        operationSuccessKey(operation),
      );
      setPendingReview(null);
      if (operation.action === "upsert") {
        setEditorOpen(false);
        setEditing(null);
      }
    } catch (commitError) {
      setReviewError(commitError?.message || copy("skills.mcp.error.operation"));
    }
  };

  return (
    <div className="space-y-5">
      <Card bodyClassName="!p-4 sm:!p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-oai-gray-100 text-oai-gray-700 dark:bg-oai-gray-800 dark:text-oai-gray-200">
              <McpIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-oai-black dark:text-white">
                {copy("skills.mcp.title")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-oai-gray-500 dark:text-oai-gray-400">
                {copy("skills.mcp.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="secondary" size="sm" disabled={Boolean(busyKey) || loading} onClick={() => load()}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              {copy("skills.action.refresh")}
            </Button>
            <Button type="button" size="sm" disabled={Boolean(busyKey)} onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {copy("skills.mcp.action.add")}
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <div
            key={target.id}
            title={`${target.configPath}${target.installed ? "" : ` — ${copy("skills.mcp.target.not_detected")}`}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-oai-gray-600 dark:text-oai-gray-300",
              target.installed
                ? "border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-900"
                : "border-dashed border-oai-gray-300 opacity-60 dark:border-oai-gray-700",
            )}
          >
            <ProviderIcon provider={target.id} size={15} />
            <span>{target.label}</span>
            <span className="rounded-full bg-oai-gray-100 px-1.5 py-0.5 tabular-nums dark:bg-oai-gray-800">
              {counts[target.id] || 0}
            </span>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oai-gray-400" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={copy("skills.mcp.search_aria")}
          placeholder={copy("skills.mcp.search_placeholder")}
          className="pl-9"
        />
      </div>

      <McpServerList
        loading={loading}
        servers={filteredServers}
        targets={targets}
        busyKey={busyKey}
        query={query}
        onToggle={toggle}
        onEdit={(server) => { setEditing(server); setEditorOpen(true); }}
        onDelete={(server) => requestReview({ action: "delete", id: server.id }).catch(() => {})}
        onAdd={() => { setEditing(null); setEditorOpen(true); }}
      />

      <McpEditorModal
        open={editorOpen}
        server={editing}
        targets={targets}
        busy={busyKey.startsWith("preview:upsert:") || busyKey.startsWith("commit:upsert:")}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onSave={save}
      />
      <McpReviewModal
        open={Boolean(pendingReview)}
        operation={pendingReview?.operation}
        review={pendingReview?.review}
        busy={busyKey.startsWith("commit:")}
        error={reviewError}
        onClose={() => { setPendingReview(null); setReviewError(""); }}
        onConfirm={confirmReview}
      />
    </div>
  );
}

function McpServerList({ loading, servers, targets, busyKey, query, onToggle, onEdit, onDelete, onAdd }) {
  if (loading) {
    return (
      <div className="flex h-52 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-oai-gray-400" aria-hidden />
      </div>
    );
  }

  if (!servers.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-oai-gray-200 px-6 py-12 text-center dark:border-oai-gray-800">
        <Server className="h-8 w-8 text-oai-gray-300 dark:text-oai-gray-600" aria-hidden />
        <p className="text-sm text-oai-gray-500 dark:text-oai-gray-400">
          {copy(query.trim() ? "skills.mcp.empty.search" : "skills.mcp.empty.default")}
        </p>
        {!query.trim() ? (
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {copy("skills.mcp.action.add")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-900">
      {servers.map((server, index) => (
        <div
          key={server.id}
          className={cn(
            "group px-4 py-4 sm:px-5",
            index > 0 && "border-t border-oai-gray-200 dark:border-oai-gray-800",
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-oai-black dark:text-white">
                  {server.name || server.id}
                </span>
                <span className="rounded bg-oai-gray-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-oai-gray-500 dark:bg-oai-gray-800 dark:text-oai-gray-400">
                  {server.server?.type || "stdio"}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-oai-gray-500 dark:text-oai-gray-400" title={serverSummary(server)}>
                {serverSummary(server)}
              </p>
              {server.description ? (
                <p className="mt-1 truncate text-xs text-oai-gray-400">{server.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {targets.map((target) => (
                <TargetToggle
                  key={target.id}
                  target={target}
                  enabled={Boolean(server.apps?.[target.id])}
                  busy={Boolean(busyKey)}
                  onToggle={(enabled) => onToggle(server, target, enabled)}
                />
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1 self-end lg:self-auto">
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => onEdit(server)}
                aria-label={copy("skills.mcp.action.edit_aria", { name: server.name || server.id })}
                className="rounded-md p-2 text-oai-gray-400 hover:bg-oai-gray-100 hover:text-oai-black disabled:opacity-40 dark:hover:bg-oai-gray-800 dark:hover:text-white"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => onDelete(server)}
                aria-label={copy("skills.mcp.action.delete_aria", { name: server.name || server.id })}
                className="rounded-md p-2 text-oai-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
