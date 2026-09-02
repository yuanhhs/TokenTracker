import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import McpPage from "./McpPage.jsx";

const api = vi.hoisted(() => ({
  getMcpState: vi.fn(),
  previewMcpMutation: vi.fn(),
  commitMcpMutation: vi.fn(),
}));

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../lib/mcp-api", () => api);
vi.mock("../ui/components/Toast.jsx", () => toast);
vi.mock("../ui/dashboard/components/ProviderIcon.jsx", () => ({
  ProviderIcon: ({ provider }) => <span data-provider={provider} />,
}));
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ open, children }) => {
      if (!open) return null;
      return <>{children}</>;
    },
    Portal: ({ children }) => <>{children}</>,
    Backdrop: () => <div />,
    Viewport: ({ children }) => <div>{children}</div>,
    Popup: ({ children }) => <div data-testid="dialog-popup">{children}</div>,
    Title: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    Description: ({ children, ...props }) => <p {...props}>{children}</p>,
  },
}));

function state() {
  return {
    warnings: [],
    targets: [
      { id: "claude", label: "Claude", installed: true, configPath: "C:\\Users\\me\\.claude.json" },
      { id: "codex", label: "Codex", installed: true, configPath: "C:\\Users\\me\\.codex\\config.toml" },
      { id: "gemini", label: "Gemini", installed: false, configPath: "C:\\Users\\me\\.gemini\\settings.json" },
    ],
    servers: [
      {
        id: "filesystem",
        name: "filesystem",
        server: { type: "stdio", command: "npx", args: ["-y", "server-filesystem"] },
        apps: { claude: true, codex: false, gemini: false },
      },
    ],
  };
}

function previewFor(operation) {
  const deleting = operation.action === "delete";
  const target = operation.action === "toggle" ? operation.target : deleting ? "claude" : "codex";
  const label = target === "claude" ? "Claude" : "Codex";
  const configPath = target === "claude"
    ? "C:\\Users\\me\\.claude.json"
    : "C:\\Users\\me\\.codex\\config.toml";
  return {
    warnings: [],
    reviewToken: "a".repeat(64),
    changes: [{
      target,
      label,
      configPath,
      additions: deleting ? 0 : 2,
      deletions: deleting ? 2 : 0,
      lines: deleting
        ? [
            { type: "context", oldLine: 1, newLine: 1, text: "{" },
            { type: "remove", oldLine: 2, newLine: null, text: '  "filesystem": {' },
            { type: "remove", oldLine: 3, newLine: null, text: '    "command": "npx"' },
            { type: "context", oldLine: 4, newLine: 2, text: "}" },
          ]
        : [
            ...Array.from({ length: 8 }, (_, index) => ({
              type: "context",
              oldLine: index + 1,
              newLine: index + 1,
              text: `setting_${index + 1} = true`,
            })),
            { type: "add", oldLine: null, newLine: 9, text: '[mcp_servers."filesystem"]' },
            { type: "add", oldLine: null, newLine: 10, text: 'command = "npx"' },
          ],
    }],
  };
}

describe("McpPage", () => {
  beforeEach(() => {
    api.getMcpState.mockReset().mockResolvedValue(state());
    api.previewMcpMutation.mockReset().mockImplementation(async (operation) => previewFor(operation));
    api.commitMcpMutation.mockReset().mockResolvedValue({ warnings: [] });
    toast.showToast.mockReset();
  });

  it("shows servers read from live tool configurations and their config paths", async () => {
    render(<McpPage />);

    expect(await screen.findByRole("heading", { name: "MCP Servers" })).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    expect(screen.getByText("npx -y server-filesystem")).toBeInTheDocument();
    expect(screen.getByTitle("C:\\Users\\me\\.claude.json")).toBeInTheDocument();
    expect(screen.getByTitle(/settings\.json.*App not detected/)).toBeInTheDocument();
    expect(api.getMcpState).toHaveBeenCalledTimes(1);
  });

  it("reviews exact line-numbered target changes before writing and refreshes after confirmation", async () => {
    const user = userEvent.setup();
    render(<McpPage />);

    const codexToggle = await screen.findByRole("button", {
      name: "Not present in Codex configuration",
    });
    await act(async () => {
      await user.click(codexToggle);
    });

    const operation = { action: "toggle", id: "filesystem", target: "codex", enabled: true };
    expect(api.previewMcpMutation).toHaveBeenCalledWith(operation);
    expect(await screen.findByRole("heading", { name: "Review MCP configuration changes" })).toBeInTheDocument();
    expect(screen.getByText("C:\\Users\\me\\.codex\\config.toml")).toBeInTheDocument();
    const fileHeader = screen.getByTestId("mcp-file-diff-header");
    expect(within(fileHeader).getByText("config.toml")).toBeInTheDocument();
    expect(within(fileHeader).getByText("+2")).toBeInTheDocument();
    expect(within(fileHeader).getByText("−0")).toBeInTheDocument();
    expect(screen.getByText("5 more lines")).toBeInTheDocument();
    const addedRow = screen.getAllByTestId("mcp-diff-row-add")[0];
    expect(within(addedRow).getByText("9")).toBeInTheDocument();
    expect(within(addedRow).getByText('[mcp_servers."filesystem"]')).toBeInTheDocument();
    expect(api.commitMcpMutation).not.toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "5 more lines" }));
    });
    expect(screen.queryByText("5 more lines")).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Hide file changes" }));
    });
    expect(screen.queryByTestId("mcp-diff-row-add")).not.toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show file changes" }));
    });
    expect(screen.getAllByTestId("mcp-diff-row-add").length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Confirm and write" }));
    });

    expect(api.commitMcpMutation).toHaveBeenCalledWith(operation, "a".repeat(64));
    await waitFor(() => expect(api.getMcpState).toHaveBeenCalledTimes(2));
  });

  it("adds a server to selected configuration files", async () => {
    render(<McpPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Add server" }));
    const editor = within(screen.getByTestId("dialog-popup"));
    fireEvent.change(editor.getByLabelText("Server ID"), { target: { value: "github" } });
    fireEvent.change(editor.getByLabelText("Command"), { target: { value: "npx" } });
    fireEvent.change(editor.getByLabelText("Arguments (one per line)"), {
      target: { value: "-y\nserver-github" },
    });
    fireEvent.click(editor.getByRole("button", { name: "Not present in Codex configuration" }));
    await act(async () => {
      fireEvent.click(editor.getByRole("button", { name: "Save" }));
      await Promise.resolve();
    });

    const operation = {
      action: "upsert",
      server: {
        id: "github",
        server: { type: "stdio", command: "npx", args: ["-y", "server-github"] },
        apps: expect.objectContaining({ claude: false, codex: true, gemini: false }),
      },
    };
    await waitFor(() => {
      expect(api.previewMcpMutation).toHaveBeenCalledWith(operation);
    });
    expect(screen.getByRole("heading", { name: "Review MCP configuration changes" })).toBeInTheDocument();
    expect(screen.getAllByTestId("mcp-diff-row-add").length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm and write" }));
      await Promise.resolve();
    });

    expect(api.commitMcpMutation).toHaveBeenCalledWith(operation, "a".repeat(64));
  });

  it("reviews red deletion lines before deleting from live configurations", async () => {
    render(<McpPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete filesystem" }));
    const operation = { action: "delete", id: "filesystem" };
    await waitFor(() => expect(api.previewMcpMutation).toHaveBeenCalledWith(operation));
    expect(screen.getByRole("heading", { name: "Review MCP configuration changes" })).toBeInTheDocument();
    expect(screen.getAllByTestId("mcp-diff-row-remove").length).toBe(2);
    expect(api.commitMcpMutation).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
      await Promise.resolve();
    });

    expect(api.commitMcpMutation).toHaveBeenCalledWith(operation, "a".repeat(64));
    await waitFor(() => expect(api.getMcpState).toHaveBeenCalledTimes(2));
  });
});
