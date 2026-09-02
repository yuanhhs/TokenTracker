export const DESKTOP_WIDGET_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "summary",
    nameKey: "widgets.summary.name",
    descriptionKey: "widgets.summary.description",
    defaultSize: "medium",
    sizes: Object.freeze(["small", "medium", "large", "extraLarge"]),
  }),
  Object.freeze({
    id: "heatmap",
    nameKey: "widgets.heatmap.name",
    descriptionKey: "widgets.heatmap.description",
    defaultSize: "medium",
    sizes: Object.freeze(["medium", "large", "extraLarge"]),
  }),
  Object.freeze({
    id: "topModels",
    nameKey: "widgets.topModels.name",
    descriptionKey: "widgets.topModels.description",
    defaultSize: "medium",
    sizes: Object.freeze(["small", "medium", "large"]),
  }),
  Object.freeze({
    id: "limits",
    nameKey: "widgets.limits.name",
    descriptionKey: "widgets.limits.description",
    defaultSize: "medium",
    sizes: Object.freeze(["medium", "large"]),
  }),
]);

export function normalizeDesktopWidgetSize(id, value) {
  const definition = DESKTOP_WIDGET_DEFINITIONS.find((widget) => widget.id === id);
  if (!definition) return "medium";
  return definition.sizes.includes(value) ? value : definition.defaultSize;
}

export function normalizeDesktopWidgetItems(value) {
  const incoming = new Map(
    (Array.isArray(value) ? value : [])
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
  return DESKTOP_WIDGET_DEFINITIONS.map((definition) => {
    const item = incoming.get(definition.id) || {};
    return {
      ...definition,
      enabled: item.enabled === true,
      size: normalizeDesktopWidgetSize(definition.id, item.size),
    };
  });
}

export function desktopWidgetSizeLabelKey(size) {
  switch (size) {
    case "small": return "widgets.size.small";
    case "large": return "widgets.size.large";
    case "extraLarge": return "widgets.size.extra_large";
    default: return "widgets.size.medium";
  }
}
