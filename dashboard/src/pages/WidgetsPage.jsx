import React, { useMemo } from "react";
import { Check, MonitorUp, Pin, RotateCcw } from "lucide-react";
import { ToggleSwitch } from "../components/settings/Controls.jsx";
import { useNativeWidgetSettings } from "../hooks/use-native-widget-settings.js";
import { cn } from "../lib/cn";
import { copy } from "../lib/copy";
import {
  desktopWidgetSizeLabelKey,
  normalizeDesktopWidgetItems,
} from "../lib/desktop-widgets.js";
import { Select } from "../ui/components";
import { FadeIn, StaggerContainer, StaggerItem } from "../ui/foundation/FadeIn.jsx";

const MODEL_COLORS = ["#5A8CF2", "#9973E6", "#4DB8A6", "#E68C59"];
const HEATMAP_LEVELS = [
  "bg-oai-gray-200 dark:bg-oai-gray-700",
  "bg-sky-500/25",
  "bg-sky-500/45",
  "bg-sky-500/70",
  "bg-sky-500",
];

function WidgetPreviewShell({ children }) {
  return (
    <div className="flex min-h-[174px] items-center justify-center rounded-xl bg-oai-gray-100 p-5 dark:bg-oai-gray-950/65">
      <div className="relative aspect-[2.08/1] w-full max-w-[330px] overflow-hidden rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_14px_35px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-[#19191b] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <WidgetPreviewShell>
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-2 gap-4">
          <PreviewMetric label={copy("widgets.preview.today")} value="203.2M" detail="$129.56 · ±0%" />
          <PreviewMetric label={copy("widgets.preview.seven_days")} value="880.9M" detail="$673.61" />
        </div>
        <svg viewBox="0 0 300 45" preserveAspectRatio="none" className="mt-auto h-12 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="widgets-summary-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A84FF" stopOpacity=".28" />
              <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 30 C24 24 38 14 61 22 S95 38 119 17 151 10 176 26 208 35 232 18 264 26 300 15 L300 45 L0 45Z" fill="url(#widgets-summary-gradient)" />
          <path d="M0 30 C24 24 38 14 61 22 S95 38 119 17 151 10 176 26 208 35 232 18 264 26 300 15" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </WidgetPreviewShell>
  );
}

function PreviewMetric({ label, value, detail }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-oai-gray-500 dark:text-oai-gray-400">{label}</div>
      <div className="mt-1 truncate text-2xl font-bold tracking-tight text-oai-black dark:text-white">{value}</div>
      <div className="mt-0.5 truncate text-[10px] font-medium text-oai-gray-500 dark:text-oai-gray-400">{detail}</div>
    </div>
  );
}

function HeatmapPreview() {
  const cells = useMemo(() => Array.from({ length: 26 * 7 }, (_, index) => {
    const wave = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
    return Math.floor(Math.abs(wave - Math.floor(wave)) * 5);
  }), []);
  return (
    <WidgetPreviewShell>
      <div className="flex h-full flex-col">
        <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((level, index) => (
            <span key={index} className={cn("min-h-0 rounded-[2px]", HEATMAP_LEVELS[level])} />
          ))}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm font-bold text-oai-black dark:text-white">10.3B</span>
          <span className="text-[10px] text-oai-gray-500 dark:text-oai-gray-400">
            {copy("widgets.preview.heatmap_summary", { days: 202 })}
          </span>
        </div>
      </div>
    </WidgetPreviewShell>
  );
}

function TopModelsPreview() {
  const models = [
    ["claude-opus-4-6", "586.4M", 59],
    ["claude-sonnet-4-5", "218.7M", 22],
    ["gpt-5.4", "80.6M", 8],
    ["composer-2-fast", "52.1M", 5],
  ];
  return (
    <WidgetPreviewShell>
      <div className="flex h-full flex-col justify-center gap-2.5">
        {models.map(([name, value, percent], index) => (
          <div key={name}>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[index] }} />
              <span className="min-w-0 flex-1 truncate font-medium text-oai-black dark:text-white">{name}</span>
              <span className="font-semibold tabular-nums text-oai-gray-500 dark:text-oai-gray-400">{value}</span>
              <span className="w-7 text-right tabular-nums text-oai-gray-400">{percent}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-oai-gray-200 dark:bg-oai-gray-700">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: MODEL_COLORS[index] }} />
            </div>
          </div>
        ))}
      </div>
    </WidgetPreviewShell>
  );
}

function LimitsPreview() {
  const rows = [
    ["Claude · 7d", 61, "bg-emerald-500"],
    ["Claude · 5h", 4, "bg-emerald-500"],
    ["Cursor · Plan", 51, "bg-emerald-500"],
    ["Codex · 7d", 32, "bg-emerald-500"],
  ];
  return (
    <WidgetPreviewShell>
      <div className="flex h-full flex-col justify-center gap-2.5">
        {rows.map(([label, percent, color]) => (
          <div key={label}>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="min-w-0 flex-1 truncate font-medium text-oai-black dark:text-white">{label}</span>
              <span className="font-semibold tabular-nums text-oai-gray-500 dark:text-oai-gray-300">{percent}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-oai-gray-200 dark:bg-oai-gray-700">
              <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(percent, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </WidgetPreviewShell>
  );
}

const PREVIEWS = {
  summary: SummaryPreview,
  heatmap: HeatmapPreview,
  topModels: TopModelsPreview,
  limits: LimitsPreview,
};

function WidgetCard({ widget, disabled, onEnabledChange, onSizeChange }) {
  const Preview = PREVIEWS[widget.id];
  const sizeOptions = widget.sizes.map((size) => ({
    value: size,
    label: copy(desktopWidgetSizeLabelKey(size)),
  }));
  return (
    <article className="flex h-full flex-col rounded-2xl border border-oai-gray-200 bg-white p-4 shadow-sm dark:border-oai-gray-800 dark:bg-oai-gray-900 sm:p-5">
      <Preview />
      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-oai-black dark:text-white">{copy(widget.nameKey)}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">{copy(widget.descriptionKey)}</p>
          </div>
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
            widget.enabled
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-oai-gray-100 text-oai-gray-500 dark:bg-oai-gray-800 dark:text-oai-gray-400",
          )}>
            {widget.enabled ? <Check className="h-3 w-3" aria-hidden /> : null}
            {copy(widget.enabled ? "widgets.status.visible" : "widgets.status.hidden")}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pt-5">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-oai-gray-500 dark:text-oai-gray-400">
              {copy("widgets.size.label")}
            </span>
            <Select
              value={widget.size}
              disabled={disabled}
              ariaLabel={copy("widgets.size.label")}
              onValueChange={onSizeChange}
              options={sizeOptions}
              matchTriggerWidth
              className="w-full px-3 py-2 text-sm font-medium"
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEnabledChange(!widget.enabled)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500 disabled:cursor-not-allowed disabled:opacity-45",
              widget.enabled
                ? "border border-oai-gray-200 bg-white text-oai-gray-700 hover:bg-oai-gray-50 dark:border-oai-gray-700 dark:bg-oai-gray-900 dark:text-oai-gray-200 dark:hover:bg-oai-gray-800"
                : "bg-oai-black text-white hover:bg-oai-gray-800 dark:bg-white dark:text-oai-black dark:hover:bg-oai-gray-200",
            )}
          >
            {copy(widget.enabled ? "widgets.action.hide" : "widgets.action.show")}
          </button>
        </div>
      </div>
    </article>
  );
}

export function WidgetsPage() {
  const { available, settings, setAlwaysOnTop, updateWidget, resetPositions } = useNativeWidgetSettings();
  const widgets = useMemo(
    () => normalizeDesktopWidgetItems(settings?.desktopWidgets),
    [settings?.desktopWidgets],
  );
  const ready = available && settings?.desktopWidgetsSupported === true;
  const alwaysOnTop = settings?.desktopWidgetsAlwaysOnTop !== false;

  return (
    <div className="flex min-h-full flex-col text-oai-black dark:text-oai-white">
      <main className="flex-1 pb-14 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn y={12}>
            <header className="mb-8 sm:mb-10">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <MonitorUp className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy("widgets.page.title")}</h1>
                  <p className="mt-1.5 text-sm text-oai-gray-500 dark:text-oai-gray-400 sm:text-base">{copy("widgets.page.subtitle")}</p>
                </div>
              </div>
            </header>
          </FadeIn>

          <FadeIn y={12} delay={0.04}>
            <section className="mb-6 rounded-2xl border border-oai-gray-200 bg-white p-4 shadow-sm dark:border-oai-gray-800 dark:bg-oai-gray-900 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-oai-gray-100 text-oai-gray-600 dark:bg-oai-gray-800 dark:text-oai-gray-300">
                    <Pin className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{copy("widgets.always_on_top.title")}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">{copy("widgets.always_on_top.hint")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={resetPositions}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-oai-gray-200 px-3 text-xs font-medium text-oai-gray-700 transition-colors hover:bg-oai-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-oai-gray-700 dark:text-oai-gray-200 dark:hover:bg-oai-gray-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    {copy("widgets.reset_positions")}
                  </button>
                  <ToggleSwitch
                    checked={alwaysOnTop}
                    disabled={!ready}
                    onChange={() => setAlwaysOnTop(!alwaysOnTop)}
                    ariaLabel={copy("widgets.always_on_top.title")}
                  />
                </div>
              </div>
            </section>
          </FadeIn>

          {!ready ? (
            <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {copy("widgets.windows_native_only")}
            </div>
          ) : null}

          <StaggerContainer staggerDelay={0.06} initialDelay={0.06}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {widgets.map((widget) => (
                <StaggerItem key={widget.id}>
                  <WidgetCard
                    widget={widget}
                    disabled={!ready}
                    onEnabledChange={(enabled) => updateWidget(widget.id, { enabled, size: widget.size })}
                    onSizeChange={(size) => updateWidget(widget.id, { enabled: widget.enabled, size })}
                  />
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        </div>
      </main>
    </div>
  );
}
