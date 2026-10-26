import type { Entry, FlightData } from "./types";

/** Places outside the US, by city name. Anything else (and any airport code) counts as the US. */
const ABROAD: Record<string, string> = {
  dubai: "UAE", "abu dhabi": "UAE", doha: "Qatar", singapore: "Singapore", india: "India", delhi: "India", "new delhi": "India", mumbai: "India",
  bangalore: "India", chennai: "India", kochi: "India", trivandrum: "India", "mexico city": "Mexico", cancun: "Mexico", tulum: "Mexico",
  london: "UK", paris: "France", berlin: "Germany", munich: "Germany", frankfurt: "Germany", amsterdam: "Netherlands", rome: "Italy",
  milan: "Italy", madrid: "Spain", barcelona: "Spain", lisbon: "Portugal", dublin: "Ireland", zurich: "Switzerland", istanbul: "Turkey",
  tokyo: "Japan", seoul: "South Korea", "hong kong": "Hong Kong", toronto: "Canada", vancouver: "Canada", montreal: "Canada",
};

/** "Trivandrum, India" → India; "Dubai" → UAE; "Seattle" → USA. */
export function countryOf(place: string) {
  const p = place.trim(), parts = p.split(",").map(x => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  if (parts.length > 1) return ABROAD[last] ?? (ABROAD[parts[0].toLowerCase()] || parts[parts.length - 1]);
  return ABROAD[p.toLowerCase()] ?? "USA";
}

export const isInternational = (f: FlightData) => countryOf(f.from) !== "USA" || countryOf(f.to) !== "USA";

/** "Mar 2026" for month-only dates, "Mar 21, 2026" for full ones. */
export function flightWhen(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, d ? { month: "short", day: "numeric" } : { month: "long" });
}

/** A flight is upcoming once its day, or for month-only dates its month, is still ahead. */
export const isUpcoming = (f: FlightData, today: string) => f.date.length === 7 ? f.date > today.slice(0, 7) : f.date > today;

export interface YearStats { year: string; flights: number; flown: number; upcoming: number; cities: number; international: number; countries: string[]; firsts: string[] }

export function yearStats(year: string, list: FlightData[], today: string): YearStats {
  const places = new Set(list.flatMap(f => [f.from, f.to]));
  const countries = [...new Set([...places].map(countryOf))].filter(c => c !== "USA");
  const upcoming = list.filter(f => isUpcoming(f, today)).length;
  return {
    year, flights: list.length, flown: list.length - upcoming, upcoming, cities: places.size,
    international: list.filter(isInternational).length, countries,
    firsts: list.map(f => f.note?.trim() ?? "").filter(Boolean),
  };
}

/** Flights grouped by year, newest year first; each year's flights in the order they happened. */
export function byYear(entries: Entry<"flights">[]) {
  const sorted = [...entries].sort((a, b) => a.data.date.localeCompare(b.data.date) || a.createdAt.localeCompare(b.createdAt));
  const years = [...new Set(sorted.map(f => f.data.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  return years.map(y => ({ year: y, flights: sorted.filter(f => f.data.date.startsWith(y)) }));
}

/** The years with the most flights (more than one on a tie), newest first. */
export function busiestYears(groups: { year: string; flights: unknown[] }[]) {
  const most = Math.max(0, ...groups.map(g => g.flights.length));
  return { years: groups.filter(g => g.flights.length === most).map(g => g.year), flights: most };
}
