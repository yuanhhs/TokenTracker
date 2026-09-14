import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Check, ChevronDown, Clipboard, Copy, EyeOff, File,
  Image as ImageIcon, LoaderCircle, Minimize2, Pin, Plus, RefreshCw, Search, Type,
} from "lucide-react";
import { copy } from "../lib/copy";
import { createClipboardClient, clipboardErrorMessage } from "../lib/clipboard-api";
import { releaseClipboardPreviews } from "../lib/clipboard-store";
import { isNativeWindowsApp } from "../lib/native-bridge.js";
import { FloatingBall } from "./FloatingBall";
import { postFloating, subscribeFloating } from "./floating-bridge";

const TYPES = ["all", "text", "image", "files"];
const ICONS = { text: Type, image: ImageIcon, files: File };

function localDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
    month: "long", day: "numeric", weekday: "short",
  });
}

function recordTime(value) {
  const date = new Date(value);
  const today = date.toDateString() === new Date().toDateString();
  return date.toLocaleString("zh-CN", {
    ...(today ? {} : { month: "numeric", day: "numeric" }), hour: "2-digit", minute: "2-digit",
  });
}

function BallButton({ onOpen, native }) {
  const hold = useRef(null);
  const pointer = useRef(null);
  const dragged = useRef(false);
  const clearHold = useCallback(() => {
    clearTimeout(hold.current);
    hold.current = null;
  }, []);
  useEffect(() => {
    window.addEventListener("blur", clearHold);
    return () => { clearHold(); window.removeEventListener("blur", clearHold); };
  }, [clearHold]);
  const startDrag = () => {
    clearHold();
    if (!native || !pointer.current || dragged.current) return;
    dragged.current = true;
    postFloating("drag");
  };
  return (
    <button type="button" className="floating-ball-button"
      aria-label={copy("floating.ball_label")} title={copy("floating.ball_hint")}
      aria-haspopup="dialog"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        clearHold();
        dragged.current = false;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        hold.current = setTimeout(startDrag, 250);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6)
          startDrag();
      }}
      onPointerUp={() => { clearHold(); pointer.current = null; }}
      onPointerCancel={() => { clearHold(); pointer.current = null; }}
      onLostPointerCapture={clearHold}
      onClick={(event) => { if (event.detail === 0 || !dragged.current) onOpen(); }}>
      <FloatingBall />
    </button>
  );
}

function RecordButton({ entry, busy, copied, onCopy }) {
  const Icon = ICONS[entry.kind] || File;
  const title = entry.kind === "text" ? entry.text : entry.files.map((file) => { return file.name; }).join("、");
  return (
    <button type="button" className={`floating-record ${copied ? "is-copied" : ""}`}
      disabled={busy} onClick={() => onCopy(entry)}
      aria-label={copy("floating.copy_record", { type: copy(`clipboard.type.${entry.kind}`), content: title.slice(0, 60) })}>
      <span className={`floating-record-icon kind-${entry.kind}`}>
        {entry.kind === "image" && entry.previewUrl
          ? <img src={entry.previewUrl} alt={copy("clipboard.image_alt")} draggable={false} />
          : <Icon size={19} strokeWidth={1.6} />}
      </span>
      <span className="floating-record-body">
        <span className="floating-record-text">{title}</span>
        <span className="floating-record-meta">
          {entry.pinned && <Pin size={10} aria-label={copy("clipboard.pinned")} />}
          <span>{copy(`clipboard.type.${entry.kind}`)}</span>
          <span aria-hidden="true">{copy("floating.separator")}</span>
          <span>{recordTime(entry.updatedAt)}</span>
          {entry.kind === "files" && <span>{copy("clipboard.file_count", { count: entry.files.length })}</span>}
        </span>
      </span>
      <span className="floating-copy-icon" aria-hidden="true">{copied ? <Check size={16} /> : <Copy size={15} />}</span>
    </button>
  );
}

export function FloatingApp() {
  const native = isNativeWindowsApp();
  const client = useMemo(() => createClipboardClient(native), [native]);
  const [state, setState] = useState(() => ({
    expanded: !native && new URLSearchParams(window.location.search).get("expanded") === "1",
    isLight: true,
    date: new Date().toLocaleDateString("sv-SE"),
    todayTokens: null, exactTokens: null, todayCost: null, updatedAt: null,
  }));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(30);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const search = useRef(null);

  useEffect(() => {
    if (!native) return;
    const unsubscribe = subscribeFloating(setState);
    postFloating("ready");
    return unsubscribe;
  }, [native]);
  useEffect(() => { document.documentElement.classList.toggle("dark", !state.isLight); }, [state.isLight]);
  useEffect(() => client.subscribe(() => setRevision((value) => value + 1)), [client]);
  useEffect(() => () => releaseClipboardPreviews(snapshot), [snapshot]);
  useEffect(() => {
    if (!state.expanded) { setSnapshot(null); return; }
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await client.list({ query, kind, limit });
        if (!active) { releaseClipboardPreviews(result); return; }
        setSnapshot(result);
        setLoadError(result.error ? clipboardErrorMessage(result.error) : "");
      } catch (error) {
        if (active) setLoadError(clipboardErrorMessage(error));
      } finally { if (active) setLoading(false); }
    }, 120);
    return () => { active = false; clearTimeout(timer); };
  }, [client, state.expanded, query, kind, limit, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => { setNotice(null); setCopiedId(null); }, 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const collapse = useCallback(() => {
    if (native) postFloating("collapse");
    else setState((value) => ({ ...value, expanded: false }));
  }, [native]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") collapse();
      if (state.expanded && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault(); search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapse, state.expanded]);

  const run = async (action, success, entryId = null) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setCopiedId(entryId);
      setNotice({ message: success, error: false });
    } catch (error) { setNotice({ message: clipboardErrorMessage(error), error: true }); }
    finally { setBusy(false); }
  };
  const openDashboard = (page) => {
    if (native) postFloating(page);
    else window.open(page === "clipboard" ? "/clipboard" : "/dashboard", "_blank", "noopener");
  };

  if (!state.expanded) {
    return <BallButton native={native} onOpen={() => {
      if (native) postFloating("toggle");
      else setState((value) => ({ ...value, expanded: true }));
    }} />;
  }

  const hasStats = state.todayTokens !== null;
  const hasItems = Boolean(snapshot?.items.length);
  const hasMore = snapshot && snapshot.items.length < snapshot.matched;
  return (
    <section className="floating-panel" role="dialog" aria-label={copy("floating.title")}
      onPaste={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        void run(() => client.paste(event.clipboardData), copy("clipboard.saved"));
      }}>
      <header className="floating-header" onPointerDown={(event) => {
        if (native && event.button === 0 && !event.target.closest("button")) postFloating("drag");
      }}>
        <span className="floating-brand"><FloatingBall active={false} /></span>
        <div className="floating-heading"><h1>{copy("floating.title")}</h1><span>{copy("floating.subtitle")}</span></div>
        <button type="button" className="floating-icon-button" aria-label={copy("floating.open_dashboard")}
          title={copy("floating.open_dashboard")} onClick={() => openDashboard("dashboard")}><ArrowUpRight size={17} /></button>
        {native && <button type="button" className="floating-icon-button" aria-label={copy("floating.hide")}
          title={copy("floating.hide_hint")} onClick={() => postFloating("hide")}><EyeOff size={16} /></button>}
        <button type="button" className="floating-icon-button" aria-label={copy("floating.collapse")}
          title={copy("floating.collapse")} onClick={collapse}><Minimize2 size={17} /></button>
      </header>

      <div className="floating-usage">
        <div className="floating-usage-heading"><span>{localDate(state.date)}</span>
          <button type="button" className="floating-icon-button" disabled={!native}
            aria-label={copy("floating.refresh_usage")} title={copy("floating.refresh_usage")}
            onClick={() => postFloating("refresh")}><RefreshCw size={13} /></button>
        </div>
        <div className="floating-metrics">
          <div><span className="floating-metric-label">{copy("floating.today_tokens")}</span>
            <strong title={state.exactTokens || undefined}>{state.todayTokens ?? copy("floating.unavailable_value")}</strong></div>
          <div><span className="floating-metric-label">{copy("floating.today_cost")}</span>
            <strong>{state.todayCost ?? copy("floating.unavailable_value")}</strong></div>
        </div>
        <div className="floating-usage-caption"><span className={`floating-dot ${hasStats ? "is-active" : ""}`} />
          {hasStats ? copy("floating.usage_updated", { time: recordTime(state.updatedAt) }) : copy("floating.waiting_usage")}
        </div>
      </div>

      <div className="floating-clipboard-heading"><Clipboard size={15} /><h2>{copy("nav.clipboard")}</h2>
        <span className="floating-count">{snapshot?.total ?? 0}</span>
        <span className="floating-copy-hint">{copy("floating.click_to_copy")}</span>
        <button type="button" className="floating-icon-button" disabled={busy} aria-label={copy("clipboard.capture")}
          title={copy("clipboard.capture")} onClick={() => void run(() => client.capture(), copy("clipboard.saved"))}><Plus size={17} /></button>
      </div>
      <label className="floating-search"><Search size={15} />
        <input ref={search} value={query} placeholder={copy("clipboard.search")} aria-label={copy("clipboard.search")}
          onChange={(event) => { setQuery(event.target.value); setLimit(30); }} />
      </label>
      <div className="floating-filters" role="group" aria-label={copy("clipboard.filter")}>
        {TYPES.map((type) => <button key={type} type="button" aria-pressed={kind === type}
          className={kind === type ? "is-selected" : ""}
          onClick={() => { setKind(type); setLimit(30); }}>{copy(`clipboard.type.${type}`)}</button>)}
      </div>

      {loadError && <div className="floating-error" role="alert"><span>{loadError}</span>
        <button type="button" onClick={() => setRevision((value) => value + 1)}>{copy("clipboard.retry")}</button></div>}
      <div className="floating-records" aria-busy={loading}>
        {loading && !hasItems && <div className="floating-empty" role="status"><LoaderCircle className="floating-spin" size={23} /><p>{copy("clipboard.loading")}</p></div>}
        {!loading && !hasItems && !loadError && <div className="floating-empty"><Clipboard size={29} strokeWidth={1.3} />
          <strong>{query || kind !== "all" ? copy("clipboard.no_results") : copy("clipboard.empty_title")}</strong>
          <p>{query || kind !== "all" ? copy("clipboard.no_results_hint") : copy("floating.empty_hint")}</p>
        </div>}
        {snapshot?.items.map((entry) => <RecordButton key={entry.id} entry={entry} busy={busy}
          copied={copiedId === entry.id} onCopy={(item) => void run(() => client.copy(item.id), copy("clipboard.copied"), item.id)} />)}
        {hasItems && hasMore && <button type="button" className="floating-load-more"
          disabled={loading} onClick={() => setLimit((value) => value + 30)}>{copy("clipboard.load_more")}<ChevronDown size={13} /></button>}
      </div>
      {notice && <div className={`floating-notice ${notice.error ? "is-error" : ""}`} role={notice.error ? "alert" : "status"}>
        {!notice.error && <Check size={14} />}<span>{notice.message}</span></div>}
      <footer className="floating-footer"><span><span className={`floating-dot ${snapshot?.enabled ? "is-active" : ""}`} />
        {snapshot?.enabled ? copy("clipboard.recording") : copy("clipboard.local")}</span>
        <button type="button" onClick={() => openDashboard("clipboard")}>{copy("floating.all_records")}<ArrowUpRight size={13} /></button>
      </footer>
    </section>
  );
}
