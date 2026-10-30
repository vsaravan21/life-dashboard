import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extFor } from "./media";
import { deletePhoto, IDB_PREFIX, photoObjectUrl, savePhoto } from "./photoDb";
import type { DataByKind, Entry, Kind, Prefs } from "./types";

/**
 * Where entries are kept. The app talks only to this interface, so the
 * web site and a future native app share one data layer.
 */
export interface Store {
  mode: "cloud" | "demo";
  load(): Promise<{ entries: Entry[]; prefs: Prefs }>;
  add<K extends Kind>(kind: K, data: DataByKind[K]): Promise<Entry<K>>;
  /** Replace an entry's data with the given object. */
  save(entry: Entry): Promise<void>;
  remove(entry: Entry): Promise<void>;
  setPrefs(prefs: Prefs): Promise<void>;
  /** Store a photo (or a trip video) and return the reference to keep in an entry. */
  uploadPhoto(file: Blob): Promise<string>;
  /** A displayable URL for a stored photo reference. `fresh` skips any saved link, for when one stopped working. */
  photoUrl(ref: string, fresh?: boolean): Promise<string | null>;
  /** Delete a stored photo (entries removed with `remove` take their photos with them). */
  removePhoto(ref: string): Promise<void>;
}

const DEFAULT_PREFS: Prefs = { currency: "USD" };

/** Every photo an entry holds: a journal moment's photo, a trip's slides, or a book cover you added. */
const photosOf = (entry: Entry): string[] =>
  entry.kind === "journal" ? [(entry.data as DataByKind["journal"]).photo, ...((entry.data as DataByKind["journal"]).photos ?? [])].filter((p): p is string => !!p)
    : entry.kind === "trips" ? (entry.data as DataByKind["trips"]).photos ?? []
    : entry.kind === "projects" ? ((entry.data as DataByKind["projects"]).cards ?? []).flatMap(c => [...c.media, ...c.files.map(f => f.ref)])
    : entry.kind === "books" ? [(entry.data as DataByKind["books"]).cover].filter((c): c is string => !!c && c !== "none" && !/^https?:/.test(c))
    : [];

/* ---------- Supabase ---------- */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Set VITE_SIGN_IN=off to skip sign-in and keep entries in the browser, even when keys are present. */
const signInOn = import.meta.env.VITE_SIGN_IN !== "off";

export const supabase: SupabaseClient | null = signInOn && url && anonKey ? createClient(url, anonKey) : null;

type Row = { id: string; kind: Kind; data: Entry["data"]; created_at: string };
const toEntry = (r: Row): Entry => ({ id: r.id, kind: r.kind, data: r.data, createdAt: r.created_at });

/** Signed photo links last a week and are kept in this browser, so a photo keeps the same link and the browser's cache can serve it. */
const SIGN_SECONDS = 7 * 24 * 3600;
const DAY = 24 * 3600_000;

export function cloudStore(client: SupabaseClient, userId: string): Store {
  const cacheKey = `life-dashboard:links:${userId}`;
  const urlCache = new Map<string, { url: string; expires: number }>();
  try {
    for (const [ref, v] of Object.entries(JSON.parse(localStorage.getItem(cacheKey) ?? "{}") as Record<string, { url: string; expires: number }>))
      if (v.expires > Date.now() + DAY) urlCache.set(ref, v);
  } catch { /* no saved links */ }
  const keep = () => { try { localStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(urlCache))); } catch { /* storage full or blocked: links just aren't kept */ } };

  // Photos asked for in the same moment are signed together in one request, instead of one request each.
  let waiting = new Map<string, ((url: string | null) => void)[]>();
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  const signAll = async () => {
    const batch = waiting;
    waiting = new Map();
    timer = 0;
    const refs = [...batch.keys()];
    for (let i = 0; i < refs.length; i += 100) {
      const part = refs.slice(i, i + 100);
      // A failed request answers "no link" for its photos; each one asks again shortly.
      const { data, error } = await client.storage.from("journal").createSignedUrls(part, SIGN_SECONDS)
        .catch(e => ({ data: null, error: e as Error }));
      const found = new Map((error ? [] : data ?? []).filter(d => d.signedUrl && !d.error).map(d => [d.path, d.signedUrl]));
      for (const ref of part) {
        const url = found.get(ref) ?? null;
        if (url) urlCache.set(ref, { url, expires: Date.now() + SIGN_SECONDS * 1000 });
        for (const done of batch.get(ref) ?? []) done(url);
      }
    }
    keep();
  };
  return {
    mode: "cloud",
    async load() {
      const [entries, prefs] = await Promise.all([
        client.from("entries").select("id, kind, data, created_at").order("created_at"),
        client.from("prefs").select("currency").maybeSingle(),
      ]);
      if (entries.error) throw entries.error;
      return { entries: (entries.data as Row[]).map(toEntry), prefs: { ...DEFAULT_PREFS, ...(prefs.data ?? {}) } };
    },
    async add(kind, data) {
      const { data: row, error } = await client.from("entries").insert({ kind, data }).select("id, kind, data, created_at").single();
      if (error) throw error;
      return toEntry(row as Row) as Entry<typeof kind>;
    },
    async save(entry) {
      const { error } = await client.from("entries").update({ data: entry.data }).eq("id", entry.id);
      if (error) throw error;
    },
    async remove(entry) {
      const { error } = await client.from("entries").delete().eq("id", entry.id);
      if (error) throw error;
      const photos = photosOf(entry);
      if (photos.length) await client.storage.from("journal").remove(photos);
    },
    async setPrefs(prefs) {
      const { error } = await client.from("prefs").upsert({ user_id: userId, ...prefs });
      if (error) throw error;
    },
    async uploadPhoto(file) {
      const path = `${userId}/${crypto.randomUUID()}.${extFor(file.type, (file as File).name)}`;
      // A stored file never changes (each upload gets a new name), so browsers may keep it for a year.
      const { error } = await client.storage.from("journal").upload(path, file, { contentType: file.type || "application/octet-stream", cacheControl: "31536000" });
      if (error) throw error;
      return path;
    },
    async photoUrl(ref, fresh) {
      const hit = urlCache.get(ref);
      if (hit && !fresh && hit.expires > Date.now() + DAY) return hit.url;
      return new Promise(resolve => {
        waiting.set(ref, [...(waiting.get(ref) ?? []), resolve]);
        timer ||= setTimeout(() => void signAll(), 15);
      });
    },
    async removePhoto(ref) {
      await client.storage.from("journal").remove([ref]);
    },
  };
}

/* ---------- Demo (this browser only) ---------- */

const KEY = "life-dashboard:v1";

type DemoState = { entries: Entry[]; prefs: Prefs };

function readDemo(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state = JSON.parse(raw) as DemoState;
      // Earlier versions started with sample entries flagged `example`; drop any that are left.
      return { ...state, entries: state.entries.filter(e => !(e.data as { example?: boolean }).example) };
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return { entries: [], prefs: DEFAULT_PREFS };
}

export function demoStore(): Store {
  let state = readDemo();
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      throw new Error("This browser's storage is full. Remove some photos and try again.");
    }
  };
  return {
    mode: "demo",
    async load() {
      return structuredClone(state);
    },
    async add(kind, data) {
      const entry = { id: crypto.randomUUID(), kind, data, createdAt: new Date().toISOString() } as Entry<typeof kind>;
      state = { ...state, entries: [...state.entries, entry as Entry] };
      write();
      return entry;
    },
    async save(entry) {
      state = { ...state, entries: state.entries.map(e => (e.id === entry.id ? entry : e)) };
      write();
    },
    async remove(entry) {
      state = { ...state, entries: state.entries.filter(e => e.id !== entry.id) };
      write();
      for (const p of photosOf(entry)) if (p.startsWith(IDB_PREFIX)) await deletePhoto(p);
    },
    async setPrefs(prefs) {
      state = { ...state, prefs };
      write();
    },
    async uploadPhoto(file) {
      try { return await savePhoto(file); }
      catch { throw new Error("This browser couldn't save that file. It may be out of space or in private mode."); }
    },
    async photoUrl(ref) {
      // Older journal photos were kept inline as data: URLs.
      return ref.startsWith(IDB_PREFIX) ? photoObjectUrl(ref) : ref;
    },
    async removePhoto(ref) {
      if (ref.startsWith(IDB_PREFIX)) await deletePhoto(ref);
    },
  };
}
