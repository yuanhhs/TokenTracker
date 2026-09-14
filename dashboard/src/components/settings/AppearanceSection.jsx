import React from "react";
import { Info, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.js";
import { useCurrency } from "../../hooks/useCurrency.js";
import { useTokenFormat } from "../../hooks/useTokenFormat.js";
import { ZH_CN_LOCALE } from "../../lib/locale";
import { CURRENCY_USD, getSupportedCurrencies } from "../../lib/currency";
import { copy } from "../../lib/copy";
import { Select } from "../../ui/components";
import { SectionCard, SegmentedControl, SettingsRow } from "./Controls.jsx";
import { TOKEN_FORMAT_MODES } from "../../lib/token-format.js";

function buildThemeOptions() {
  return [
    { value: "light", label: copy("settings.appearance.theme.light"), Icon: Sun },
    { value: "dark", label: copy("settings.appearance.theme.dark"), Icon: Moon },
    { value: "system", label: copy("settings.appearance.theme.system"), Icon: Monitor },
  ];
}

function formatUpdatedAt(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(ZH_CN_LOCALE);
  } catch {
    return null;
  }
}

function buildSourceTooltip(rateSource, rateFetchedAt) {
  const source = copy(`settings.appearance.currency.rate_source.${rateSource}`);
  const updatedAt = formatUpdatedAt(rateFetchedAt);
  const when = updatedAt
    ? copy("settings.appearance.currency.rate_updated", { when: updatedAt })
    : copy("settings.appearance.currency.rate_never");
  return `${source} · ${when}`;
}

function CurrencyDropdown({ currency, setCurrency }) {
  const options = getSupportedCurrencies().map((opt) => ({
    value: opt.code,
    label: copy(opt.labelKey),
  }));
  return (
    <Select
      value={currency}
      onValueChange={setCurrency}
      options={options}
      ariaLabel={copy("settings.appearance.currency.label")}
      className="px-3 py-1.5 text-xs font-medium"
    />
  );
}

function CurrencyHint({ currency, rate, rateSource, rateFetchedAt }) {
  if (currency === CURRENCY_USD) {
    return <>{copy("settings.appearance.currency.hint")}</>;
  }
  const tooltip = buildSourceTooltip(rateSource, rateFetchedAt);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{`1 USD = ${rate.toFixed(4)} ${currency}`}</span>
      <span
        role="img"
        aria-label={tooltip}
        title={tooltip}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center text-oai-gray-400 hover:text-oai-gray-600 dark:text-oai-gray-500 dark:hover:text-oai-gray-300"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </span>
    </span>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { currency, rate, rateSource, rateFetchedAt, setCurrency } = useCurrency();
  const { mode: tokenFormatMode, setMode: setTokenFormatMode } = useTokenFormat();

  return (
    <SectionCard title={copy("settings.section.appearance")}>
      <SettingsRow
        label={copy("settings.appearance.theme.label")}
        hint={copy("settings.appearance.theme.hint")}
        control={<SegmentedControl options={buildThemeOptions()} value={theme} onChange={setTheme} />}
      />
      <SettingsRow
        label={copy("settings.appearance.currency.label")}
        hint={
          <CurrencyHint
            currency={currency}
            rate={rate}
            rateSource={rateSource}
            rateFetchedAt={rateFetchedAt}
          />
        }
        control={<CurrencyDropdown currency={currency} setCurrency={setCurrency} />}
      />
      <SettingsRow
        label={copy("settings.appearance.token_format.label")}
        hint={copy("settings.appearance.token_format.hint")}
        control={
          <SegmentedControl
            options={[
              {
                value: TOKEN_FORMAT_MODES.COMPACT,
                label: copy("settings.appearance.token_format.compact"),
              },
              {
                value: TOKEN_FORMAT_MODES.FULL,
                label: copy("settings.appearance.token_format.full"),
              },
            ]}
            value={tokenFormatMode}
            onChange={setTokenFormatMode}
          />
        }
      />
    </SectionCard>
  );
}
