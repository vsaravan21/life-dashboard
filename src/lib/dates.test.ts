import { describe, expect, it } from "vitest";
import { by, dayOfYear, daysBetween, daysInYear, iso, isoWeek, parse } from "./dates";

describe("dates", () => {
  it("round-trips local dates", () => {
    expect(iso(parse("2026-10-25"))).toBe("2026-10-25");
  });

  it("counts days across months and DST", () => {
    expect(daysBetween("2026-10-25", "2026-12-18")).toBe(54);
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetween("2026-10-25", "2026-10-24")).toBe(-1);
  });

  it("knows the day of year and leap years", () => {
    expect(dayOfYear(parse("2026-10-25"))).toBe(298);
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
  });

  it("computes ISO weeks", () => {
    expect(isoWeek(parse("2026-10-25"))).toBe(43);
    expect(isoWeek(parse("2027-01-01"))).toBe(53);
    expect(isoWeek(parse("2026-01-01"))).toBe(1);
  });

  it("sorts empty values last", () => {
    const rows = [{ due: "" }, { due: "2026-10-30" }, { due: "2026-10-01" }];
    expect(rows.sort(by("due")).map(r => r.due)).toEqual(["2026-10-01", "2026-10-30", ""]);
  });
});
