import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FloatingApp } from "./FloatingApp.jsx";

const mocks = vi.hoisted(() => ({
  client: { list: vi.fn(), subscribe: vi.fn(), copy: vi.fn(), capture: vi.fn(), paste: vi.fn() },
}));
vi.mock("../lib/clipboard-api", () => ({
  createClipboardClient: () => mocks.client,
  clipboardErrorMessage: (error) => typeof error === "string" ? error : error.message,
}));
vi.mock("./FloatingBall", () => ({ FloatingBall: () => null }));

let state;
let entries;
let notify;
let messages;
let listeners;
let postMessage;
function sendState(patch = {}) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener({ data: { type: "floating:state", state } });
}
function setupUser() {
  const user = userEvent.setup();
  return new Proxy(user, {
    get(target, name) {
      const action = target[name];
      return typeof action === "function" ? (...args) => act(async () => { await action(...args); }) : action;
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("tokentracker_native_app", "1");
  listeners = new Set();
  messages = [];
  state = { expanded: false, isLight: true, date: "2026-09-14", todayTokens: null, exactTokens: null, todayCost: null, updatedAt: null };
  entries = [
    { id: "text-entry", kind: "text", text: "保留全文的文本记录", files: [], updatedAt: "2026-09-14T08:30:00+08:00", pinned: true },
    { id: "file-entry", kind: "files", text: "", files: [{ name: "说明.pdf", bytes: 1024 }], updatedAt: "2026-09-14T08:20:00+08:00" },
  ];
  mocks.client.list.mockImplementation(async ({ query = "", kind = "all", limit = 30 }) => {
    const items = entries.filter((entry) => (kind === "all" || entry.kind === kind) &&
      (entry.text.includes(query) || entry.files.some((file) => file.name.includes(query))));
    return { items: items.slice(0, limit), matched: items.length, total: entries.length, enabled: true };
  });
  mocks.client.subscribe.mockImplementation((callback) => { notify = callback; return () => { notify = null; }; });
  mocks.client.copy.mockResolvedValue(undefined);
  postMessage = vi.fn((message) => {
    const request = JSON.parse(message);
    messages.push(request);
    if (request.action === "ready") sendState();
    if (request.action === "toggle") sendState({ expanded: !state.expanded });
    if (request.action === "collapse") sendState({ expanded: false });
  });
  Object.defineProperty(window, "chrome", { configurable: true, value: { webview: {
    postMessage,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  } } });
});
afterEach(() => { delete window.chrome; });

describe("floating panel", () => {
  it("opens from the ball, follows native usage/currency updates and collapses with Escape", async () => {
    const user = setupUser();
    render(<FloatingApp />);
    expect(mocks.client.list).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "打开悬浮面板" }));
    expect(await screen.findByRole("dialog", { name: "随行面板" })).toBeInTheDocument();
    expect(screen.getByText("等待本地用量统计")).toBeInTheDocument();
    act(() => sendState({ todayTokens: "1.2M", exactTokens: "1,234,567", todayCost: "¥9.00", updatedAt: "2026-09-14T08:30:00+08:00" }));
    expect(screen.getByText("1.2M")).toHaveAttribute("title", "1,234,567");
    expect(screen.getByText("¥9.00")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开悬浮面板" })).toBeInTheDocument();
  });

  it("copies by record ID, filters by content and refreshes when background capture changes", async () => {
    const user = setupUser();
    state.expanded = true;
    render(<FloatingApp />);
    const record = await screen.findByRole("button", { name: "复制文本：保留全文的文本记录" });
    await user.click(record);
    expect(mocks.client.copy).toHaveBeenCalledWith(entries[0].id);
    expect(screen.getByRole("status")).toHaveTextContent("已复制到剪贴板");
    await user.click(screen.getByRole("button", { name: "文件", exact: true }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /复制文本/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "复制文件：说明.pdf" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全部", exact: true }));
    await user.type(screen.getByRole("textbox"), "新增记录");
    expect(await screen.findByText("没有找到匹配的记录")).toBeInTheDocument();
    entries.push({ ...entries[0], id: "new-entry", text: "新增记录" });
    act(() => notify());
    expect(await screen.findByRole("button", { name: "复制文本：新增记录" })).toBeInTheDocument();
  });

  it("shows copy failures without a success state and opens the complete clipboard", async () => {
    const user = setupUser();
    state.expanded = true;
    mocks.client.copy.mockRejectedValue(new Error("剪贴板被占用"));
    render(<FloatingApp />);
    await user.click(await screen.findByRole("button", { name: /复制文本/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("剪贴板被占用");
    expect(screen.queryByText("已复制到剪贴板")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全部记录" }));
    expect(messages).toContainEqual({ type: "floating:request", action: "clipboard" });
  });

  it("does not open on a drag gesture", async () => {
    const user = setupUser();
    render(<FloatingApp />);
    const ball = screen.getByRole("button", { name: "打开悬浮面板" });
    await user.pointer([{ target: ball, keys: "[MouseLeft>]", coords: { x: 44, y: 44 } },
      { target: ball, coords: { x: 60, y: 60 } }, { keys: "[/MouseLeft]" }]);
    expect(messages).toContainEqual({ type: "floating:request", action: "drag" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores late clipboard reads after collapsing and removes subscriptions on close", async () => {
    let complete;
    state.expanded = true;
    mocks.client.list.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const { unmount } = render(<FloatingApp />);
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => complete({ items: entries, total: 2, matched: 2 }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    expect(listeners.size).toBe(0);
    expect(notify).toBeNull();
  });
});
