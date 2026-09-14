import copyRegistry from "virtual:tokentracker-copy-registry";
import { ZH_CN_LOCALE } from "./locale";

type AnyRecord = Record<string, any>;

function interpolate(text: any, params?: AnyRecord) {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
    if (params[key] == null) return match;
    return String(params[key]);
  });
}

function normalizeText(text: any) {
  return String(text).replace(/\\n/g, "\n");
}

export function getCopyLocale() {
  return ZH_CN_LOCALE;
}

export function copy(key: any, params?: AnyRecord) {
  const normalizedKey = String(key);
  const baseText = Object.hasOwn(copyRegistry, normalizedKey)
    ? copyRegistry[normalizedKey]
    : undefined;
  if (typeof baseText !== "string" && import.meta?.env?.DEV) {
    console.warn(`Missing copy key: ${normalizedKey}`);
  }
  const text = baseText || normalizedKey;
  return interpolate(normalizeText(text), params);
}
