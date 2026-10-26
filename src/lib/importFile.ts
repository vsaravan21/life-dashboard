/**
 * Import goals and Looking Back months from a JSON file, so personal data can
 * be loaded into the browser without ever being bundled into the public site.
 *
 * {
 *   "goals":    [{ "year": 2026, "categories": [{ "title": "Health", "color": "mint", "items": [{ "text": "...", "depth": 1, "done": false }] }] }],
 *   "lookback": [{ "year": 2026, "month": 1, "sections": [{ "title": "Health", "items": [{ "text": "..." }] }], "summary": "..." }]
 * }
 */
import { newId } from "../components/Outline";
import type { EntriesByKind, FlightData, GoalCatData, GoalYearData, LookbackData, OutlineItem } from "./types";

interface FileItem { text?: unknown; depth?: unknown; done?: unknown }
interface ImportFile {
  goals?: { year?: unknown; categories?: { title?: unknown; color?: unknown; items?: FileItem[] }[] }[];
  lookback?: { year?: unknown; month?: unknown; sections?: { title?: unknown; items?: FileItem[] }[]; summary?: unknown }[];
  flights?: { date?: unknown; from?: unknown; to?: unknown; reason?: unknown; note?: unknown; airline?: unknown; number?: unknown }[];
}

export interface ImportPlan { years: GoalYearData[]; cats: GoalCatData[]; months: LookbackData[]; flights: FlightData[]; skipped: number }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const year = (v: unknown) => (Number.isInteger(v) && (v as number) > 1900 && (v as number) < 3000 ? (v as number) : null);
const items = (list: FileItem[] | undefined, checks: boolean): OutlineItem[] =>
  (Array.isArray(list) ? list : []).flatMap(i => {
    const text = str(i?.text);
    if (!text) return [];
    const depth = Math.max(0, Math.min(2, Number(i.depth) || 0));
    return [{ id: newId(), text, ...(depth ? { depth } : {}), ...(checks ? { done: i.done === true } : {}) }];
  });

/** What to add from a file: only years, categories (by year and title) and months not already there. */
export function planImport(have: Partial<Pick<EntriesByKind, "goalyears" | "goalcats" | "lookback" | "flights">>, raw: unknown): ImportPlan {
  if (!raw || typeof raw !== "object") throw new Error("That file isn't a goals file.");
  const file = raw as ImportFile;
  if (!Array.isArray(file.goals) && !Array.isArray(file.lookback) && !Array.isArray(file.flights)) throw new Error("That file has no goals, months or flights in it.");

  const plan: ImportPlan = { years: [], cats: [], months: [], flights: [], skipped: 0 };
  const years = new Set((have.goalyears ?? []).map(y => y.data.year));
  const cats = new Set((have.goalcats ?? []).map(c => `${c.data.year}|${c.data.title.toLowerCase()}`));
  const months = new Set((have.lookback ?? []).map(m => `${m.data.year}-${m.data.month}`));

  for (const g of file.goals ?? []) {
    const y = year(g?.year);
    if (!y) continue;
    if (!years.has(y)) { years.add(y); plan.years.push({ year: y }); }
    for (const c of g.categories ?? []) {
      const title = str(c?.title);
      if (!title) continue;
      const key = `${y}|${title.toLowerCase()}`;
      if (cats.has(key)) { plan.skipped++; continue; }
      cats.add(key);
      plan.cats.push({ year: y, title, color: str(c.color) || "periwinkle", items: items(c.items, true) });
    }
  }
  for (const m of file.lookback ?? []) {
    const y = year(m?.year), month = Number(m?.month);
    if (!y || !Number.isInteger(month) || month < 1 || month > 12) continue;
    if (months.has(`${y}-${month}`)) { plan.skipped++; continue; }
    months.add(`${y}-${month}`);
    const sections = (m.sections ?? []).map(s => ({ id: newId(), title: str(s?.title), items: items(s?.items, false) }));
    // A month's summary becomes its own section, since cards show only sections.
    if (str(m.summary)) sections.push({ id: newId(), title: "Summary", items: items([{ text: m.summary }], false) });
    plan.months.push({ year: y, month, sections: sections.length ? sections : [{ id: newId(), title: "", items: [] }] });
  }
  // The same route can be flown twice in a month, so count matches rather than just checking for one.
  const flightKey = (f: { date: string; from: string; to: string }) => `${f.date}|${f.from.toLowerCase()}|${f.to.toLowerCase()}`;
  const flown = new Map<string, number>();
  for (const f of have.flights ?? []) flown.set(flightKey(f.data), (flown.get(flightKey(f.data)) ?? 0) + 1);
  for (const f of file.flights ?? []) {
    const date = str(f?.date), from = str(f?.from), to = str(f?.to);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date) || !from || !to) continue;
    const key = flightKey({ date, from, to }), left = flown.get(key) ?? 0;
    if (left > 0) { flown.set(key, left - 1); plan.skipped++; continue; }
    const extra = Object.fromEntries((["reason", "note", "airline", "number"] as const).map(k => [k, str(f[k])]).filter(([, v]) => v));
    plan.flights.push({ date, from, to, ...extra });
  }
  return plan;
}
