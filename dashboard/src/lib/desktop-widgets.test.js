import { describe, expect, it } from "vitest";
import {
  DESKTOP_WIDGET_DEFINITIONS,
  normalizeDesktopWidgetItems,
  normalizeDesktopWidgetSize,
} from "./desktop-widgets.js";

describe("Windows desktop widget definitions", () => {
  it("keeps all four original WidgetKit widget types", () => {
    expect(DESKTOP_WIDGET_DEFINITIONS.map((widget) => widget.id)).toEqual([
      "summary",
      "heatmap",
      "topModels",
      "limits",
    ]);
  });

  it("preserves the original supported size families", () => {
    expect(DESKTOP_WIDGET_DEFINITIONS.map((widget) => [widget.id, widget.sizes])).toEqual([
      ["summary", ["small", "medium", "large", "extraLarge"]],
      ["heatmap", ["medium", "large", "extraLarge"]],
      ["topModels", ["small", "medium", "large"]],
      ["limits", ["medium", "large"]],
    ]);
  });

  it("normalizes missing and unsupported native settings", () => {
    expect(normalizeDesktopWidgetSize("limits", "small")).toBe("medium");
    expect(normalizeDesktopWidgetItems([{ id: "summary", enabled: true, size: "large" }]))
      .toMatchObject([
        { id: "summary", enabled: true, size: "large" },
        { id: "heatmap", enabled: false, size: "medium" },
        { id: "topModels", enabled: false, size: "medium" },
        { id: "limits", enabled: false, size: "medium" },
      ]);
  });
});
