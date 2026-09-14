import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuBarSection, NativeAppFooter } from "./MenuBarSection.jsx";

const nativeSettingsMock = vi.hoisted(() => ({
  settings: {
    toastOnReset: true,
    confettiOnReset: true,
    launchAtLogin: false,
    launchAtLoginSupported: true,
  },
  setSetting: vi.fn(),
  runAction: vi.fn(),
}));

vi.mock("../../hooks/use-native-settings.js", () => ({
  useNativeSettings: () => ({
    available: true,
    settings: nativeSettingsMock.settings,
    setSetting: nativeSettingsMock.setSetting,
    runAction: nativeSettingsMock.runAction,
  }),
}));

vi.mock("../../lib/copy", () => ({
  copy: (key, params) => key === "settings.footer.version" ? `TokenTracker v${params.version}` : key,
}));

describe("MenuBarSection limit-reset feedback", () => {
  beforeEach(() => {
    nativeSettingsMock.setSetting.mockReset();
  });

  it("shows independent toast and confetti settings", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MenuBarSection />
      </MemoryRouter>,
    );

    const toastSwitch = screen.getByRole("switch", {
      name: "settings.menubar.toastOnReset",
    });
    const confettiSwitch = screen.getByRole("switch", {
      name: "settings.menubar.confettiOnReset",
    });

    expect(toastSwitch).toHaveAttribute("aria-checked", "true");
    expect(confettiSwitch).toHaveAttribute("aria-checked", "true");

    await act(async () => {
      await user.click(toastSwitch);
      await user.click(confettiSwitch);
    });

    expect(nativeSettingsMock.setSetting).toHaveBeenCalledWith("toastOnReset", false);
    expect(nativeSettingsMock.setSetting).toHaveBeenCalledWith("confettiOnReset", false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shows the installed version without update controls or remote requests", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("VITE_APP_VERSION", "1.0.0");
    render(<MemoryRouter><MenuBarSection /><NativeAppFooter /></MemoryRouter>);
    expect(screen.getByText("TokenTracker v1.0.0")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "settings.menubar.autoUpdate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "settings.menubar.checkUpdates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
