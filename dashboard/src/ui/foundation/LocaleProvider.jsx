import React, { createContext, useLayoutEffect } from "react";
import { ZH_CN_LOCALE } from "../../lib/locale";

export const LocaleContext = createContext(null);
const LOCALE = Object.freeze({ resolvedLocale: ZH_CN_LOCALE });

export function LocaleProvider({ children }) {
  useLayoutEffect(() => {
    document.documentElement.lang = ZH_CN_LOCALE;
  }, []);

  return <LocaleContext.Provider value={LOCALE}>{children}</LocaleContext.Provider>;
}
