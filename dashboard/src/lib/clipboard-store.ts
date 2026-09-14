// Browser previews use IndexedDB; the Windows host uses its own archive so records
// survive both WebView disposal and changes to the loopback server's port.
export type ClipboardKind = "text" | "image" | "files";
export type ClipboardFile = { name: string; bytes: number; blob?: Blob };
export type ClipboardEntry = {
  id: string;
  kind: ClipboardKind;
  text: string;
  bytes: number;
  characterCount: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  files: ClipboardFile[];
  previewUrl?: string | null;
};
type StoredEntry = ClipboardEntry & { fingerprint: string };
export type ClipboardQuery = { query?: string; kind?: string; limit?: number };
export type ClipboardSnapshot = {
  items: ClipboardEntry[];
  total: number;
  matched: number;
  totalBytes: number;
  counts: Record<string, number>;
  enabled: boolean;
  error?: string | null;
};

export class ClipboardError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_STORAGE_BYTES = 256 * 1024 * 1024;
let database: Promise<IDBDatabase> | null = null;

function openArchive(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(new ClipboardError("storage_unavailable"));
    const request = indexedDB.open("tokentracker-clipboard", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("entries", { keyPath: "id" });
    request.onerror = () => {
      database = null;
      reject(new ClipboardError("storage_unavailable"));
    };
    request.onblocked = () => {
      database = null;
      reject(new ClipboardError("storage_unavailable"));
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = null;
      };
      resolve(request.result);
    };
  });
  return database;
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, entries: StoredEntry[]) => T,
): Promise<T> {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries", mode);
    const store = tx.objectStore("entries");
    const request = store.getAll();
    let result: T;
    let error: unknown;
    request.onsuccess = () => {
      try {
        result = action(store, request.result as StoredEntry[]);
      } catch (cause) {
        error = cause;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(
        error ??
          new ClipboardError(
            tx.error?.name === "QuotaExceededError"
              ? "storage_full"
              : "storage_unavailable",
          ),
      );
  });
}

export async function browserClipboardList({
  query = "",
  kind = "all",
  limit = 60,
}: ClipboardQuery = {}): Promise<ClipboardSnapshot> {
  const entries = await transaction("readonly", (_, all) => all);
  const search = query.trim().toLocaleLowerCase();
  const filtered = entries
    .filter(
      (entry) =>
        (kind === "all" || entry.kind === kind) &&
        (!search ||
          entry.text.toLocaleLowerCase().includes(search) ||
          entry.files.some((file) =>
            file.name.toLocaleLowerCase().includes(search),
          )),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id),
    );
  const counts: Record<string, number> = {
    all: entries.length,
    text: 0,
    image: 0,
    files: 0,
    pinned: 0,
  };
  for (const entry of entries) {
    counts[entry.kind]++;
    if (entry.pinned) counts.pinned++;
  }
  return {
    items: filtered
      .slice(0, Math.min(1000, Math.max(1, limit)))
      .map((entry) => ({
        ...entry,
        text: Array.from(entry.text).slice(0, 2000).join(""),
        files: entry.files.map(({ name, bytes }) => ({ name, bytes })),
        previewUrl:
          entry.kind === "image" && entry.files[0]?.blob
            ? URL.createObjectURL(entry.files[0].blob)
            : null,
      })),
    total: entries.length,
    matched: filtered.length,
    counts,
    enabled: false,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  };
}

export function releaseClipboardPreviews(snapshot?: ClipboardSnapshot | null) {
  for (const entry of snapshot?.items ?? []) {
    if (entry.previewUrl?.startsWith("blob:"))
      URL.revokeObjectURL(entry.previewUrl);
  }
}

export function browserClipboardGet(id: string): Promise<StoredEntry> {
  return transaction("readonly", (_, entries) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) throw new ClipboardError("not_found");
    return entry;
  });
}

async function add(entry: Omit<StoredEntry, "fingerprint">): Promise<void> {
  if (entry.bytes > MAX_ENTRY_BYTES) throw new ClipboardError("too_large");
  const hashParts: BlobPart[] = [entry.kind, "\0", entry.text];
  for (const file of entry.files) {
    if (entry.kind === "files")
      hashParts.push("\0", file.name, "\0", String(file.bytes), "\0");
    if (file.blob) hashParts.push(file.blob);
  }
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        await new Blob(hashParts).arrayBuffer(),
      ),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await transaction("readwrite", (store, entries) => {
    const existing = entries.find((item) => item.fingerprint === fingerprint);
    if (existing) {
      store.put({ ...existing, updatedAt: entry.updatedAt });
      return;
    }
    if (
      entries.length >= 1000 ||
      entries.reduce((sum, item) => sum + item.bytes, 0) + entry.bytes >
        MAX_STORAGE_BYTES
    )
      throw new ClipboardError("storage_full");
    store.put({ ...entry, fingerprint });
  });
  void navigator.storage?.persist?.().catch(() => false);
}

function newEntry(kind: ClipboardKind): ClipboardEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    text: "",
    bytes: 0,
    characterCount: 0,
    width: 0,
    height: 0,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    files: [],
  };
}

export async function browserClipboardAddText(text: string) {
  if (!text.trim()) throw new ClipboardError("empty");
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > 1024 * 1024) throw new ClipboardError("too_large");
  await add({
    ...newEntry("text"),
    text,
    bytes,
    characterCount: Array.from(text).length,
  });
}

export async function browserClipboardAddFiles(files: File[]) {
  if (!files.length || files.length > 32)
    throw new ClipboardError("unsupported");
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  if (bytes > MAX_ENTRY_BYTES) throw new ClipboardError("too_large");
  const image =
    files.length === 1 &&
    /^(image\/(png|jpeg|webp|gif|bmp))$/i.test(files[0].type);
  let width = 0,
    height = 0;
  if (image) {
    const bitmap = await createImageBitmap(files[0]);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
    if (width * height > 40_000_000) throw new ClipboardError("too_large");
  }
  await add({
    ...newEntry(image ? "image" : "files"),
    bytes,
    width,
    height,
    files: files.map((file) => ({
      name: file.name,
      bytes: file.size,
      blob: file,
    })),
  });
}

export async function browserClipboardMutate(
  action: "pin" | "delete" | "clear",
  id?: string,
  pinned?: boolean,
) {
  await transaction("readwrite", (store, entries) => {
    if (action === "clear") {
      entries
        .filter((entry) => !entry.pinned)
        .forEach((entry) => store.delete(entry.id));
      return;
    }
    const entry = entries.find((item) => item.id === id);
    if (!entry) throw new ClipboardError("not_found");
    if (action === "pin") store.put({ ...entry, pinned: Boolean(pinned) });
    else store.delete(entry.id);
  });
}
