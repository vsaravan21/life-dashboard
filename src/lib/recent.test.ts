import { describe, expect, it } from "vitest";
import { newestFirst, touched } from "./recent";
import type { Entry } from "./types";

const todo = (id: string, createdAt: string, updatedAt?: number) =>
  ({ id, kind: "todos", createdAt, data: { text: id, done: false, ...(updatedAt ? { updatedAt } : {}) } }) as Entry;

describe("newestFirst", () => {
  it("puts the newest entry first", () => {
    const list = [todo("a", "2026-01-01T00:00:00Z"), todo("b", "2026-01-03T00:00:00Z"), todo("c", "2026-01-02T00:00:00Z")];
    expect(list.sort(newestFirst).map(e => e.id)).toEqual(["b", "c", "a"]);
  });
  it("counts an edit as recent", () => {
    const edited = todo("old", "2026-01-01T00:00:00Z", Date.parse("2026-02-01T00:00:00Z"));
    const list = [todo("new", "2026-01-10T00:00:00Z"), edited];
    expect(list.sort(newestFirst).map(e => e.id)).toEqual(["old", "new"]);
  });
  it("falls back to creation time when updatedAt is missing or bad", () => {
    const e = { ...todo("x", "2026-01-05T00:00:00Z"), data: { updatedAt: "nope" } } as unknown as Entry;
    expect(touched(e)).toBe(Date.parse("2026-01-05T00:00:00Z"));
  });
});
