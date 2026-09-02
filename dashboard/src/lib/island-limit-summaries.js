const PROVIDER_NAMES = {
  claude: "Claude",
  codex: "Codex",
  cursor: "Cursor",
  gemini: "Gemini",
  kimi: "Kimi",
  kiro: "Kiro",
  grok: "Grok",
  copilot: "GitHub Copilot",
  antigravity: "Antigravity",
  zcode: "ZCode",
};

/** Convert the fork's existing usage-limits payload into compact island rows. */
export function buildIslandLimitSummaries(limits) {
  if (!limits || typeof limits !== "object") return [];

  const rows = [];
  const addWindow = (id, providerId, label, provider, window, field = "used_percent", labelKey = null, shortLabel = null) => {
    if (provider?.configured !== true || provider?.error != null || !window) return;
    const raw = Number(window[field]);
    if (!Number.isFinite(raw)) return;
    rows.push({
      id,
      providerId,
      provider: PROVIDER_NAMES[providerId] || providerId,
      window: label,
      labelKey,
      shortLabel,
      usedPercent: Math.min(100, Math.max(0, raw)),
      resetAt: window.resets_at ?? window.reset_at ?? null,
    });
  };
  const addGeneric = (providerId, provider, windows) => {
    for (const [id, label, window, labelKey, shortLabel] of windows) {
      addWindow(id, providerId, label, provider, window, "used_percent", labelKey, shortLabel);
    }
  };

  const claude = limits.claude;
  addWindow("claude5h", "claude", "5h", claude, claude?.five_hour, "utilization", "limits.label.claude_5h", "5h");
  addWindow("claude7d", "claude", "7d", claude, claude?.seven_day, "utilization", "limits.label.claude_7d", "7d");
  addWindow("claudeOpus", "claude", "Opus", claude, claude?.seven_day_opus, "utilization", "limits.label.claude_opus", "Opus");
  if (claude?.configured === true && claude?.error == null && Array.isArray(claude.weekly_scoped)) {
    for (const window of claude.weekly_scoped) {
      const label = window?.label || "Weekly";
      addWindow(`claudeScoped:${label}`, "claude", label, claude, window, "utilization", null, label);
    }
  }

  const codex = limits.codex;
  addWindow("codex5h", "codex", "5h", codex, codex?.primary_window, "used_percent", "limits.label.codex_5h", "5h");
  addWindow("codex7d", "codex", "7d", codex, codex?.secondary_window, "used_percent", "limits.label.codex_7d", "7d");
  addWindow("codexCredits", "codex", "Credits", codex, codex?.credit_window, "used_percent", "limits.label.codex_credits", "Credits");
  addWindow("codexSpark5h", "codex", "Spark 5h", codex, codex?.spark_primary_window, "used_percent", "limits.label.codex_spark_5h", "S 5h");
  addWindow("codexSpark7d", "codex", "Spark 7d", codex, codex?.spark_secondary_window, "used_percent", "limits.label.codex_spark_7d", "S 7d");

  addGeneric("cursor", limits.cursor, [["cursorPlan", "Plan", limits.cursor?.primary_window, "limits.label.cursor_plan", "Plan"], ["cursorAuto", "Auto", limits.cursor?.secondary_window, "limits.label.cursor_auto", "Auto"], ["cursorAPI", "API", limits.cursor?.tertiary_window, "limits.label.cursor_api", "API"], ["cursorGrok", "Grok", limits.cursor?.quaternary_window, "limits.label.cursor_grok_bot", "Grok"]]);
  addGeneric("gemini", limits.gemini, [["geminiPro", "Pro", limits.gemini?.primary_window, "limits.label.gemini_pro", "Pro"], ["geminiFlash", "Flash", limits.gemini?.secondary_window, "limits.label.gemini_flash", "Flash"], ["geminiLite", "Lite", limits.gemini?.tertiary_window, "limits.label.gemini_lite", "Lite"]]);
  addGeneric("kimi", limits.kimi, [["kimiWeekly", "Weekly", limits.kimi?.primary_window, "limits.label.kimi_weekly", "Week"], ["kimi5h", "5h", limits.kimi?.secondary_window, "limits.label.kimi_5h", "5h"], ["kimiTotal", "Total", limits.kimi?.tertiary_window, "limits.label.kimi_total", "Total"]]);
  addGeneric("kiro", limits.kiro, [["kiroMonth", "Month", limits.kiro?.primary_window, "limits.label.kiro_month", "Month"], ["kiroBonus", "Bonus", limits.kiro?.secondary_window, "limits.label.kiro_bonus", "Bonus"]]);

  const grokPeriod = limits.grok?.period_type;
  const grokLabel = grokPeriod === "weekly" ? "Week" : grokPeriod === "daily" ? "Day" : "Month";
  const grokLabelKey = grokPeriod === "weekly" ? "limits.label.grok_week" : grokPeriod === "daily" ? "limits.label.grok_day" : "limits.label.grok_month";
  // Keep the original macOS preference id `grokMonth` for storage
  // compatibility.  The label remains period-aware because SuperGrok can
  // report a weekly pool while legacy accounts report a monthly pool.
  addGeneric("grok", limits.grok, [["grokMonth", grokLabel, limits.grok?.primary_window, grokLabelKey, grokLabel], ["grokOndemand", "On-demand", limits.grok?.secondary_window, "limits.label.grok_ondemand", "OD"]]);
  addGeneric("copilot", limits.copilot, [["copilotPremium", "Premium", limits.copilot?.primary_window, "limits.label.copilot_premium", "Premium"], ["copilotChat", "Chat", limits.copilot?.secondary_window, "limits.label.copilot_chat", "Chat"]]);
  addGeneric("antigravity", limits.antigravity, [["antigravityClaudeWeekly", "Claude weekly", limits.antigravity?.primary_window, "limits.label.antigravity_claude_weekly", "Cl 7d"], ["antigravityClaude5h", "Claude 5h", limits.antigravity?.secondary_window, "limits.label.antigravity_claude_5h", "Cl 5h"], ["antigravityGeminiWeekly", "Gemini weekly", limits.antigravity?.tertiary_window, "limits.label.antigravity_gemini_weekly", "Gm 7d"], ["antigravityGemini5h", "Gemini 5h", limits.antigravity?.quaternary_window, "limits.label.antigravity_gemini_5h", "Gm 5h"]]);

  const zcode = limits.zcode;
  addGeneric("zcode", zcode, zcode?.plan_kind === "coding-plan"
    ? [["zcode5h", "5h", zcode?.primary_window, "limits.label.zcode_5h", "5h"], ["zcodeWeekly", "Weekly", zcode?.secondary_window, "limits.label.zcode_weekly", "Week"], ["zcodeTools", "Tools", zcode?.tertiary_window, "limits.label.zcode_tools", "Tools"]]
    : [["zcodeGlm52", "GLM-5.2", zcode?.primary_window, "limits.label.zcode_glm52", "GLM 5.2"], ["zcodeGlm5Turbo", "GLM-5 Turbo", zcode?.secondary_window, "limits.label.zcode_glm5t", "GLM 5T"]]);

  rows.sort((left, right) => right.usedPercent - left.usedPercent);
  return rows;
}

export function islandLimitTone(percent) {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "normal";
}
