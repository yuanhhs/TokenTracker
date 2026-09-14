import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClipboardPage } from "./ClipboardPage.jsx";

const mocks = vi.hoisted(() => ({
  client: {
    native: true,
    list: vi.fn(),
    subscribe: vi.fn(),
    detail: vi.fn(),
    capture: vi.fn(),
    paste: vi.fn(),
    importFiles: vi.fn(),
    pin: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    setEnabled: vi.fn(),
    copy: vi.fn(),
    export: vi.fn(),
    openFolder: vi.fn(),
  },
  toast: vi.fn(),
}));
vi.mock("../lib/clipboard-api", () => ({
  createClipboardClient: () => mocks.client,
  clipboardErrorMessage: (error) =>
    typeof error === "string" ? error : error.message,
}));
vi.mock("../ui/components/Toast.jsx", () => ({ showToast: mocks.toast }));

let entries;
let notify;
let enabled;
function setupUser() {
  const user = userEvent.setup();
  return new Proxy(user, {
    get(target, name) {
      const action = target[name];
      return typeof action === "function"
        ? (...args) =>
            act(async () => {
              await action(...args);
            })
        : action;
    },
  });
}
function summary({ query = "", kind = "all", limit = 60 } = {}) {
  const filtered = entries.filter(
    (entry) =>
      (kind === "all" || entry.kind === kind) &&
      (!query ||
        entry.text.includes(query) ||
        entry.files.some((file) => file.name.includes(query))),
  );
  return {
    items: filtered.slice(0, limit),
    matched: filtered.length,
    total: entries.length,
    totalBytes: 216,
    enabled,
    counts: {
      all: entries.length,
      text: 1,
      image: 1,
      files: 1,
      pinned: entries.filter((entry) => entry.pinned).length,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  enabled = true;
  const base = {
    bytes: 72,
    width: 0,
    height: 0,
    characterCount: 6,
    createdAt: "2026-09-14T02:00:00Z",
    updatedAt: "2026-09-14T02:00:00Z",
    pinned: false,
    files: [],
    text: "",
  };
  entries = [
    { ...base, id: "text-1", kind: "text", text: "项目需求文档", pinned: true },
    {
      ...base,
      id: "image-1",
      kind: "image",
      width: 800,
      height: 600,
      previewUrl: "/fixture.png",
      files: [{ name: "截图.png", bytes: 72 }],
    },
    {
      ...base,
      id: "file-1",
      kind: "files",
      files: [{ name: "计划.md", bytes: 72 }],
    },
  ];
  mocks.client.native = true;
  mocks.client.list.mockImplementation(async (args) => summary(args));
  mocks.client.subscribe.mockImplementation((callback) => {
    notify = callback;
    return () => {
      notify = null;
    };
  });
  mocks.client.detail.mockResolvedValue({
    text: "项目需求文档\n完整的正文内容",
  });
  mocks.client.copy.mockResolvedValue(true);
  mocks.client.capture.mockResolvedValue(true);
  mocks.client.paste.mockResolvedValue(true);
  mocks.client.importFiles.mockResolvedValue(false);
  mocks.client.pin.mockImplementation(async (id, pinned) => {
    entries = entries.map((entry) =>
      entry.id === id ? { ...entry, pinned } : entry,
    );
    notify();
  });
  mocks.client.clear.mockImplementation(async () => {
    entries = entries.filter((entry) => entry.pinned);
    notify();
  });
  mocks.client.remove.mockImplementation(async (id) => {
    entries = entries.filter((entry) => entry.id !== id);
    notify();
  });
  mocks.client.setEnabled.mockImplementation(async (value) => {
    enabled = value;
    notify();
  });
});

describe("ClipboardPage", () => {
  it("loads persisted records and filters by content type and filename", async () => {
    const user = setupUser();
    render(<ClipboardPage />);
    expect(await screen.findByText("项目需求文档")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await user.click(
      within(screen.getByRole("group", { name: "按内容类型筛选" })).getByRole(
        "button",
        { name: /文件/ },
      ),
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    expect(screen.getByText("计划.md")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "不存在");
    expect(await screen.findByText("没有找到匹配的记录")).toBeInTheDocument();
  });

  it("pins a record and clears only unpinned history after confirmation", async () => {
    const user = setupUser();
    render(<ClipboardPage />);
    const file = (await screen.findByText("计划.md")).closest("article");
    await user.click(
      within(file).getByRole("button", { name: "置顶", exact: true }),
    );
    await waitFor(() =>
      expect(mocks.client.pin).toHaveBeenCalledWith("file-1", true),
    );
    await user.click(screen.getByRole("button", { name: "清空未置顶" }));
    expect(mocks.client.clear).not.toHaveBeenCalled();
    const confirmation = await screen.findByRole("dialog");
    expect(
      within(confirmation).getByText(/将删除 1 条未置顶记录/),
    ).toBeInTheDocument();
    await user.click(
      within(confirmation).getByRole("button", { name: "确认清空" }),
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(screen.getByText("项目需求文档")).toBeInTheDocument();
    expect(screen.getByText("计划.md")).toBeInTheDocument();
  });

  it("opens full text in an accessible preview and copies the stored entry", async () => {
    const user = setupUser();
    render(<ClipboardPage />);
    const card = (await screen.findByText("项目需求文档")).closest("article");
    await user.click(within(card).getByRole("button", { name: "预览内容" }));
    const dialog = await screen.findByRole("dialog", { name: "文本预览" });
    expect(within(dialog).getByText(/完整的正文内容/)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "复制", exact: true }),
    );
    expect(mocks.client.copy).toHaveBeenCalledWith("text-1");
    expect(mocks.toast).toHaveBeenCalledWith({ title: "已复制到剪贴板" });
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("reports copy failures without a success toast", async () => {
    const user = setupUser();
    mocks.client.copy.mockRejectedValueOnce(new Error("剪贴板忙碌"));
    render(<ClipboardPage />);
    const card = (await screen.findByText("项目需求文档")).closest("article");
    await user.click(
      within(card).getByRole("button", { name: "复制", exact: true }),
    );
    expect(mocks.toast).toHaveBeenCalledWith({ title: "剪贴板忙碌" });
    expect(mocks.toast).not.toHaveBeenCalledWith({ title: "已复制到剪贴板" });
  });

  it("persists the display preference and pauses automatic capture", async () => {
    const user = setupUser();
    render(<ClipboardPage />);
    await screen.findByText("项目需求文档");
    await user.click(screen.getByRole("button", { name: "列表视图" }));
    expect(localStorage.getItem("tt.clipboard.view")).toBe("list");
    await user.click(screen.getByRole("button", { name: "暂停记录" }));
    expect(await screen.findByText("自动记录已暂停")).toBeInTheDocument();
    expect(mocks.client.setEnabled).toHaveBeenCalledWith(false);
  });

  it("handles native background changes and releases its subscription", async () => {
    const view = render(<ClipboardPage />);
    await screen.findByText("项目需求文档");
    entries = [];
    act(() => notify());
    expect(await screen.findByText("让复制的内容留下来")).toBeInTheDocument();
    view.unmount();
    expect(notify).toBeNull();
  });

  it("preserves pinned data until the user confirms explicit deletion", async () => {
    const user = setupUser();
    render(<ClipboardPage />);
    const card = (await screen.findByText("项目需求文档")).closest("article");
    await user.click(within(card).getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("这是一条置顶记录，删除后无法恢复。"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(mocks.client.remove).not.toHaveBeenCalled();
    expect(screen.getByText("项目需求文档")).toBeInTheDocument();
  });

  it("keeps browser mode manual and allows normal pasting in search fields", async () => {
    const user = setupUser();
    mocks.client.native = false;
    render(<ClipboardPage />);
    await screen.findByText("项目需求文档");
    expect(screen.getByText("手动保存模式")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "暂停记录" }),
    ).not.toBeInTheDocument();
    const files = screen.getByText("计划.md").closest("article");
    expect(
      within(files).getByRole("button", { name: "复制", exact: true }),
    ).toBeDisabled();
    await user.click(screen.getByRole("searchbox"));
    await user.paste("搜索内容");
    expect(screen.getByRole("searchbox")).toHaveValue("搜索内容");
    expect(mocks.client.paste).not.toHaveBeenCalled();
  });
});
