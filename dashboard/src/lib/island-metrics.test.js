import { describe, expect, it } from "vitest";
import {
  ISLAND_LIMIT_DISPLAY_MODES,
  ISLAND_NONE_METRIC,
  buildIslandMetricOptions,
  normalizeIslandMetrics,
  resolveCompactRingMetric,
  resolveIslandMetric,
} from "./island-metrics.js";

const limits = {
  claude: {
    configured: true,
    five_hour: { utilization: 42 },
    seven_day: { utilization: 61 },
  },
  grok: {
    configured: true,
    period_type: "weekly",
    primary_window: { used_percent: 73 },
    secondary_window: { used_percent: 12 },
  },
  qoder: {
    configured: true,
    primary_window: { used_percent: 99 },
  },
};

describe("Dynamic Island metric policy", () => {
  it("exposes summary metrics and every configured provider window", () => {
    const ids = buildIslandMetricOptions(limits).map((metric) => metric.id);
    expect(ids).toEqual(expect.arrayContaining([
      "todayTokens", "todayCost", "last7dTokens", "last30dCost", "totalTokens", "totalCost",
      "claude5h", "claude7d", "grokMonth", "grokOndemand",
    ]));
    expect(ids).not.toEqual(expect.arrayContaining(["qoderQuota", "opencodeGo5h"]));
  });

  it("filters hidden providers and keeps two distinct slots", () => {
    const ids = buildIslandMetricOptions(limits, ["claude"]).map((metric) => metric.id);
    expect(ids).not.toContain("claude5h");
    expect(normalizeIslandMetrics(["todayCost", "todayCost"], ids)).toEqual(["todayCost", "todayTokens"]);
    expect(normalizeIslandMetrics(["none", "none"], ids)).toEqual(["none", "none"]);
  });

  it("keeps a selected provider slot visible while limits are loading or unavailable", () => {
    expect(buildIslandMetricOptions(null, [], ["codex5h"]).map((metric) => metric.id)).toContain("codex5h");
    expect(buildIslandMetricOptions({ codex: { configured: false, error: "not configured" } }, [], ["codex5h"])
      .map((metric) => metric.id)).toContain("codex5h");
    expect(buildIslandMetricOptions(null, ["codex"], ["codex5h"]).map((metric) => metric.id)).not.toContain("codex5h");
  });

  it("renders used and remaining quota percentages while retaining raw utilization", () => {
    const stats = { todayTokens: 1234, todayCostUsd: 2, totalTokens: 9000, totalCostUsd: 12 };
    const used = resolveIslandMetric("claude5h", { stats, currency: { symbol: "$", rate: 1 }, limits });
    const remaining = resolveIslandMetric("claude5h", {
      stats,
      currency: { symbol: "$", rate: 1 },
      limits,
      displayMode: ISLAND_LIMIT_DISPLAY_MODES.REMAINING,
    });
    expect(used.value).toBe("42%");
    expect(remaining.value).toBe("58%");
    expect(remaining.usedPercent).toBe(42);
    expect(remaining.ringPercent).toBe(58);
  });

  it("does not invent a compact ring when the primary slot is explicitly empty", () => {
    expect(resolveCompactRingMetric(ISLAND_NONE_METRIC, "todayCost", limits)).toBeNull();
    expect(resolveCompactRingMetric("todayTokens", "grokMonth", limits)).toBe("claude7d");
    expect(resolveCompactRingMetric("grokMonth", "todayCost", limits)).toBe("grokMonth");
  });
});
