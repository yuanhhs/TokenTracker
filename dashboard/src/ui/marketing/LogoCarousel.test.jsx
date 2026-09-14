import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../foundation/LocaleProvider.jsx";
import { LogoCarousel } from "./LogoCarousel.jsx";

const TRAE_LOGO = {
  id: 32,
  name: "TRAE Work CN",
  nameKey: "provider.display.trae_work_cn",
  provider: "trae-cn",
};

beforeEach(() => {
  window.localStorage.setItem("tokentracker-locale", "en");
  vi.spyOn(globalThis, "setInterval").mockImplementation(() => 0);
});

afterEach(() => {
  window.localStorage.removeItem("tokentracker-locale");
  vi.restoreAllMocks();
});

describe("LogoCarousel localization", () => {
  it("renders Chinese logo names despite a legacy English preference", async () => {
    const { container } = render(
      <LocaleProvider>
        <LogoCarousel logos={[TRAE_LOGO]} columnCount={1} />
      </LocaleProvider>,
    );

    let icon;
    await waitFor(() => {
      icon = container.querySelector('svg[data-brand="trae-cn"]');
      expect(icon).not.toBeNull();
    });
    fireEvent.mouseEnter(icon);
    expect(await screen.findByText("TRAE Work 中国版")).toBeInTheDocument();
  });
});
