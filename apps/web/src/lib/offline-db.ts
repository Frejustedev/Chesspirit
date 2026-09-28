"use client";

/** Petit stockage IndexedDB (sans dépendance) pour l'arbitrage hors ligne. */
const DB = "chesspirit-arbitrage";
const STORES = ["packs", "queue"] as const;
type Store = (typeof STORES)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES)
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: Store,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const idbGet = <T>(store: Store, key: string) =>
  tx<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbSet = (store: Store, key: string, value: unknown) =>
  tx(store, "readwrite", (s) => s.put(value, key));
export const idbDelete = (store: Store, key: string) =>
  tx(store, "readwrite", (s) => s.delete(key));
export async function idbEntries<T>(store: Store): Promise<[string, T][]> {
  const keys = (await tx<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys())) as string[];
  const values = await tx<T[]>(store, "readonly", (s) => s.getAll());
  return keys.map((k, i) => [k, values[i]!]);
}
