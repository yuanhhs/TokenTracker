import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuBarSection, NativeAppFooter } from "./MenuBarSection.jsx";

const nativeSettingsMock = vi.hoisted(() => ({
  settings: {
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

describe("MenuBarSection", () => {
  beforeEach(() => {
    nativeSettingsMock.setSetting.mockReset();
  });

  it("toggles launch at login", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MenuBarSection />
      </MemoryRouter>,
    );

    const launchSwitch = screen.getByRole("switch", {
      name: "settings.menubar.launchAtLogin",
    });
    expect(launchSwitch).toHaveAttribute("aria-checked", "false");

    await act(async () => {
      await user.click(launchSwitch);
    });

    expect(nativeSettingsMock.setSetting).toHaveBeenCalledWith("launchAtLogin", true);
  });

  // Usage limits were removed, so the limit-reset toast/confetti toggles they
  // controlled must not come back with them.
  it("does not render limit-reset feedback settings", () => {
    render(
      <MemoryRouter>
        <MenuBarSection />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("switch", { name: "settings.menubar.toastOnReset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "settings.menubar.confettiOnReset" })).not.toBeInTheDocument();
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
