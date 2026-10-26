/**
 * Photos for the browser-only store. They live in IndexedDB rather than
 * localStorage, which holds only about 5 MB; refs look like "idb:<id>".
 */
const DB = "life-dashboard-photos", STORE = "photos";
export const IDB_PREFIX = "idb:";

let db: Promise<IDBDatabase> | null = null;
function open() {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { db = null; reject(req.error ?? new Error("This browser can't store photos.")); };
  });
  return db;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const urls = new Map<string, string>();

export async function savePhoto(blob: Blob) {
  const id = crypto.randomUUID();
  await run("readwrite", s => s.put(blob, id));
  return IDB_PREFIX + id;
}

export async function photoObjectUrl(ref: string) {
  const hit = urls.get(ref);
  if (hit) return hit;
  const blob = await run<Blob | undefined>("readonly", s => s.get(ref.slice(IDB_PREFIX.length))).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(ref, url);
  return url;
}

export async function deletePhoto(ref: string) {
  const url = urls.get(ref);
  if (url) { URL.revokeObjectURL(url); urls.delete(ref); }
  await run("readwrite", s => s.delete(ref.slice(IDB_PREFIX.length))).catch(() => undefined);
}
