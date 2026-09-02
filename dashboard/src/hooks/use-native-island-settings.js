import { useCallback, useEffect, useState } from "react";
import {
  isNativeApp,
  isNativeSettingsBridgeAvailable,
  onNativeSettings,
  nativeAction,
  requestNativeSettings,
  setNativeSetting,
} from "../lib/native-bridge";

/** Windows-native settings slice used only by the Dynamic Island. */
export function useNativeIslandSettings() {
  const [settings, setSettings] = useState(null);
  const available = isNativeApp() && isNativeSettingsBridgeAvailable();

  useEffect(() => {
    if (!available) return undefined;
    const unsubscribe = onNativeSettings((detail) => setSettings(detail));
    requestNativeSettings();
    return unsubscribe;
  }, [available]);

  const setSetting = useCallback(
    (key, value) => {
      if (!available) return;
      setSettings((previous) => (previous ? { ...previous, [key]: value } : previous));
      setNativeSetting(key, value);
    },
    [available],
  );

  const runAction = useCallback(
    (name) => {
      if (!available) return false;
      return nativeAction(name);
    },
    [available],
  );

  return { available, settings, setSetting, runAction };
}
