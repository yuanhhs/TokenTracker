import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getNavGroups } from "./Sidebar.jsx";
import { McpIcon } from "../icons/McpIcon.jsx";

vi.mock("../../lib/copy", () => ({ copy: (key) => key }));

describe("tools navigation", () => {
  it("places MCP and desktop widgets immediately below Skills", () => {
    const tools = getNavGroups().find((group) => group.id === "tools");
    const ids = tools.items.map((item) => item.id);

    expect(ids.slice(ids.indexOf("skills"), ids.indexOf("skills") + 4)).toEqual([
      "skills",
      "mcp",
      "widgets",
      "ip-check",
    ]);
    expect(tools.items.find((item) => item.id === "mcp")).toMatchObject({
      to: "/mcp",
      icon: McpIcon,
      label: "nav.mcp",
    });
  });

  it("renders the cc-switch MCP chain mark as an inline SVG", () => {
    const { container } = render(<McpIcon className="test-icon" />);
    const svg = container.querySelector("svg.test-icon");

    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });
});
