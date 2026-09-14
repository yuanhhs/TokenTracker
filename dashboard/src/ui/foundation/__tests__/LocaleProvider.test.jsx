import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLocale } from "../../../hooks/useLocale.js";
import { copy, getCopyLocale } from "../../../lib/copy";
import { LocaleProvider } from "../LocaleProvider.jsx";

function LocaleProbe() {
  const { resolvedLocale } = useLocale();
  return <span lang={resolvedLocale}>{copy("nav.settings")}</span>;
}

afterEach(() => {
  window.localStorage.removeItem("tokentracker-locale");
  vi.restoreAllMocks();
});

it.each(["en", "zh-TW", "system"])("keeps Simplified Chinese with legacy preference %s", (preference) => {
  window.localStorage.setItem("tokentracker-locale", preference);
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US", "zh-TW"]);
  document.documentElement.lang = "en";
  render(<LocaleProvider><LocaleProbe /></LocaleProvider>);

  expect(screen.getByText("设置")).toHaveAttribute("lang", "zh-CN");
  expect(document.documentElement.lang).toBe("zh-CN");
  expect(getCopyLocale()).toBe("zh-CN");
  act(() => window.dispatchEvent(new Event("languagechange")));
  expect(screen.getByText("设置")).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("zh-CN");
});
