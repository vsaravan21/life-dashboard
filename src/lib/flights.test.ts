import { describe, expect, it } from "vitest";
import { busiestYears, byYear, countryOf, flightWhen, isInternational, isUpcoming, yearStats } from "./flights";
import type { Entry } from "./types";

const f = (date: string, from: string, to: string, extra = {}, createdAt = "") =>
  ({ id: date + from + to, kind: "flights", data: { date, from, to, ...extra }, createdAt }) as Entry<"flights">;

describe("flights", () => {
  it("knows which places are abroad", () => {
    expect(countryOf("Trivandrum, India")).toBe("India");
    expect(countryOf("Dubai")).toBe("UAE");
    expect(countryOf("Mexico City")).toBe("Mexico");
    expect(countryOf("Seattle")).toBe("USA");
    expect(countryOf("SFO")).toBe("USA");
    expect(isInternational({ date: "2026-12", from: "Orlando", to: "Berlin" })).toBe(true);
  });

  it("treats month-only flights as upcoming until their month", () => {
    expect(isUpcoming({ date: "2026-12", from: "a", to: "b" }, "2026-10-26")).toBe(true);
    expect(isUpcoming({ date: "2026-10", from: "a", to: "b" }, "2026-10-26")).toBe(false);
    expect(isUpcoming({ date: "2026-10-30", from: "a", to: "b" }, "2026-10-26")).toBe(true);
    expect(flightWhen("2026-03")).toMatch(/March/);
  });

  it("groups by year, newest first, keeping each year in order", () => {
    const g = byYear([f("2025-12", "Las Vegas", "Orlando", {}, "2"), f("2026-03", "Mexico City", "Cancun", {}, "4"), f("2026-03", "San Francisco", "Mexico City", {}, "3"), f("2025-01", "Orlando", "San Francisco", {}, "1")]);
    expect(g.map(x => x.year)).toEqual(["2026", "2025"]);
    expect(g[0].flights.map(x => x.data.from)).toEqual(["San Francisco", "Mexico City"]);
  });

  it("names every busiest year on a tie", () => {
    expect(busiestYears([{ year: "2026", flights: [1, 2] }, { year: "2025", flights: [1, 2] }, { year: "2024", flights: [1] }])).toEqual({ years: ["2026", "2025"], flights: 2 });
  });

  it("counts a year's flights, cities, countries and firsts", () => {
    const s = yearStats("2026", [
      { date: "2026-03", from: "San Francisco", to: "Mexico City", note: "First trip to Mexico" },
      { date: "2026-03", from: "Cancun", to: "San Francisco" },
      { date: "2026-12", from: "Orlando", to: "Berlin" },
    ], "2026-10-26");
    expect(s).toMatchObject({ flights: 3, flown: 2, upcoming: 1, cities: 5, international: 3, firsts: ["First trip to Mexico"] });
    expect(s.countries.sort()).toEqual(["Germany", "Mexico"]);
  });
});
