import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildIslandLimitSummaries, islandLimitTone } from "./lib/island-limit-summaries.js";
import {
  DEFAULT_ISLAND_METRICS,
  normalizeIslandMetrics,
  resolveCompactRingMetric,
  resolveIslandMetric,
} from "./lib/island-metrics.js";

const LABELS = {
  en: {
    today: "Today", sevenDays: "7 days", thirtyDays: "30 days", dailyAverage: "Daily average",
    activeDays: "active days", conversations: "conversations", limits: "Provider limits", overview: "Usage overview", total: "Total",
    tokens: "Tokens", cost: "Cost", sevenDayCost: "7d $", thirtyDaysShort: "30d", totalCost: "All $",
    noLimits: "No configured provider limits are available yet", openDashboard: "Open dashboard", settings: "Island menu",
    hide: "Hide Dynamic Island", collapse: "Collapse", offline: "Local service offline",
  },
  "zh-CN": {
    today: "今日", sevenDays: "近 7 天", thirtyDays: "近 30 天", dailyAverage: "日均 Token",
    activeDays: "活跃天数", conversations: "次会话", limits: "Provider 额度", overview: "用量概览", total: "累计",
    tokens: "Token", cost: "花费", sevenDayCost: "7 天花费", thirtyDaysShort: "30 天", totalCost: "累计花费",
    noLimits: "暂未读取到已配置的 Provider 额度", openDashboard: "打开仪表盘", settings: "灵动岛菜单",
    hide: "隐藏灵动岛", collapse: "收起", offline: "本地服务未连接",
  },
  "zh-TW": {
    today: "今日", sevenDays: "近 7 天", thirtyDays: "近 30 天", dailyAverage: "日均 Token",
    activeDays: "活躍天數", conversations: "次會話", limits: "Provider 額度", overview: "用量概覽", total: "累計",
    tokens: "Token", cost: "花費", sevenDayCost: "7 天花費", thirtyDaysShort: "30 天", totalCost: "累計花費",
    noLimits: "暫未讀取到已設定的 Provider 額度", openDashboard: "開啟儀表盤", settings: "靈動島選單",
    hide: "隱藏靈動島", collapse: "收起", offline: "本地服務未連線",
  },
  ja: {
    today: "今日", sevenDays: "過去 7 日", thirtyDays: "過去 30 日", dailyAverage: "1 日平均",
    activeDays: "アクティブ日", conversations: "会話", limits: "プロバイダー上限", overview: "使用状況の概要", total: "合計",
    tokens: "トークン", cost: "コスト", sevenDayCost: "7日コスト", thirtyDaysShort: "30日", totalCost: "総コスト",
    noLimits: "設定済みプロバイダーの上限はまだありません", openDashboard: "ダッシュボードを開く", settings: "アイランドメニュー",
    hide: "ダイナミックアイランドを隠す", collapse: "折りたたむ", offline: "ローカルサービスはオフラインです",
  },
  ko: {
    today: "오늘", sevenDays: "최근 7일", thirtyDays: "최근 30일", dailyAverage: "일일 평균",
    activeDays: "활동일", conversations: "대화", limits: "공급자 한도", overview: "사용량 개요", total: "전체",
    tokens: "토큰", cost: "비용", sevenDayCost: "7일 비용", thirtyDaysShort: "30일", totalCost: "전체 비용",
    noLimits: "설정된 공급자 한도가 아직 없습니다", openDashboard: "대시보드 열기", settings: "아일랜드 메뉴",
    hide: "다이나믹 아일랜드 숨기기", collapse: "접기", offline: "로컬 서비스 오프라인",
  },
};

function post(message) {
  try { window.chrome?.webview?.postMessage(message); } catch { /* browser preview */ }
}

function normalizeLocale(value) {
  const locale = String(value || "en").toLowerCase();
  if (locale.startsWith("zh-tw") || locale.startsWith("zh-hk")) return "zh-TW";
  if (locale.startsWith("zh")) return "zh-CN";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("ko")) return "ko";
  return "en";
}

function formatTokens(value) {
  const count = Math.max(0, Number(value) || 0);
  if (1_000_000_000 <= count) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (1_000_000 <= count) return `${(count / 1_000_000).toFixed(1)}M`;
  if (1_000 <= count) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.round(count));
}

function readContext() {
  const stats = window.__ttIslandStats || {};
  const currency = window.__ttIslandCurrency || {};
  const rate = Number(currency.rate);
  return {
    expanded: Boolean(window.__ttIslandExpanded),
    connected: window.__ttIslandConnected !== false,
    locale: normalizeLocale(window.__ttIslandLocale),
    currency: { symbol: currency.symbol || "$", rate: Number.isFinite(rate) && rate !== 0 && rate === Math.abs(rate) ? rate : 1 },
    stats: {
      todayTokens: Number(stats.todayTokens) || 0,
      todayCostUsd: Number(stats.todayCostUsd) || 0,
      todayConversations: Number(stats.todayConversations) || 0,
      last7dTokens: Number(stats.last7dTokens) || 0,
      last7dCostUsd: Number(stats.last7dCostUsd) || 0,
      last7dActiveDays: Number(stats.last7dActiveDays) || 0,
      last30dTokens: Number(stats.last30dTokens) || 0,
      last30dCostUsd: Number(stats.last30dCostUsd) || 0,
      last30dAvgPerDay: Number(stats.last30dAvgPerDay) || 0,
      totalTokens: Number(stats.totalTokens) || 0,
      totalCostUsd: Number(stats.totalCostUsd) || 0,
    },
    limits: window.__ttIslandLimits || null,
    showLimits: window.__ttIslandShowLimits !== false,
    compactMode: Boolean(window.__ttIslandCompactMode),
    limitDisplayMode: window.__ttIslandLimitDisplayMode === "remaining" ? "remaining" : "used",
    metrics: normalizeIslandMetrics(window.__ttIslandMetrics || DEFAULT_ISLAND_METRICS),
  };
}

function money(currency, usd) {
  return `${currency.symbol}${(Math.max(0, usd) * currency.rate).toFixed(2)}`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="island-stat">
      <div className="island-stat-label">{label}</div>
      <div className="island-stat-value">{value}</div>
      <div className="island-stat-sub">{sub}</div>
    </div>
  );
}

function metricCaption(metric, labels) {
  if (metric.category === "limits") return metric.label;
  switch (metric.id) {
    case "todayTokens": return labels.tokens;
    case "todayCost": return labels.cost;
    case "last7dTokens": return labels.sevenDays;
    case "last7dCost": return labels.sevenDayCost;
    case "last30dTokens": return labels.thirtyDaysShort;
    case "last30dCost": return `${labels.thirtyDaysShort} ${labels.cost}`;
    case "totalTokens": return labels.total;
    case "totalCost": return labels.totalCost;
    default: return "";
  }
}

function MetricWing({ metric, labels, right = false }) {
  if (!metric || metric.id === "none") return <div className={`island-wing ${right ? "right" : ""}`} />;
  return (
    <div className={`island-wing ${right ? "right" : ""}`}>
      <div className={right ? "island-wing-copy right" : "island-wing-copy"}>
        <div className="island-value">{metric.value}</div>
        <div className="island-caption">{metricCaption(metric, labels)}</div>
      </div>
    </div>
  );
}

function CompactRing({ metric }) {
  const progress = Math.min(100, Math.max(0, Number(metric?.ringPercent) || 0));
  const usedPercent = Number(metric?.usedPercent) || 0;
  // Match the macOS compact policy: color communicates raw utilization even
  // when the ring is configured to show remaining quota.
  const tone = compactTone(usedPercent);
  return (
    <div
      className={`island-ring ${tone}`}
      style={{ "--island-ring-progress": `${progress * 3.6}deg` }}
      title={metric ? `${metric.provider} ${metric.label}: ${metric.value}` : undefined}
    >
      <span>{metric?.provider?.slice(0, 1) || "T"}</span>
    </div>
  );
}

function compactTone(percent) {
  if (!(50 <= percent)) return "normal";
  if (!(80 <= percent)) return "warning";
  return "danger";
}

function Island() {
  const [context, setContext] = useState(readContext);

  useEffect(() => {
    const update = () => setContext(readContext());
    window.addEventListener("island:context", update);
    window.addEventListener("island:expanded", update);
    return () => {
      window.removeEventListener("island:context", update);
      window.removeEventListener("island:expanded", update);
    };
  }, []);

  const {
    compactMode, connected, currency, expanded, limitDisplayMode,
    limits, locale, metrics, showLimits, stats,
  } = context;
  const labels = LABELS[locale] || LABELS.en;
  const limitRows = useMemo(
    () => showLimits ? buildIslandLimitSummaries(limits) : [],
    [limits, showLimits],
  );
  const [primaryId, secondaryId] = normalizeIslandMetrics(metrics);
  const primaryMetric = resolveIslandMetric(primaryId, { stats, currency, limits, displayMode: limitDisplayMode });
  const secondaryMetric = resolveIslandMetric(secondaryId, { stats, currency, limits, displayMode: limitDisplayMode });
  const ringMetricId = compactMode ? resolveCompactRingMetric(primaryId, secondaryId, limits) : null;
  const ringMetric = ringMetricId
    ? resolveIslandMetric(ringMetricId, { stats, currency, limits, displayMode: limitDisplayMode })
    : null;

  const onMouseDown = (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    post("island:drag");
  };

  return (
    <div className="island-stage">
      <section
        className={`island-shell ${expanded ? `expanded ${showLimits ? "" : "without-limits"}` : "compact"}`}
        onMouseDown={onMouseDown}
        onDoubleClick={(event) => { if (!event.target.closest("button")) post("island:dashboard"); }}
        onContextMenu={(event) => { event.preventDefault(); post("island:menu"); }}
        aria-label={connected ? undefined : labels.offline}
      >
        <header className="island-header">
          {compactMode ? <div className="island-wing"><CompactRing metric={ringMetric} /></div> : <MetricWing metric={primaryMetric} labels={labels} />}
          <div className="island-center"><span className={`island-dot ${connected ? "" : "offline"}`} /><span className="island-mark" /></div>
          <MetricWing metric={secondaryMetric} labels={labels} right />
        </header>

        {expanded ? (
          <div className="island-content">
            <div className="island-toolbar">
              <span className="island-title">{connected ? (showLimits ? labels.limits : labels.overview) : labels.offline}</span>
              <div className="island-actions">
                <button className="island-button" type="button" title={labels.openDashboard} aria-label={labels.openDashboard} onClick={() => post("island:dashboard")}>{"↗"}</button>
                <button className="island-button" type="button" title={labels.settings} aria-label={labels.settings} onClick={() => post("island:menu")}>{"⚙"}</button>
                <button className="island-button" type="button" title={labels.collapse} aria-label={labels.collapse} onClick={() => post("island:collapse")}>{"−"}</button>
                <button className="island-button" type="button" title={labels.hide} aria-label={labels.hide} onClick={() => post("island:hide")}>{"×"}</button>
              </div>
            </div>

            <div className="island-stats">
              <StatCard label={labels.today} value={formatTokens(stats.todayTokens)} sub={`${money(currency, stats.todayCostUsd)} · ${stats.todayConversations} ${labels.conversations}`} />
              <StatCard label={labels.sevenDays} value={formatTokens(stats.last7dTokens)} sub={`${money(currency, stats.last7dCostUsd)} · ${stats.last7dActiveDays} ${labels.activeDays}`} />
              <StatCard label={labels.thirtyDays} value={formatTokens(stats.last30dTokens)} sub={money(currency, stats.last30dCostUsd)} />
              <StatCard label={labels.total} value={formatTokens(stats.totalTokens)} sub={money(currency, stats.totalCostUsd)} />
            </div>

            {showLimits ? (
              <>
                <div className="island-section-title"><span>{labels.limits}</span></div>
                {limitRows.length ? (
                  <div className="island-limits">
                    {limitRows.map((row) => {
                      const value = Math.round(
                        limitDisplayMode === "remaining" ? 100 - row.usedPercent : row.usedPercent,
                      );
                      const tone = islandLimitTone(row.usedPercent);
                      return (
                        <div className="island-limit" key={row.id}>
                          <div className="island-limit-name" title={`${row.provider} ${row.window}`}>{`${row.provider} ${row.window}`}</div>
                          <div className="island-track"><div className={`island-fill ${tone}`} style={{ width: `${value}%` }} /></div>
                          <div className="island-limit-value">{`${value}%`}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="island-empty">{labels.noLimits}</div>}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

createRoot(document.getElementById("island-root")).render(<React.StrictMode><Island /></React.StrictMode>);
