import { describe, expect, it } from "vitest";
import { streak } from "./ProjectsPage";

describe("streak", () => {
  it("counts days in a row up to today", () => {
    expect(streak(["2026-10-26", "2026-10-27", "2026-10-28"], "2026-10-28")).toBe(3);
  });
  it("still counts until tonight if today isn't logged yet", () => {
    expect(streak(["2026-10-26", "2026-10-27"], "2026-10-28")).toBe(2);
  });
  it("breaks on a missed day, across months too", () => {
    expect(streak(["2026-09-30", "2026-10-01", "2026-10-03"], "2026-10-03")).toBe(1);
    expect(streak(["2026-09-30", "2026-10-01"], "2026-10-01")).toBe(2);
    expect(streak(["2026-10-20"], "2026-10-28")).toBe(0);
  });
});
