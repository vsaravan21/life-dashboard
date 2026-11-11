import type { Entry } from "./types";

/** When an entry was last created or edited, in ms: its `updatedAt` if it keeps one, otherwise when it was made. */
export const touched = (e: Entry): number => {
  const u = (e.data as { updatedAt?: unknown }).updatedAt;
  return typeof u === "number" && Number.isFinite(u) ? u : Date.parse(e.createdAt) || 0;
};

/** Sort comparator: the most recently created or edited entry first. */
export const newestFirst = (a: Entry, b: Entry) => touched(b) - touched(a);
