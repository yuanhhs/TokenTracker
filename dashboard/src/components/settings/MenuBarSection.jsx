import React from "react";
import { RefreshCw } from "lucide-react";
import { useNativeSettings } from "../../hooks/use-native-settings.js";
import { copy } from "../../lib/copy";
import { cn } from "../../lib/cn";
import { SectionCard, SettingsRow, ToggleSwitch } from "./Controls.jsx";

export function MenuBarSection() {
  const { available, settings, setSetting, runAction } = useNativeSettings();
  if (!available) return null;

  // Keep only Windows tray controls and system-level actions in this section.
  const launchAtLogin = Boolean(settings?.launchAtLogin);
  const toastOnReset = settings?.toastOnReset !== false;
  const confettiOnReset = settings?.confettiOnReset !== false;
  const launchAtLoginSupported = settings?.launchAtLoginSupported !== false;
  const isSyncing = Boolean(settings?.isSyncing);

  return (
    <SectionCard title={copy("settings.section.menubar")}>
      <SettingsRow
        label={copy("settings.menubar.toastOnReset")}
        hint={copy("settings.menubar.toastOnResetHint")}
        control={
          <ToggleSwitch
            checked={toastOnReset}
            onChange={() => setSetting("toastOnReset", !toastOnReset)}
            ariaLabel={copy("settings.menubar.toastOnReset")}
          />
        }
      />
      <SettingsRow
        label={copy("settings.menubar.confettiOnReset")}
        hint={copy("settings.menubar.confettiOnResetHint")}
        control={
          <ToggleSwitch
            checked={confettiOnReset}
            onChange={() => setSetting("confettiOnReset", !confettiOnReset)}
            ariaLabel={copy("settings.menubar.confettiOnReset")}
          />
        }
      />
      {launchAtLoginSupported ? (
        <SettingsRow
          label={copy("settings.menubar.launchAtLogin")}
          hint={copy("settings.menubar.launchAtLoginHint")}
          control={
            <ToggleSwitch
              checked={launchAtLogin}
              onChange={() => setSetting("launchAtLogin", !launchAtLogin)}
              ariaLabel={copy("settings.menubar.launchAtLogin")}
            />
          }
        />
      ) : null}
      <SettingsRow
        label={copy("settings.menubar.syncNow")}
        hint={copy("settings.menubar.syncNowHint")}
        control={
          <button
            type="button"
            onClick={() => runAction("syncNow")}
            disabled={isSyncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-oai-gray-200 px-3 text-xs font-medium text-oai-gray-700 transition-colors hover:bg-oai-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-oai-gray-800 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} aria-hidden />
            {isSyncing ? copy("settings.menubar.syncing") : copy("settings.menubar.syncNow")}
          </button>
        }
      />
    </SectionCard>
  );
}

export function NativeAppFooter() {
  return (
    <div className="mt-6 text-center text-xs text-oai-gray-500 dark:text-oai-gray-500">
      {copy("settings.footer.version", { version: import.meta.env.VITE_APP_VERSION })}
    </div>
  );
}
