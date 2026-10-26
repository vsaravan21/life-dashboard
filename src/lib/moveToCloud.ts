/**
 * Copy what this browser holds into your account: every entry, with its photos
 * uploaded, and to-do tasks pointed at their lists' new ids. Entries already in
 * the account are skipped, so running it twice (or from two browsers) is safe.
 */
import type { Store } from "./store";
import type { DataByKind, Entry, Kind } from "./types";

const isWeb = (r: string) => /^https?:\/\//.test(r);
const stored = (r: string | undefined): r is string => !!r && r !== "none" && !isWeb(r);

/** An entry's data without photo refs or links to other entries, to tell whether two entries are the same thing. */
function fingerprint(e: Entry) {
  const d = { ...(e.data as unknown as Record<string, unknown>) };
  delete d.photo; delete d.photos; delete d.listId;
  if (e.kind === "books" && typeof d.cover === "string" && !isWeb(d.cover)) delete d.cover;
  return `${e.kind}:${JSON.stringify(d, Object.keys(d).sort())}`;
}

export interface MoveResult { moved: number; skipped: number; photos: number }

export async function moveToCloud(local: Store, cloud: Store, cloudEntries: Entry[], onProgress?: (done: number, total: number) => void): Promise<MoveResult> {
  const { entries } = await local.load();
  // Lists first, so tasks can point at their new ids.
  const order = [...entries].sort((a, b) => Number(b.kind === "lists") - Number(a.kind === "lists") || a.createdAt.localeCompare(b.createdAt));
  const have = new Map<string, Entry>();
  for (const e of cloudEntries) if (!have.has(fingerprint(e))) have.set(fingerprint(e), e);
  const ids = new Map<string, string>();
  const result: MoveResult = { moved: 0, skipped: 0, photos: 0 };

  const copyPhoto = async (ref: string) => {
    const url = await local.photoUrl(ref);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    result.photos++;
    return cloud.uploadPhoto(blob);
  };

  for (const [i, e] of order.entries()) {
    const twin = have.get(fingerprint(e));
    if (twin) {
      ids.set(e.id, twin.id);
      result.skipped++;
    } else {
      const data = structuredClone(e.data) as unknown as Record<string, unknown>;
      if (e.kind === "journal" && stored(data.photo as string)) data.photo = (await copyPhoto(data.photo as string)) ?? undefined;
      if (e.kind === "trips" && Array.isArray(data.photos))
        data.photos = (await Promise.all((data.photos as string[]).map(p => (stored(p) ? copyPhoto(p) : p)))).filter(Boolean);
      if (e.kind === "books" && stored(data.cover as string)) data.cover = (await copyPhoto(data.cover as string)) ?? "";
      if (e.kind === "todos" && typeof data.listId === "string") data.listId = ids.get(data.listId) ?? data.listId;
      const added = await cloud.add(e.kind as Kind, data as unknown as DataByKind[Kind]);
      ids.set(e.id, added.id);
      have.set(fingerprint(e), added);
      result.moved++;
    }
    onProgress?.(i + 1, order.length);
  }
  return result;
}
