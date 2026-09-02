import { describe, expect, it } from "vitest";
import {
  EN_LOCALE,
  ZH_CN_LOCALE,
  normalizeResolvedLocale,
  resolvePreferredLocale,
  SYSTEM_LOCALE,
} from "./locale";

describe("resolvePreferredLocale (system / Default)", () => {
  it("uses Simplified Chinese for every Chinese language tag", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh-Hans-CN", "en-US"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh-CN"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh-SG"])).toBe(ZH_CN_LOCALE);
  });

  it("normalizes Traditional Chinese tags to Simplified Chinese", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh-TW"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["zh-Hant-HK", "en-US"])).toBe(ZH_CN_LOCALE);
  });

  it("uses English when the primary preferred language is en, even if zh is in the list (issue #54)", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["en-US", "zh-Hans-CN"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["en", "zh-Hans", "ja"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["en-GB", "zh-CN", "fr-FR"])).toBe(EN_LOCALE);
  });

  it("falls back to English when languages list is empty", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, [])).toBe(EN_LOCALE);
  });

  it("uses English for unsupported primary languages", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["ja-JP", "en-US"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["ko-KR"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["de-DE"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["fr-FR"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["it-IT"])).toBe(EN_LOCALE);
  });

  it("ignores empty/whitespace primary entry and treats next as primary", () => {
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["", "zh-CN"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale(SYSTEM_LOCALE, ["   ", "en-US"])).toBe(EN_LOCALE);
  });

  it("respects explicit non-system preferences without consulting the languages list", () => {
    expect(resolvePreferredLocale("en", ["zh-CN"])).toBe(EN_LOCALE);
    expect(resolvePreferredLocale("zh-CN", ["en-US"])).toBe(ZH_CN_LOCALE);
    expect(resolvePreferredLocale("zh-TW", ["en-US"])).toBe(ZH_CN_LOCALE);
  });
});

describe("normalizeResolvedLocale", () => {
  it("normalizes values to Simplified Chinese or English", () => {
    expect(normalizeResolvedLocale("zh-CN")).toBe(ZH_CN_LOCALE);
    expect(normalizeResolvedLocale("zh-TW")).toBe(ZH_CN_LOCALE);
    expect(normalizeResolvedLocale("zh-Hant")).toBe(ZH_CN_LOCALE);
    expect(normalizeResolvedLocale("zh")).toBe(ZH_CN_LOCALE);
    expect(normalizeResolvedLocale("ja-JP")).toBe(EN_LOCALE);
    expect(normalizeResolvedLocale("ko")).toBe(EN_LOCALE);
    expect(normalizeResolvedLocale("de-DE")).toBe(EN_LOCALE);
    expect(normalizeResolvedLocale("en")).toBe(EN_LOCALE);
    expect(normalizeResolvedLocale(null)).toBe(EN_LOCALE);
  });
});
