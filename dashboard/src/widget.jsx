import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getUsageDaily,
  getUsageHeatmap,
  getUsageLimits,
  getUsageModelBreakdown,
  getUsageSummary,
} from "./lib/api";
import { buildIslandLimitSummaries, islandLimitTone } from "./lib/island-limit-summaries.js";
import { buildTopModels } from "./lib/model-breakdown";
import { copy, setCopyLocale } from "./lib/copy";

const PARAMETERS = new URLSearchParams(window.location.search);
const MODEL_COLORS = ["#5A8CF2", "#9973E6", "#4DB8A6", "#E68C59", "#50A7D9", "#DF6EA8"];
const SOURCE_COLORS = {
  claude: "#c77dff",
  codex: "#34c759",
  cursor: "#ffcc00",
  gemini: "#0a84ff",
  kimi: "#f97316",
  kiro: "#22c55e",
  grok: "#a3a3a3",
  copilot: "#8b5cf6",
  antigravity: "#06b6d4",
  zcode: "#ec4899",
};

function post(message) {
  try { window.chrome?.webview?.postMessage(message); } catch { /* browser preview */ }
}

function readContext() {
  const native = window.__ttWidgetContext || {};
  const currency = native.currency || {};
  const rate = Number(currency.rate);
  return {
    kind: native.kind || PARAMETERS.get("type") || "summary",
    size: native.size || PARAMETERS.get("size") || "medium",
    locale: native.locale || "en",
    theme: native.theme === "light" ? "light" : "dark",
    connected: native.connected !== false,
    currency: {
      symbol: currency.symbol || "$",
      rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    },
  };
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(day, amount) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(year, month - 1, date + amount);
  return localDayKey(value);
}

function timeZoneOptions() {
  let timeZone = "UTC";
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { /* use UTC */ }
  return { timeZone, tzOffsetMinutes: -new Date().getTimezoneOffset() };
}

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function displayTokens(totals) {
  const billable = numberValue(totals?.billable_total_tokens);
  const total = numberValue(totals?.total_tokens);
  const value = numberValue(totals?.value);
  return billable > 0 ? billable : total > 0 ? total : value;
}

function formatTokens(value) {
  const count = Math.max(0, numberValue(value));
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.round(count));
}

function money(currency, usd) {
  const value = numberValue(usd) * currency.rate;
  return `${currency.symbol}${value.toFixed(2)}`;
}

function deltaPercent(today, yesterday) {
  if (yesterday <= 0) return today > 0 ? 100 : 0;
  return ((today - yesterday) / yesterday) * 100;
}

function deltaLabel(value) {
  const rounded = Math.round(Math.abs(numberValue(value)));
  if (value > 0) return `▲${rounded}%`;
  if (value < 0) return `▼${rounded}%`;
  return "±0%";
}

function useWidgetData(kind, size, connected) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!connected) return;
    const id = ++requestId.current;
    setState((previous) => ({ ...previous, loading: previous.data == null, error: null }));
    const to = localDayKey();
    const from = addDays(to, -29);
    const zone = timeZoneOptions();
    try {
      let data;
      if (kind === "heatmap") {
        const weeks = size === "extraLarge" ? 52 : size === "large" ? 40 : 26;
        data = await getUsageHeatmap({ weeks, to, weekStartsOn: "sun", ...zone });
      } else if (kind === "limits") {
        data = await getUsageLimits();
      } else if (kind === "topModels") {
        data = await getUsageModelBreakdown({ from, to, ...zone });
      } else {
        const [summary, daily, models] = await Promise.all([
          getUsageSummary({ from: to, to, rolling: true, ...zone }),
          getUsageDaily({ from, to, ...zone }),
          getUsageModelBreakdown({ from, to, ...zone }),
        ]);
        data = { summary, daily: Array.isArray(daily?.data) ? daily.data : [], models };
      }
      if (id !== requestId.current) return;
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (id !== requestId.current) return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error?.message || String(error),
      }));
    }
  }, [connected, kind, size]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    const onRefresh = () => void refresh();
    window.addEventListener("widget:refresh", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("widget:refresh", onRefresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}

function Toolbar({ onRefresh }) {
  return (
    <div className="widget-toolbar">
      <button className="widget-tool" type="button" title={copy("widgets.window.refresh")} aria-label={copy("widgets.window.refresh")} onClick={onRefresh}>↻</button>
      <button className="widget-tool" type="button" title={copy("widgets.window.dashboard")} aria-label={copy("widgets.window.dashboard")} onClick={() => post("widget:dashboard")}>↗</button>
      <button className="widget-tool" type="button" title={copy("widgets.window.settings")} aria-label={copy("widgets.window.settings")} onClick={() => post("widget:settings")}>⚙</button>
      <button className="widget-tool close" type="button" title={copy("widgets.window.hide")} aria-label={copy("widgets.window.hide")} onClick={() => post("widget:close")}>×</button>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="hero">{value}</div>
      <div className="detail">{detail}</div>
    </div>
  );
}

function Sparkline({ values }) {
  const points = values.length ? values : [0, 0];
  const max = Math.max(1, ...points);
  const coordinates = points.map((value, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 300;
    const y = 42 - (numberValue(value) / max) * 34;
    return [x, y];
  });
  const line = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L300,45 L0,45 Z`;
  return (
    <svg className="sparkline" viewBox="0 0 300 45" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="widget-spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" stopOpacity=".28" />
          <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#widget-spark-gradient)" />
      <path d={line} fill="none" stroke="#0A84FF" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryWidget({ payload, size, currency }) {
  const response = payload?.summary || {};
  const daily = Array.isArray(payload?.daily) ? payload.daily : [];
  const todayTokens = displayTokens(response.totals);
  const rolling7 = response.rolling?.last_7d?.totals || {};
  const rolling30 = response.rolling?.last_30d?.totals || {};
  const today = localDayKey();
  const yesterday = addDays(today, -1);
  const yesterdayTokens = displayTokens(daily.find((row) => row?.day === yesterday));
  const delta = deltaPercent(todayTokens, yesterdayTokens);
  const trend = daily.map((row) => displayTokens(row));
  const models = buildTopModels(payload?.models, { limit: 3, copyFn: () => "—" });

  if (size === "small") {
    return (
      <div className="summary-small">
        <div className="eyebrow">{copy("widgets.preview.today")}</div>
        <div className="hero">{todayTokens > 0 ? formatTokens(todayTokens) : "—"}</div>
        <div className={delta > 0 ? "detail positive" : delta < 0 ? "detail negative" : "detail"}>{deltaLabel(delta)}</div>
        <div className="comparison-label">{copy("widgets.preview.vs_yesterday")}</div>
      </div>
    );
  }

  if (size === "medium") {
    return (
      <div className="summary-medium">
        <div className="summary-metrics">
          <Metric label={copy("widgets.preview.today")} value={formatTokens(todayTokens)} detail={`${money(currency, response.totals?.total_cost_usd)} · ${deltaLabel(delta)}`} />
          <Metric label={copy("widgets.preview.seven_days")} value={formatTokens(displayTokens(rolling7))} detail={money(currency, rolling7.total_cost_usd)} />
        </div>
        <Sparkline values={trend.slice(-14)} />
      </div>
    );
  }

  return (
    <div className="summary-large">
      <div className="summary-metrics">
        <Metric label={copy("widgets.preview.today")} value={formatTokens(todayTokens)} detail={`${money(currency, response.totals?.total_cost_usd)} · ${deltaLabel(delta)}`} />
        <Metric label={copy("widgets.preview.seven_days")} value={formatTokens(displayTokens(rolling7))} detail={money(currency, rolling7.total_cost_usd)} />
        <Metric label={copy("widgets.preview.thirty_days")} value={formatTokens(displayTokens(rolling30))} detail={money(currency, rolling30.total_cost_usd)} />
      </div>
      <BarChart values={trend.slice(-30)} />
      <div className="inline-models">
        {models.map((model, index) => (
          <div className="model-inline" key={model.id}>
            <span className="dot" style={{ background: MODEL_COLORS[index] }} />
            <span className="model-name">{model.name}</span>
            <span className="model-value">{formatTokens(model.tokens)}</span>
            <span className="model-percent">{Math.round(numberValue(model.percent))}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ values }) {
  const points = values.length ? values : [0];
  const max = Math.max(1, ...points);
  return (
    <div className="bar-chart" aria-hidden="true">
      {points.map((value, index) => (
        <span className="bar" key={index} style={{ height: `${Math.max(3, (numberValue(value) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function HeatmapWidget({ payload }) {
  const weeks = Array.isArray(payload?.weeks) ? payload.weeks : [];
  const activeDays = Number.isFinite(Number(payload?.active_days))
    ? Number(payload.active_days)
    : weeks.flat().filter((cell) => numberValue(cell?.level) > 0).length;
  const streakDays = numberValue(payload?.streak_days);
  const total = weeks.flat().reduce((sum, cell) => sum + displayTokens(cell), 0);
  return (
    <div className="heatmap-layout">
      <div className="heatmap-grid">
        {weeks.map((week, weekIndex) => (
          <div className="heatmap-week" key={weekIndex}>
            {(Array.isArray(week) ? week : []).map((cell, dayIndex) => (
              <span className={`heatmap-cell level-${Math.min(4, Math.max(0, numberValue(cell?.level)))}`} key={cell?.day || dayIndex} />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-footer">
        <span className="heatmap-total">{formatTokens(total)}</span>
        <span className="heatmap-summary">{copy("widgets.preview.heatmap_summary", { days: activeDays })}</span>
        {streakDays > 0 ? <span className="heatmap-streak">{copy("widgets.preview.streak", { days: streakDays })}</span> : null}
      </div>
    </div>
  );
}

function TopModelsWidget({ payload, size }) {
  const limit = size === "small" ? 3 : size === "large" ? 6 : 4;
  const models = buildTopModels(payload, { limit, copyFn: () => "—" });
  if (!models.length) return <div className="widget-state">{copy("widgets.preview.no_data")}</div>;
  return (
    <div className="ranked-list">
      {models.map((model, index) => {
        const percent = Math.min(100, Math.max(0, numberValue(model.percent)));
        const color = MODEL_COLORS[index % MODEL_COLORS.length];
        return (
          <div className="rank-row" key={model.id}>
            <div className="rank-head">
              <span className="dot" style={{ background: color }} />
              <span className="model-name">{model.name}</span>
              {size !== "small" ? <span className="model-value">{formatTokens(model.tokens)}</span> : null}
              <span className="model-percent">{Math.round(percent)}%</span>
            </div>
            <div className="rank-track"><div className="rank-fill" style={{ width: `${Math.max(percent, 1.5)}%`, background: color }} /></div>
          </div>
        );
      })}
    </div>
  );
}

const LIMIT_ORDER = [
  "claude5h", "claude7d", "claudeOpus",
  "codex5h", "codex7d", "codexCredits", "codexSpark5h", "codexSpark7d",
  "cursorPlan", "cursorAuto", "cursorAPI", "cursorGrok",
  "geminiPro", "geminiFlash", "geminiLite",
  "kimiWeekly", "kimi5h", "kimiTotal", "kiroMonth", "kiroBonus",
  "grokMonth", "grokOndemand", "copilotPremium", "copilotChat",
  "antigravityClaudeWeekly", "antigravityClaude5h", "antigravityGeminiWeekly", "antigravityGemini5h",
  "zcode5h", "zcodeWeekly", "zcodeTools", "zcodeGlm52", "zcodeGlm5Turbo",
];

function orderedLimitRows(payload, maxRows) {
  const rows = buildIslandLimitSummaries(payload);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.providerId)) groups.set(row.providerId, []);
    groups.get(row.providerId).push(row);
  }
  return Array.from(groups.values())
    .sort((left, right) => Math.max(...right.map((row) => row.usedPercent)) - Math.max(...left.map((row) => row.usedPercent)))
    .flatMap((group) => group.sort((left, right) => LIMIT_ORDER.indexOf(left.id) - LIMIT_ORDER.indexOf(right.id)))
    .slice(0, maxRows);
}

function formatReset(value) {
  if (value == null) return "";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60_000));
  if (minutes >= 24 * 60) return copy("widgets.preview.reset_days", { days: Math.ceil(minutes / (24 * 60)) });
  return copy("widgets.preview.reset_hours_minutes", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}

function LimitsWidget({ payload, size }) {
  const rows = orderedLimitRows(payload, size === "large" ? 8 : 4);
  if (!rows.length) return <div className="widget-state">{copy("widgets.preview.no_limits")}</div>;
  return (
    <div className="limit-list">
      {rows.map((row) => {
        const percent = Math.min(100, Math.max(0, numberValue(row.usedPercent)));
        return (
          <div className="limit-row" key={row.id}>
            <div className="limit-head">
              <span className="dot" style={{ background: SOURCE_COLORS[row.providerId] || "#8b8b91" }} />
              <span className="model-name">{row.provider} · {row.window}</span>
              <span className="limit-reset">{formatReset(row.resetAt)}</span>
              <span className="limit-value">{Math.round(percent)}%</span>
            </div>
            <div className="limit-track"><div className={`limit-fill ${islandLimitTone(percent)}`} style={{ width: `${Math.max(percent, 1.5)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function WidgetContent({ kind, size, payload, currency }) {
  switch (kind) {
    case "heatmap": return <HeatmapWidget payload={payload} />;
    case "topModels": return <TopModelsWidget payload={payload} size={size} />;
    case "limits": return <LimitsWidget payload={payload} size={size} />;
    default: return <SummaryWidget payload={payload} size={size} currency={currency} />;
  }
}

function DesktopWidget() {
  const [context, setContext] = useState(readContext);
  setCopyLocale(context.locale);
  useEffect(() => {
    const update = () => setContext(readContext());
    window.addEventListener("widget:context", update);
    return () => window.removeEventListener("widget:context", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = context.theme;
    document.documentElement.lang = context.locale;
  }, [context.locale, context.theme]);

  const { data, loading, error, refresh } = useWidgetData(context.kind, context.size, context.connected);
  const onMouseDown = (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    post("widget:drag");
  };

  let content;
  if (!context.connected) content = <div className="widget-state">{copy("widgets.preview.offline")}</div>;
  else if (loading && !data) content = <div className="widget-state"><span className="widget-loading" aria-label={copy("widgets.preview.loading")} /></div>;
  else if (error && !data) content = <div className="widget-state">{copy("widgets.preview.no_data")}</div>;
  else content = <WidgetContent kind={context.kind} size={context.size} payload={data} currency={context.currency} />;

  return (
    <div className="widget-stage">
      <section
        className={`widget-shell size-${context.size} kind-${context.kind}`}
        onMouseDown={onMouseDown}
        onDoubleClick={(event) => { if (!event.target.closest("button")) post("widget:dashboard"); }}
        onContextMenu={(event) => { event.preventDefault(); post("widget:settings"); }}
      >
        <Toolbar onRefresh={refresh} />
        <div className="widget-body">{content}</div>
      </section>
    </div>
  );
}

createRoot(document.getElementById("widget-root")).render(<DesktopWidget />);
