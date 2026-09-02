import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetsPage } from "./WidgetsPage.jsx";

const LABELS = {
  "widgets.page.title": "Desktop Widgets",
  "widgets.page.subtitle": "Keep usage at a glance",
  "widgets.always_on_top.title": "Always on top",
  "widgets.always_on_top.hint": "Keep widgets above other windows",
  "widgets.reset_positions": "Reset positions",
  "widgets.windows_native_only": "Windows app only",
  "widgets.summary.name": "Usage Summary",
  "widgets.summary.description": "Token and cost summary",
  "widgets.heatmap.name": "Activity Heatmap",
  "widgets.heatmap.description": "Recent activity",
  "widgets.topModels.name": "Top Models",
  "widgets.topModels.description": "Most-used models",
  "widgets.limits.name": "Usage Limits",
  "widgets.limits.description": "Provider quota windows",
  "widgets.status.visible": "Visible",
  "widgets.status.hidden": "Hidden",
  "widgets.action.show": "Show",
  "widgets.action.hide": "Hide",
  "widgets.size.label": "Size",
  "widgets.size.small": "Small",
  "widgets.size.medium": "Medium",
  "widgets.size.large": "Large",
  "widgets.size.extra_large": "Extra Large",
  "widgets.preview.today": "Today",
  "widgets.preview.seven_days": "7 days",
  "widgets.preview.heatmap_summary": "202 active days",
};

vi.mock("../lib/copy", () => ({
  copy: (key) => LABELS[key] || key,
}));

const postMessage = vi.fn();

function nativeMessages() {
  return postMessage.mock.calls.map(([message]) => JSON.parse(message));
}

async function renderReady() {
  render(<WidgetsPage />);

  await waitFor(() => {
    expect(nativeMessages()).toContainEqual({ type: "getSettings" });
  });

  act(() => {
    window.dispatchEvent(new CustomEvent("native:settings", {
      detail: {
        nativePlatform: "windows",
        desktopWidgetsSupported: true,
        desktopWidgetsAlwaysOnTop: true,
        desktopWidgets: [
          { id: "summary", enabled: false, size: "medium" },
          { id: "heatmap", enabled: true, size: "large" },
          { id: "topModels", enabled: false, size: "small" },
          { id: "limits", enabled: true, size: "medium" },
        ],
      },
    }));
  });

  await screen.findByRole("heading", { name: "Usage Summary" });
  postMessage.mockClear();
}

describe("WidgetsPage Windows bridge", () => {
  beforeEach(() => {
    postMessage.mockReset();
    window.history.replaceState({}, "", "/widgets?app=1");
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: { webview: { postMessage } },
    });
  });

  afterEach(() => {
    window.localStorage.removeItem("tokentracker_native_app");
    window.history.replaceState({}, "", "/");
    delete window.chrome;
  });

  it("renders all four original widget families after native settings arrive", async () => {
    await renderReady();

    expect(screen.getByRole("heading", { name: "Usage Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity Heatmap" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top Models" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Usage Limits" })).toBeInTheDocument();
  });

  it("sends visibility and size changes for the selected widget", async () => {
    const user = userEvent.setup();
    await renderReady();
    const summaryCard = screen.getByRole("heading", { name: "Usage Summary" }).closest("article");

    await act(async () => {
      await user.click(within(summaryCard).getByRole("button", { name: "Show" }));
    });
    expect(nativeMessages()).toContainEqual({
      type: "setSetting",
      key: "desktopWidgetConfig",
      value: { id: "summary", enabled: true, size: "medium" },
    });

    await act(async () => {
      await user.click(within(summaryCard).getByRole("combobox", { name: "Size" }));
    });
    const largeOption = await screen.findByRole("option", { name: "Large" });
    await act(async () => {
      await user.click(largeOption);
    });
    expect(nativeMessages()).toContainEqual({
      type: "setSetting",
      key: "desktopWidgetConfig",
      value: { id: "summary", enabled: true, size: "large" },
    });
  });

  it("sends always-on-top and reset-position changes", async () => {
    const user = userEvent.setup();
    await renderReady();

    await act(async () => {
      await user.click(screen.getByRole("switch", { name: "Always on top" }));
      await user.click(screen.getByRole("button", { name: "Reset positions" }));
    });

    expect(nativeMessages()).toContainEqual({
      type: "setSetting",
      key: "desktopWidgetsAlwaysOnTop",
      value: false,
    });
    expect(nativeMessages()).toContainEqual({
      type: "action",
      name: "resetDesktopWidgetPositions",
    });
  });
});
