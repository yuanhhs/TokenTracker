import { buildIslandLimitSummaries } from "./island-limit-summaries.js";

export const ISLAND_NONE_METRIC = "none";
export const DEFAULT_ISLAND_METRICS = Object.freeze(["todayTokens", "todayCost"]);
export const ISLAND_LIMIT_DISPLAY_MODES = Object.freeze({
  USED: "used",
  REMAINING: "remaining",
});

const SUMMARY_METRICS = Object.freeze([
  { id: ISLAND_NONE_METRIC, labelKey: "settings.island.metric.none", shortKey: "settings.island.metric.none_short", category: "none" },
  { id: "todayTokens", labelKey: "settings.island.metric.today_tokens", shortKey: "settings.island.metric.tokens_short", category: "tokens" },
  { id: "todayCost", labelKey: "settings.island.metric.today_cost", shortKey: "settings.island.metric.cost_short", category: "cost" },
  { id: "last7dTokens", labelKey: "settings.island.metric.last_7d_tokens", shortKey: "settings.island.metric.seven_days_short", category: "tokens" },
  { id: "last7dCost", labelKey: "settings.island.metric.last_7d_cost", shortKey: "settings.island.metric.seven_day_cost_short", category: "cost" },
  { id: "last30dTokens", labelKey: "settings.island.metric.last_30d_tokens", shortKey: "settings.island.metric.thirty_days_short", category: "tokens" },
  { id: "last30dCost", labelKey: "settings.island.metric.last_30d_cost", shortKey: "settings.island.metric.thirty_day_cost_short", category: "cost" },
  { id: "totalTokens", labelKey: "settings.island.metric.total_tokens", shortKey: "settings.island.metric.total_short", category: "tokens" },
  { id: "totalCost", labelKey: "settings.island.metric.total_cost", shortKey: "settings.island.metric.total_cost_short", category: "cost" },
]);

// Stable provider-window metadata lets the settings page preserve a user's
// selected slot while the limits request is still loading (or a provider is
// temporarily unavailable). Once a healthy payload arrives, the concrete
// window rows below replace these placeholders automatically.
const LIMIT_METRIC_DEFINITIONS = Object.freeze([
  ["claude5h", "claude", "5h", "limits.label.claude_5h", "5h"],
  ["claude7d", "claude", "7d", "limits.label.claude_7d", "7d"],
  ["claudeOpus", "claude", "Opus", "limits.label.claude_opus", "Opus"],
  ["codex5h", "codex", "5h", "limits.label.codex_5h", "5h"],
  ["codex7d", "codex", "7d", "limits.label.codex_7d", "7d"],
  ["codexCredits", "codex", "Credits", "limits.label.codex_credits", "Credits"],
  ["codexSpark5h", "codex", "Spark 5h", "limits.label.codex_spark_5h", "S 5h"],
  ["codexSpark7d", "codex", "Spark 7d", "limits.label.codex_spark_7d", "S 7d"],
  ["cursorPlan", "cursor", "Plan", "limits.label.cursor_plan", "Plan"],
  ["cursorAuto", "cursor", "Auto", "limits.label.cursor_auto", "Auto"],
  ["cursorAPI", "cursor", "API", "limits.label.cursor_api", "API"],
  ["cursorGrok", "cursor", "Grok", "limits.label.cursor_grok_bot", "Grok"],
  ["geminiPro", "gemini", "Pro", "limits.label.gemini_pro", "Pro"],
  ["geminiFlash", "gemini", "Flash", "limits.label.gemini_flash", "Flash"],
  ["geminiLite", "gemini", "Lite", "limits.label.gemini_lite", "Lite"],
  ["kimiWeekly", "kimi", "Weekly", "limits.label.kimi_weekly", "Week"],
  ["kimi5h", "kimi", "5h", "limits.label.kimi_5h", "5h"],
  ["kimiTotal", "kimi", "Total", "limits.label.kimi_total", "Total"],
  ["kiroMonth", "kiro", "Month", "limits.label.kiro_month", "Month"],
  ["kiroBonus", "kiro", "Bonus", "limits.label.kiro_bonus", "Bonus"],
  ["grokMonth", "grok", "Month", "limits.label.grok_month", "Month"],
  ["grokOndemand", "grok", "On-demand", "limits.label.grok_ondemand", "OD"],
  ["copilotPremium", "copilot", "Premium", "limits.label.copilot_premium", "Premium"],
  ["copilotChat", "copilot", "Chat", "limits.label.copilot_chat", "Chat"],
  ["antigravityClaudeWeekly", "antigravity", "Claude weekly", "limits.label.antigravity_claude_weekly", "Cl 7d"],
  ["antigravityClaude5h", "antigravity", "Claude 5h", "limits.label.antigravity_claude_5h", "Cl 5h"],
  ["antigravityGeminiWeekly", "antigravity", "Gemini weekly", "limits.label.antigravity_gemini_weekly", "Gm 7d"],
  ["antigravityGemini5h", "antigravity", "Gemini 5h", "limits.label.antigravity_gemini_5h", "Gm 5h"],
  ["zcode5h", "zcode", "5h", "limits.label.zcode_5h", "5h"],
  ["zcodeWeekly", "zcode", "Weekly", "limits.label.zcode_weekly", "Week"],
  ["zcodeTools", "zcode", "Tools", "limits.label.zcode_tools", "Tools"],
  ["zcodeGlm52", "zcode", "GLM-5.2", "limits.label.zcode_glm52", "GLM 5.2"],
  ["zcodeGlm5Turbo", "zcode", "GLM-5 Turbo", "limits.label.zcode_glm5t", "GLM 5T"],
]);

export function normalizeIslandMetrics(value, availableIds = null) {
  const allowed = availableIds ? new Set(availableIds) : null;
  const source = Array.isArray(value) ? value : DEFAULT_ISLAND_METRICS;
  const output = [];
  for (const raw of source) {
    const id = typeof raw === "string" ? raw : "";
    if (!id || (allowed && id !== ISLAND_NONE_METRIC && !allowed.has(id))) continue;
    if (id !== ISLAND_NONE_METRIC && output.includes(id)) continue;
    output.push(id);
    if (output.length === 2) break;
  }
  for (const fallback of DEFAULT_ISLAND_METRICS) {
    if (output.length >= 2) break;
    if ((!allowed || allowed.has(fallback)) && !output.includes(fallback)) output.push(fallback);
  }
  while (output.length < 2) output.push(ISLAND_NONE_METRIC);
  return output;
}

export function buildIslandMetricOptions(limits, hiddenProviders = [], selectedIds = []) {
  const hidden = new Set(hiddenProviders);
  const limitOptions = buildIslandLimitSummaries(limits)
    .filter((row) => !hidden.has(row.providerId))
    .map((row) => ({
      id: row.id,
      category: "limits",
      providerId: row.providerId,
      provider: row.provider,
      labelKey: row.labelKey,
      label: row.window,
      shortLabel: row.shortLabel || row.window,
      usedPercent: row.usedPercent,
    }));
  const optionIds = new Set(limitOptions.map((metric) => metric.id));
  const placeholders = [];
  for (const rawId of selectedIds) {
    const id = typeof rawId === "string" ? rawId : "";
    if (!id || optionIds.has(id) || SUMMARY_METRICS.some((metric) => metric.id === id)) continue;
    const definition = LIMIT_METRIC_DEFINITIONS.find(([candidate]) => candidate === id);
    const scoped = id.startsWith("claudeScoped:")
      ? [id, "claude", id.slice("claudeScoped:".length) || "Weekly", null, id.slice("claudeScoped:".length) || "Weekly"]
      : definition;
    if (!scoped) continue;
    const [, providerId, label, labelKey, shortLabel] = scoped;
    if (hidden.has(providerId)) continue;
    const provider = limits?.[providerId];
    if (provider?.configured === true && provider?.error == null) continue;
    placeholders.push({
      id,
      category: "limits",
      providerId,
      provider: providerId,
      labelKey,
      label,
      shortLabel,
      usedPercent: null,
    });
    optionIds.add(id);
  }
  return [...SUMMARY_METRICS, ...limitOptions, ...placeholders];
}

export function resolveIslandMetric(id, { stats, currency, limits, displayMode = "used" }) {
  const metric = SUMMARY_METRICS.find((item) => item.id === id);
  if (metric) {
    switch (id) {
      case ISLAND_NONE_METRIC: return { ...metric, value: "" };
      case "todayTokens": return { ...metric, value: formatTokens(stats.todayTokens) };
      case "todayCost": return { ...metric, value: formatMoney(currency, stats.todayCostUsd) };
      case "last7dTokens": return { ...metric, value: formatTokens(stats.last7dTokens) };
      case "last7dCost": return { ...metric, value: formatMoney(currency, stats.last7dCostUsd) };
      case "last30dTokens": return { ...metric, value: formatTokens(stats.last30dTokens) };
      case "last30dCost": return { ...metric, value: formatMoney(currency, stats.last30dCostUsd) };
      case "totalTokens": return { ...metric, value: formatTokens(stats.totalTokens) };
      case "totalCost": return { ...metric, value: formatMoney(currency, stats.totalCostUsd) };
      default: return { ...metric, value: "" };
    }
  }

  const row = buildIslandLimitSummaries(limits).find((item) => item.id === id);
  if (!row) return resolveIslandMetric("todayTokens", { stats, currency, limits, displayMode });
  const usedPercent = Math.min(100, Math.max(0, Number(row.usedPercent) || 0));
  const shownPercent = displayMode === ISLAND_LIMIT_DISPLAY_MODES.REMAINING
    ? 100 - usedPercent
    : usedPercent;
  return {
    id: row.id,
    category: "limits",
    providerId: row.providerId,
    provider: row.provider,
    label: row.shortLabel || row.window,
    value: `${Math.round(shownPercent)}%`,
    usedPercent,
    ringPercent: displayMode === ISLAND_LIMIT_DISPLAY_MODES.REMAINING ? 100 - usedPercent : usedPercent,
  };
}

export function resolveCompactRingMetric(primaryId, secondaryId, limits) {
  // An explicit empty primary slot means the user opted out of the ring;
  // do not silently replace it with an automatic provider quota.
  if (primaryId === ISLAND_NONE_METRIC) return null;
  const rows = buildIslandLimitSummaries(limits);
  const primary = rows.find((row) => row.id === primaryId);
  if (primary) return primary.id;
  return rows.find((row) => row.id !== secondaryId)?.id || null;
}

export function islandMetricCopyAnchors(copy) {
  return SUMMARY_METRICS.flatMap((metric) => [copy(metric.labelKey), copy(metric.shortKey)]);
}

function formatTokens(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.round(count));
}

function formatMoney(currency, usd) {
  const rate = Number(currency?.rate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return `${currency?.symbol || "$"}${(Math.max(0, Number(usd) || 0) * safeRate).toFixed(2)}`;
}
