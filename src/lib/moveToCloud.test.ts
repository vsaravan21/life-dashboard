import { describe, expect, it } from "vitest";
import { moveToCloud } from "./moveToCloud";
import type { Store } from "./store";
import type { Entry } from "./types";

function fakeStore(entries: Entry[] = []): Store & { entries: Entry[]; uploads: number } {
  let n = 0;
  const s = {
    mode: "demo" as const, entries, uploads: 0,
    async load() { return { entries: structuredClone(s.entries), prefs: { currency: "USD" } }; },
    async add(kind: never, data: never) { const e = { id: `new${++n}`, kind, data, createdAt: String(n) } as Entry; s.entries.push(e); return e as never; },
    async save() {}, async remove() {}, async setPrefs() {},
    async uploadPhoto() { s.uploads++; return `cloud/${s.uploads}.jpg`; },
    async photoUrl(ref: string) { return `data:image/png;base64,${btoa(ref)}`; },
    async removePhoto() {},
  };
  return s;
}
const e = (id: string, kind: string, data: object, createdAt = id) => ({ id, kind, data, createdAt }) as Entry;

describe("moveToCloud", () => {
  it("copies entries, uploads photos and relinks tasks to their lists", async () => {
    const local = fakeStore([
      e("t1", "todos", { text: "Milk", done: false, listId: "l1" }, "2"),
      e("l1", "lists", { title: "Groceries", color: "mint", created: "2026-10-01" }, "1"),
      e("j1", "journal", { caption: "Beach", date: "2026-03-22", photo: "idb:abc" }, "3"),
      e("tr", "trips", { place: "Cancun", start: "2026-03-21", end: "2026-03-28", photos: ["idb:1", "idb:2"] }, "4"),
      e("b1", "books", { title: "Becoming", status: "done", progress: 100, cover: "https://covers.openlibrary.org/b/id/1-L.jpg" }, "5"),
    ]);
    const cloud = fakeStore();
    const r = await moveToCloud(local, cloud, []);
    expect(r).toEqual({ moved: 5, skipped: 0, photos: 3 });
    const list = cloud.entries.find(x => x.kind === "lists")!;
    expect((cloud.entries.find(x => x.kind === "todos")!.data as { listId: string }).listId).toBe(list.id);
    expect((cloud.entries.find(x => x.kind === "trips")!.data as { photos: string[] }).photos).toEqual(["cloud/2.jpg", "cloud/3.jpg"]);
    expect((cloud.entries.find(x => x.kind === "books")!.data as { cover: string }).cover).toMatch(/^https:/);
  });

  it("skips what the account already has, so a second run adds nothing", async () => {
    const local = fakeStore([e("l1", "lists", { title: "Groceries", color: "mint", created: "2026-10-01" }), e("t1", "todos", { text: "Milk", done: false, listId: "l1" })]);
    const cloud = fakeStore();
    await moveToCloud(local, cloud, []);
    const again = await moveToCloud(local, cloud, cloud.entries.slice());
    expect(again).toEqual({ moved: 0, skipped: 2, photos: 0 });
    expect(cloud.entries).toHaveLength(2);
  });
});
