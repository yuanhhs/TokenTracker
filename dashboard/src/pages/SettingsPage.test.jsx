import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage.jsx";

const nativeSettingsMock = vi.hoisted(() => ({
  available: true,
}));

const proxySettingsMock = vi.hoisted(() => ({
  available: false,
}));

const LABELS = {
  "settings.page.title": "Settings",
  "settings.page.subtitle": "Manage your preferences",
  "settings.section.appearance": "Appearance",
  "settings.section.menubar": "Menu Bar App",
  "settings.section.labs": "Labs",
  "settings.section.network": "Network",
};

vi.mock("../lib/copy", () => ({
  copy: (key) => LABELS[key] || key,
}));

vi.mock("../lib/native-bridge", () => ({
  isNativeApp: () => true,
  isBridgeAvailable: () => nativeSettingsMock.available,
}));

vi.mock("../hooks/use-native-settings.js", () => ({
  useNativeSettings: () => ({
    available: nativeSettingsMock.available,
  }),
}));

vi.mock("../hooks/use-proxy-settings.js", () => ({
  useProxySettings: () => ({
    available: proxySettingsMock.available,
    loading: false,
    config: { mode: "system", protocol: "http", host: "", port: "", effective: "none" },
    save: vi.fn(),
    testConnection: vi.fn(),
  }),
}));

vi.mock("../components/settings/AppearanceSection.jsx", () => ({
  AppearanceSection: () => <div data-testid="appearance-content" />,
}));

vi.mock("../components/settings/MenuBarSection.jsx", () => ({
  MenuBarSection: () => <div data-testid="native-content" />,
  NativeAppFooter: () => <footer data-testid="settings-footer" />,
}));

vi.mock("../components/settings/LabsSection.jsx", () => ({
  LabsSection: () => <div data-testid="labs-content" />,
}));

vi.mock("../components/settings/NetworkSection.jsx", () => ({
  NetworkSection: () => <div data-testid="network-content" />,
}));

function renderSettings(initialPath = "/settings") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage category navigation", () => {
  beforeEach(() => {
    nativeSettingsMock.available = true;
    proxySettingsMock.available = false;
  });

  it("switches the visible category while keeping every section mounted", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();

    const appearanceButton = screen.getByRole("button", { name: "Appearance" });
    const labsButton = screen.getByRole("button", { name: "Labs" });
    const appearancePanel = container.querySelector('[data-settings-panel="appearance"]');
    const labsPanel = container.querySelector('[data-settings-panel="labs"]');

    expect(appearanceButton).toHaveAttribute("aria-current", "page");
    expect(appearancePanel).not.toHaveAttribute("hidden");
    expect(labsPanel).toHaveAttribute("hidden");
    expect(screen.getByTestId("appearance-content")).toBeInTheDocument();

    await act(async () => {
      await user.click(labsButton);
    });

    expect(labsButton).toHaveAttribute("aria-current", "page");
    expect(appearanceButton).not.toHaveAttribute("aria-current");
    expect(appearancePanel).toHaveAttribute("hidden");
    expect(labsPanel).not.toHaveAttribute("hidden");
  });

  it("omits the network category when the local proxy API is unavailable", () => {
    proxySettingsMock.available = false;
    const { container } = renderSettings();

    expect(screen.queryByRole("button", { name: "Network" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-settings-panel="network"]')).toBeNull();
  });

  it("shows the network category when the local proxy API is available", () => {
    proxySettingsMock.available = true;
    const { container } = renderSettings();

    expect(screen.getByRole("button", { name: "Network" })).toBeInTheDocument();
    expect(container.querySelector('[data-settings-panel="network"]')).not.toBeNull();
    expect(screen.getByTestId("network-content")).toBeInTheDocument();
  });

  it("omits the native-app category when the native bridge is unavailable", () => {
    nativeSettingsMock.available = false;
    const { container } = renderSettings();

    expect(screen.queryByRole("button", { name: "Menu Bar App" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-settings-panel="native-app"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-current", "page");
  });

  // Usage limits were removed; the limits category and its deep link must not
  // resurrect an empty panel.
  it("has no limits category, and its old deep link falls back to Appearance", () => {
    const { container } = renderSettings("/settings?section=limits");

    expect(container.querySelector('[data-settings-panel="limits"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(container.querySelector('[data-settings-panel="appearance"]')).not.toHaveAttribute("hidden");
  });

  it("falls back to Appearance for an unknown settings category", () => {
    const { container } = renderSettings("/settings?section=unknown");

    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(container.querySelector('[data-settings-panel="appearance"]')).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("appearance-content")).toBeInTheDocument();
  });
});
