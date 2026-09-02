import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicIslandSection } from "./DynamicIslandSection.jsx";

vi.mock("../../lib/copy", () => ({
  copy: (key) => key,
}));

vi.mock("../../hooks/use-usage-limits.ts", () => ({
  useUsageLimits: () => ({
    data: {
      claude: { configured: true, five_hour: { utilization: 42 } },
      codex: { configured: true, primary_window: { used_percent: 68 } },
    },
  }),
}));

describe("DynamicIslandSection", () => {
  const setSetting = vi.fn();
  const runAction = vi.fn();
  const nativeIsland = {
    settings: {
      dynamicIslandEnabled: true,
      dynamicIslandShowLimits: true,
      dynamicIslandAutoCollapse: true,
      dynamicIslandCompactMode: false,
      dynamicIslandLimitDisplayMode: "used",
      dynamicIslandMetrics: ["todayTokens", "todayCost"],
    },
    setSetting,
    runAction,
  };

  beforeEach(() => {
    setSetting.mockReset();
    runAction.mockReset();
  });

  it("updates the three Windows island preferences independently", async () => {
    const user = userEvent.setup();
    render(<DynamicIslandSection nativeIsland={nativeIsland} />);

    const enabled = screen.getByRole("switch", { name: "settings.island.enabled.aria" });
    const showLimits = screen.getByRole("switch", { name: "settings.island.show_limits.aria" });
    const autoCollapse = screen.getByRole("switch", { name: "settings.island.auto_collapse.aria" });

    await act(async () => {
      await user.click(enabled);
      await user.click(showLimits);
      await user.click(autoCollapse);
    });

    expect(setSetting).toHaveBeenCalledWith("dynamicIslandEnabled", false);
    expect(setSetting).toHaveBeenCalledWith("dynamicIslandShowLimits", false);
    expect(setSetting).toHaveBeenCalledWith("dynamicIslandAutoCollapse", false);
  });

  it("runs the native show and reset-placement actions", async () => {
    const user = userEvent.setup();
    render(<DynamicIslandSection nativeIsland={nativeIsland} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "settings.island.position.show" }));
      await user.click(screen.getByRole("button", { name: "settings.island.position.reset" }));
    });

    expect(runAction).toHaveBeenCalledWith("showDynamicIsland");
    expect(runAction).toHaveBeenCalledWith("resetDynamicIslandPosition");
  });

  it("updates compact mode and quota display mode", async () => {
    const user = userEvent.setup();
    render(<DynamicIslandSection nativeIsland={nativeIsland} />);

    await act(async () => {
      await user.click(screen.getByRole("switch", { name: "settings.island.compact.aria" }));
      await user.click(screen.getByRole("button", { name: "limits.settings.display_mode_remaining" }));
    });

    expect(setSetting).toHaveBeenCalledWith("dynamicIslandCompactMode", true);
    expect(setSetting).toHaveBeenCalledWith("dynamicIslandLimitDisplayMode", "remaining");
  });

  it("offers configured provider windows in the metric selectors", async () => {
    const user = userEvent.setup();
    render(<DynamicIslandSection nativeIsland={nativeIsland} />);

    const primary = screen.getByRole("combobox", { name: "settings.island.metrics.primary" });
    await act(async () => { await user.click(primary); });
    expect(screen.getByRole("option", { name: /limits\.label\.codex_5h/ })).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("option", { name: /limits\.label\.codex_5h/ }));
    });
    expect(setSetting).toHaveBeenCalledWith("dynamicIslandMetrics", ["codex5h", "todayCost"]);
  });
});
