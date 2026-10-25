import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Store } from "./store";
import { KINDS, type DataByKind, type Entry, type EntriesByKind, type Kind, type Prefs } from "./types";

const group = (entries: Entry[]): EntriesByKind => {
  const out = Object.fromEntries(KINDS.map(k => [k, []])) as unknown as EntriesByKind;
  for (const e of entries) (out[e.kind] as Entry[]).push(e);
  return out;
};

export interface Dashboard {
  ready: boolean;
  error: string | null;
  entries: EntriesByKind;
  prefs: Prefs;
  add<K extends Kind>(kind: K, data: DataByKind[K]): Promise<Entry<K> | undefined>;
  patch<K extends Kind>(entry: Entry<K>, data: Partial<DataByKind[K]>): Promise<void>;
  remove(entry: Entry): Promise<void>;
  setCurrency(currency: string): Promise<void>;
  store: Store;
}

/** Loads everything once, then applies changes optimistically and reconciles with the store. */
export function useDashboard(store: Store, notify: (msg: string) => void): Dashboard {
  const [list, setListState] = useState<Entry[]>([]);
  // Mirror of `list` so changes always build on the newest copy of an entry, even from stale closures.
  const listRef = useRef<Entry[]>([]);
  const setList = useCallback((next: Entry[] | ((l: Entry[]) => Entry[])) => {
    listRef.current = typeof next === "function" ? next(listRef.current) : next;
    setListState(listRef.current);
  }, []);
  const [prefs, setPrefs] = useState<Prefs>({ currency: "USD" });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { entries, prefs } = await store.load();
      setList(entries);
      setPrefs(prefs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data.");
    } finally {
      setReady(true);
    }
  }, [store]);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const fail = useCallback((e: unknown) => {
    notify(e instanceof Error && e.message ? e.message : "Couldn't save that. Check your connection and try again.");
    refresh();
  }, [notify, refresh]);

  const add = useCallback(async <K extends Kind>(kind: K, data: DataByKind[K]) => {
    try {
      const entry = await store.add(kind, data);
      setList(l => [...l, entry as Entry]);
      return entry;
    } catch (e) { fail(e); return undefined; }
  }, [store, fail]);

  const patch = useCallback(async <K extends Kind>(entry: Entry<K>, data: Partial<DataByKind[K]>) => {
    const base = listRef.current.find(e => e.id === entry.id) ?? entry;
    const next = { ...base, data: { ...base.data, ...data } } as Entry;
    setList(l => l.map(e => (e.id === entry.id ? next : e)));
    try { await store.save(next); } catch (e) { fail(e); }
  }, [store, fail]);

  const remove = useCallback(async (entry: Entry) => {
    setList(l => l.filter(e => e.id !== entry.id));
    try { await store.remove(entry); } catch (e) { fail(e); }
  }, [store, fail]);

  const setCurrency = useCallback(async (currency: string) => {
    setPrefs(p => ({ ...p, currency }));
    try { await store.setPrefs({ ...prefs, currency }); } catch (e) { fail(e); }
  }, [store, prefs, fail]);

  const entries = useMemo(() => group(list), [list]);

  return { ready, error, entries, prefs, add, patch, remove, setCurrency, store };
}
