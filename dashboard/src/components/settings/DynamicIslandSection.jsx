import React, { useMemo } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { useUsageLimits } from "../../hooks/use-usage-limits.ts";
import { copy } from "../../lib/copy";
import { limitProviderName } from "../../lib/limits-providers.js";
import {
  buildIslandMetricOptions,
  ISLAND_LIMIT_DISPLAY_MODES,
  ISLAND_NONE_METRIC,
  normalizeIslandMetrics,
} from "../../lib/island-metrics.js";
import { Select } from "../../ui/components";
import { SectionCard, SegmentedControl, SettingsRow, ToggleSwitch } from "./Controls.jsx";

function ActionButton({ children, Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-oai-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-oai-gray-700 transition-colors hover:bg-oai-gray-50 hover:text-oai-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800 dark:hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{children}</span>
    </button>
  );
}

function previewMetricValue(metric) {
  if (!metric) return "";
  if (metric.category === "cost") return copy("settings.island.preview.cost_value");
  if (metric.category === "limits") return copy("settings.island.preview.limit_value");
  if (metric.category === "none") return "";
  return copy("settings.island.preview.tokens_value");
}

function metricDisplayLabel(metric) {
  if (!metric) return "";
  const label = metric.labelKey ? copy(metric.labelKey) : metric.label;
  return metric.category === "limits"
    ? `${limitProviderName(metric.providerId)} · ${label}`
    : label;
}

function IslandPreview({ compactMode, primaryMetric, secondaryMetric, showLimits }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-oai-gray-200 bg-gradient-to-b from-oai-gray-100 to-white px-5 pb-8 pt-0 dark:border-oai-gray-800 dark:from-oai-gray-950 dark:to-oai-gray-900">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-b-[1.4rem] border border-t-0 border-white/10 bg-black px-4 pb-4 text-white shadow-xl">
        <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            {compactMode ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-400 text-[8px] font-bold text-white/75">
                {copy("settings.island.preview.ring")}
              </span>
            ) : (
              <>
                <div className="text-xs font-semibold tabular-nums">{previewMetricValue(primaryMetric)}</div>
                <div className="mt-0.5 max-w-28 truncate text-[9px] text-white/45">{metricDisplayLabel(primaryMetric)}</div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
            <span className="h-2 w-5 rounded-full bg-white/10" />
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold tabular-nums">{previewMetricValue(secondaryMetric)}</div>
            <div className="mt-0.5 max-w-28 truncate text-[9px] text-white/45">{metricDisplayLabel(secondaryMetric)}</div>
          </div>
        </div>
        {showLimits ? (
          <div className="mt-1 border-t border-white/10 pt-3">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/50">
              {copy("settings.island.preview.limits")}
            </div>
            <div className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-[9px] text-white/65">
              <span>{copy("settings.island.preview.provider")}</span>
              <span className="h-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full w-[68%] rounded-full bg-emerald-400" />
              </span>
              <span className="text-right tabular-nums">{copy("settings.island.preview.limit_value")}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Windows-only controls for the always-on-top Dynamic Island surface. */
export function DynamicIslandSection({ nativeIsland, limitsPrefs }) {
  const { settings, setSetting, runAction } = nativeIsland;
  const { data: limits } = useUsageLimits();
  const enabled = Boolean(settings?.dynamicIslandEnabled);
  const showLimits = settings?.dynamicIslandShowLimits !== false;
  const autoCollapse = settings?.dynamicIslandAutoCollapse !== false;
  const compactMode = Boolean(settings?.dynamicIslandCompactMode);
  const limitDisplayMode = settings?.dynamicIslandLimitDisplayMode === ISLAND_LIMIT_DISPLAY_MODES.REMAINING
    ? ISLAND_LIMIT_DISPLAY_MODES.REMAINING
    : ISLAND_LIMIT_DISPLAY_MODES.USED;
  const hiddenProviders = useMemo(
    () => Object.entries(limitsPrefs?.visibility || {})
      .filter(([, visible]) => visible === false)
      .map(([id]) => id),
    [limitsPrefs?.visibility],
  );
  const storedMetrics = useMemo(
    () => normalizeIslandMetrics(settings?.dynamicIslandMetrics),
    [settings?.dynamicIslandMetrics],
  );
  const availableMetrics = useMemo(
    () => buildIslandMetricOptions(limits, hiddenProviders, storedMetrics),
    [hiddenProviders, limits, storedMetrics],
  );
  const availableIds = useMemo(() => availableMetrics.map((metric) => metric.id), [availableMetrics]);
  const selectedMetrics = useMemo(
    () => normalizeIslandMetrics(settings?.dynamicIslandMetrics, availableIds),
    [availableIds, settings?.dynamicIslandMetrics],
  );
  const metricOptions = useMemo(
    () => availableMetrics.map((metric) => ({ value: metric.id, label: metricDisplayLabel(metric) })),
    [availableMetrics],
  );
  const primaryMetric = availableMetrics.find((metric) => metric.id === selectedMetrics[0]);
  const secondaryMetric = availableMetrics.find((metric) => metric.id === selectedMetrics[1]);

  const changeMetric = (slot, id) => {
    const next = [...selectedMetrics];
    const other = slot === 0 ? 1 : 0;
    if (id !== ISLAND_NONE_METRIC && next[other] === id) {
      next[other] = next[slot];
    }
    next[slot] = id;
    setSetting("dynamicIslandMetrics", next);
  };

  return (
    <div className="space-y-4">
      <IslandPreview
        compactMode={compactMode}
        primaryMetric={primaryMetric}
        secondaryMetric={secondaryMetric}
        showLimits={showLimits}
      />

      <SectionCard title={copy("settings.island.general.title")}>
        <SettingsRow
          label={copy("settings.island.enabled.label")}
          hint={copy("settings.island.enabled.hint")}
          control={
            <ToggleSwitch
              checked={enabled}
              onChange={() => setSetting("dynamicIslandEnabled", !enabled)}
              ariaLabel={copy("settings.island.enabled.aria")}
            />
          }
        />
        <SettingsRow
          label={copy("settings.island.compact.label")}
          hint={copy("settings.island.compact.hint")}
          control={
            <ToggleSwitch
              checked={compactMode}
              onChange={() => setSetting("dynamicIslandCompactMode", !compactMode)}
              ariaLabel={copy("settings.island.compact.aria")}
            />
          }
        />
        <SettingsRow
          label={copy("settings.island.show_limits.label")}
          hint={copy("settings.island.show_limits.hint")}
          control={
            <ToggleSwitch
              checked={showLimits}
              onChange={() => setSetting("dynamicIslandShowLimits", !showLimits)}
              ariaLabel={copy("settings.island.show_limits.aria")}
            />
          }
        />
        <SettingsRow
          label={copy("settings.island.auto_collapse.label")}
          hint={copy("settings.island.auto_collapse.hint")}
          control={
            <ToggleSwitch
              checked={autoCollapse}
              onChange={() => setSetting("dynamicIslandAutoCollapse", !autoCollapse)}
              ariaLabel={copy("settings.island.auto_collapse.aria")}
            />
          }
        />
      </SectionCard>

      <SectionCard title={copy("settings.island.metrics.title")}>
        <SettingsRow
          label={copy("settings.island.metrics.primary")}
          hint={copy("settings.island.metrics.primary_hint")}
          control={
            <Select
              value={selectedMetrics[0]}
              onValueChange={(value) => changeMetric(0, value)}
              options={metricOptions}
              ariaLabel={copy("settings.island.metrics.primary")}
              className="w-56 px-3 py-1.5 text-xs font-medium"
            />
          }
        />
        <SettingsRow
          label={copy("settings.island.metrics.secondary")}
          hint={copy("settings.island.metrics.secondary_hint")}
          control={
            <Select
              value={selectedMetrics[1]}
              onValueChange={(value) => changeMetric(1, value)}
              options={metricOptions}
              ariaLabel={copy("settings.island.metrics.secondary")}
              className="w-56 px-3 py-1.5 text-xs font-medium"
            />
          }
        />
        <SettingsRow
          label={copy("settings.island.metrics.limit_mode")}
          hint={copy("settings.island.metrics.limit_mode_hint")}
          control={
            <SegmentedControl
              value={limitDisplayMode}
              onChange={(value) => setSetting("dynamicIslandLimitDisplayMode", value)}
              options={[
                { value: ISLAND_LIMIT_DISPLAY_MODES.USED, label: copy("limits.settings.display_mode_used") },
                { value: ISLAND_LIMIT_DISPLAY_MODES.REMAINING, label: copy("limits.settings.display_mode_remaining") },
              ]}
            />
          }
        />
      </SectionCard>

      <SectionCard title={copy("settings.island.position.title")}>
        <SettingsRow
          label={copy("settings.island.position.label")}
          hint={copy("settings.island.position.hint")}
          control={
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton Icon={Eye} onClick={() => runAction("showDynamicIsland")}>
                {copy("settings.island.position.show")}
              </ActionButton>
              <ActionButton Icon={RotateCcw} onClick={() => runAction("resetDynamicIslandPosition")}>
                {copy("settings.island.position.reset")}
              </ActionButton>
            </div>
          }
        />
      </SectionCard>
    </div>
  );
}
