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
    expect(plan.months[0]).toMatchObject({ year: 2026, month: 1, summary: "Good month" });
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

  it("rejects files that aren't goals files", () => {
    expect(() => planImport(none, { hello: 1 })).toThrow();
    expect(() => planImport(none, "nope")).toThrow();
  });
});
