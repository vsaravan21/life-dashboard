import { describe, expect, it } from "vitest";
import { planImport } from "./importFile";
import type { Entry } from "./types";

const none = { goalyears: [], goalcats: [], lookback: [] };
const entry = <T,>(kind: string, data: T) => ({ id: "x", kind, data, createdAt: "" }) as unknown as Entry<never>;

describe("planImport", () => {
  it("reads years, categories and months", () => {
    const plan = planImport(none, {
      goals: [{ year: 2026, categories: [{ title: "Health", color: "mint", items: [{ text: "Walk" }, { text: " Daily ", depth: 1, done: true }, { text: "" }] }] }],
      lookback: [{ year: 2026, month: 1, sections: [{ title: "Fun", items: [{ text: "Muir Woods" }] }], summary: "Good month" }],
    });
    expect(plan.years).toEqual([{ year: 2026 }]);
    expect(plan.cats[0]).toMatchObject({ year: 2026, title: "Health", color: "mint" });
    expect(plan.cats[0].items.map(i => [i.text, i.depth ?? 0, i.done])).toEqual([["Walk", 0, false], ["Daily", 1, true]]);
    expect(plan.months[0]).toMatchObject({ year: 2026, month: 1 });
    expect(plan.months[0].sections.map(s => s.title)).toEqual(["Fun", "Summary"]);
    expect(plan.months[0].sections[0].items[0]).toMatchObject({ text: "Muir Woods" });
  });

  it("skips what is already there, so importing twice adds nothing", () => {
    const have = {
      goalyears: [entry("goalyears", { year: 2026 })],
      goalcats: [entry("goalcats", { year: 2026, title: "Health", color: "mint", items: [] })],
      lookback: [entry("lookback", { year: 2026, month: 1, sections: [] })],
    } as never;
    const plan = planImport(have, {
      goals: [{ year: 2026, categories: [{ title: "health" }, { title: "Career" }] }],
      lookback: [{ year: 2026, month: 1 }, { year: 2026, month: 2 }],
    });
    expect(plan.years).toEqual([]);
    expect(plan.cats.map(c => c.title)).toEqual(["Career"]);
    expect(plan.months.map(m => m.month)).toEqual([2]);
    expect(plan.skipped).toBe(2);
  });

  it("adds flights, skipping ones already logged but keeping repeats of a route", () => {
    const have = { flights: [entry("flights", { date: "2026-06", from: "Seattle", to: "Los Angeles" })] } as never;
    const plan = planImport(have, { flights: [
      { date: "2026-06", from: "Seattle", to: "Los Angeles" },
      { date: "2026-06", from: "Seattle", to: "Los Angeles", reason: "Again" },
      { date: "2022-12", from: "San Francisco", to: "New York City", note: "First Solo Flight", reason: "" },
      { date: "Dec 2022", from: "x", to: "y" },
    ] });
    expect(plan.flights).toEqual([
      { date: "2026-06", from: "Seattle", to: "Los Angeles", reason: "Again" },
      { date: "2022-12", from: "San Francisco", to: "New York City", note: "First Solo Flight" },
    ]);
    expect(plan.skipped).toBe(1);
  });

  it("adds books by year, skipping titles already on the shelf", () => {
    const have = { books: [entry("books", { title: "Atomic Habits", status: "done", progress: 100 })] } as never;
    const plan = planImport(have, { books: [
      { title: "atomic habits", author: "James Clear", year: 2025 },
      { title: "Becoming", author: "Michelle Obama", year: 2026, thoughts: "Loved it" },
    ] });
    expect(plan.books).toEqual([{ title: "Becoming", author: "Michelle Obama", status: "done", progress: 100, finished: "2026", thoughts: "Loved it" }]);
    expect(plan.skipped).toBe(1);
  });

  it("rejects files that aren't goals files", () => {
    expect(() => planImport(none, { hello: 1 })).toThrow();
    expect(() => planImport(none, "nope")).toThrow();
  });
});
