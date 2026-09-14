import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClipboardClient } from "./clipboard-api";

type Listener = (event: MessageEvent) => void;
let listeners: Set<Listener>;
const postMessage = vi.fn();
const emit = (data: object) =>
  listeners.forEach((listener) => listener({ data } as MessageEvent));
const sent = () => JSON.parse(postMessage.mock.calls.at(-1)![0]);

beforeEach(() => {
  listeners = new Set();
  postMessage.mockReset();
  vi.stubGlobal("chrome", {
    webview: {
      postMessage,
      addEventListener: (_: string, listener: Listener) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) =>
        listeners.delete(listener),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Windows clipboard bridge", () => {
  it("correlates replies and removes listeners after completion", async () => {
    const client = createClipboardClient(true);
    const result = client.list({ query: "计划", kind: "text" });
    const request = sent();
    expect(request).toMatchObject({
      type: "clipboard:request",
      action: "list",
      args: { query: "计划", kind: "text" },
    });
    emit({ type: "clipboard:response", requestId: "another-window" });
    expect(listeners.size).toBe(1);
    emit({
      type: "clipboard:response",
      requestId: request.requestId,
      result: { snapshot: { items: [], total: 0 }, error: null },
    });
    await expect(result).resolves.toMatchObject({ items: [], total: 0 });
    expect(listeners.size).toBe(0);
  });

  it("propagates native failures instead of reporting copy success", async () => {
    const missingId = "missing-entry";
    const promise = createClipboardClient(true).copy(missingId);
    emit({
      type: "clipboard:response",
      requestId: sent().requestId,
      error: "not_found",
    });
    await expect(promise).rejects.toMatchObject({ code: "not_found" });
    expect(listeners.size).toBe(0);
  });

  it("allows cancelled file dialogs without pretending that a file was imported", async () => {
    const promise = createClipboardClient(true).importFiles();
    emit({
      type: "clipboard:response",
      requestId: sent().requestId,
      result: false,
    });
    await expect(promise).resolves.toBe(false);
  });

  it("subscribes to background captures and stops after unmount", () => {
    const callback = vi.fn();
    const unsubscribe = createClipboardClient(true).subscribe(callback);
    emit({ type: "clipboard:changed" });
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
    emit({ type: "clipboard:changed" });
    expect(callback).toHaveBeenCalledOnce();
  });

  it("times out a missing host reply and releases its event listener", async () => {
    vi.useFakeTimers();
    const promise = createClipboardClient(true).capture();
    const assertion = expect(promise).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(listeners.size).toBe(0);
  });
});
