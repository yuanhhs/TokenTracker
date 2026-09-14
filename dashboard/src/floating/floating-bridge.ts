export type FloatingState = {
  expanded: boolean;
  isLight: boolean;
  date: string;
  todayTokens: string | null;
  exactTokens: string | null;
  todayCost: string | null;
  updatedAt: string | null;
};

type WebView = {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
};

function bridge(): WebView | undefined {
  return (window as unknown as { chrome?: { webview?: WebView } }).chrome?.webview;
}

export function postFloating(action: "ready" | "toggle" | "collapse" | "drag" | "hide" | "dashboard" | "clipboard" | "refresh") {
  const host = bridge();
  if (!host) return false;
  host.postMessage(JSON.stringify({ type: "floating:request", action }));
  return true;
}

export function subscribeFloating(listener: (state: FloatingState) => void) {
  const host = bridge();
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "floating:state") listener(event.data.state);
  };
  host?.addEventListener("message", onMessage);
  return () => host?.removeEventListener("message", onMessage);
}

export function subscribeCursor(listener: (x: number, y: number) => void) {
  const host = bridge();
  const onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type === "floating:cursor" && Number.isFinite(data.x) && Number.isFinite(data.y))
      listener(data.x, data.y);
  };
  host?.addEventListener("message", onMessage);
  return () => host?.removeEventListener("message", onMessage);
}
