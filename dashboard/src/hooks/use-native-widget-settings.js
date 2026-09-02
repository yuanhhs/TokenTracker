import { useCallback, useEffect, useState } from "react";
import {
  isNativeApp,
  isNativeSettingsBridgeAvailable,
  nativeAction,
  onNativeSettings,
  requestNativeSettings,
  setNativeSetting,
} from "../lib/native-bridge";

/** Windows-native settings slice used by the desktop-widget manager. */
export function useNativeWidgetSettings() {
  const [settings, setSettings] = useState(null);
  const available = isNativeApp() && isNativeSettingsBridgeAvailable();

  useEffect(() => {
    if (!available) return undefined;
    const unsubscribe = onNativeSettings((detail) => setSettings(detail));
    requestNativeSettings();
    return unsubscribe;
  }, [available]);

  const setAlwaysOnTop = useCallback((enabled) => {
    if (!available) return;
    setSettings((previous) => previous
      ? { ...previous, desktopWidgetsAlwaysOnTop: Boolean(enabled) }
      : previous);
    setNativeSetting("desktopWidgetsAlwaysOnTop", Boolean(enabled));
  }, [available]);

  const updateWidget = useCallback((id, patch) => {
    if (!available) return;
    setSettings((previous) => {
      if (!previous) return previous;
      const items = Array.isArray(previous.desktopWidgets) ? previous.desktopWidgets : [];
      return {
        ...previous,
        desktopWidgets: items.map((item) => item.id === id ? { ...item, ...patch } : item),
      };
    });
    setNativeSetting("desktopWidgetConfig", { id, ...patch });
  }, [available]);

  const resetPositions = useCallback(() => {
    if (!available) return false;
    return nativeAction("resetDesktopWidgetPositions");
  }, [available]);

  return { available, settings, setAlwaysOnTop, updateWidget, resetPositions };
}
