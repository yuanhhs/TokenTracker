import { getLocalApiAuthHeaders } from "./local-api-auth";

type AnyRecord = Record<string, any>;

const ENDPOINT = "/functions/tokentracker-mcp";

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export async function getMcpState() {
  return parseResponse(await fetch(ENDPOINT, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }));
}

async function mutateMcp(body: AnyRecord) {
  const authHeaders = await getLocalApiAuthHeaders();
  return parseResponse(await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  }));
}

export function upsertMcpServer(server: AnyRecord) {
  return mutateMcp({ action: "upsert", server });
}

export function toggleMcpTarget(id: string, target: string, enabled: boolean) {
  return mutateMcp({ action: "toggle", id, target, enabled });
}

export function deleteMcpServer(id: string) {
  return mutateMcp({ action: "delete", id });
}

export function previewMcpMutation(operation: AnyRecord) {
  return mutateMcp({ action: "preview", operation });
}

export function commitMcpMutation(operation: AnyRecord, reviewToken: string) {
  return mutateMcp({ action: "commit", operation, reviewToken });
}
