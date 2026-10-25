import { useMemo, useState } from "react";
import { EventEditor, type EditTarget } from "../components/EventEditor";
import { Empty } from "../components/ui";
import { addDays, daysBetween, fmt, iso, parse, today } from "../lib/dates";
import { timeRange } from "../lib/eventDraft";
import type { GoogleEvent } from "../lib/google";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { GoogleControl } from "../sections/Calendar";
import { PageShell } from "./PageShell";

interface Base { key: string; date: string; time: string; endDate: string; endTime: string; allDay: boolean; title: string; color?: string }
type Item = Base & ({ source: "local"; entry: Entry<"events"> } | { source: "google"; event: GoogleEvent });

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export function CalendarPage({ dash }: { dash: Dashboard }) {
  const t = today();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState(t);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  // Six full weeks, Sunday first, covering the shown month.
  const gridStart = addDays(month, -month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => iso(addDays(gridStart, i)));
  const from = days[0], to = iso(addDays(gridStart, 42));
  const g = useGoogleCalendar(from, to);

  const byDay = useMemo(() => {
    const items: Item[] = [
      ...dash.entries.events.map(e => ({
        key: e.id, date: e.data.date, time: e.data.time || "", endDate: e.data.endDate || e.data.date, endTime: e.data.endTime || "",
        allDay: e.data.allDay ?? !e.data.time, title: e.data.title, source: "local" as const, entry: e,
      })),
      ...g.events.map(e => ({
        key: `g:${e.id}`, date: e.date, time: e.time, endDate: e.endDate, endTime: e.endTime, allDay: e.allDay,
        title: e.title, color: e.color, source: "google" as const, event: e,
      })),
    ].filter(it => it.endDate >= from && it.date < to)
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    // An event that spans days shows on each of them; a timed one that ends at midnight doesn't spill into the next day.
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const last = !it.allDay && it.endDate > it.date && it.endTime === "00:00" ? iso(addDays(parse(it.endDate), -1)) : it.endDate;
      for (let i = 0, n = Math.min(daysBetween(it.date, last), 60); i <= n; i++) {
        const day = iso(addDays(parse(it.date), i));
        map.set(day, [...(map.get(day) ?? []), it]);
      }
    }
    return map;
  }, [dash.entries.events, g.events, from, to]);

  const go = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => { setMonth(firstOfMonth(new Date())); setSelected(t); };
  const pick = (d: string) => {
    setSelected(d);
    const pd = parse(d);
    if (pd.getMonth() !== month.getMonth()) setMonth(firstOfMonth(pd));
  };

  const dayItems = byDay.get(selected) ?? [];
  const open = (it: Item) => setEditing(it.source === "local" ? { kind: "local", entry: it.entry } : { kind: "google", event: it.event });

  return (
    <PageShell path="/calendar" actions={<>
      <GoogleControl g={g} />
      <button className="btn primary" onClick={() => setEditing({ kind: "new", date: selected })}>+ New event</button>
    </>}>
      {g.error && <div className="notice"><span className="err">{g.error}</span></div>}
      <div className="cal-layout">
        <section className="glass cal-month">
          <div className="cal-bar">
            <h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <div className="cal-nav">
              <button className="btn sm" onClick={goToday}>Today</button>
              <button className="btn sm icon" aria-label="Previous month" onClick={() => go(-1)}>‹</button>
              <button className="btn sm icon" aria-label="Next month" onClick={() => go(1)}>›</button>
            </div>
          </div>
          <div className="cal-grid" role="grid" aria-label="Month">
            {days.slice(0, 7).map(d => (
              <div key={`h${d}`} className="cal-dow" role="columnheader">{parse(d).toLocaleDateString(undefined, { weekday: "short" })}</div>
            ))}
            {days.map(d => {
              const items = byDay.get(d) ?? [];
              const out = parse(d).getMonth() !== month.getMonth();
              return (
                <button key={d} role="gridcell" aria-selected={d === selected}
                  className={"cal-day" + (out ? " out" : "") + (d === t ? " today" : "") + (d === selected ? " sel" : "")}
                  onClick={() => pick(d)} aria-label={`${fmt(d, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} events`}>
                  <span className="cal-num">{parse(d).getDate()}</span>
                  <span className="cal-chips">
                    {items.slice(0, 3).map(it => (
                      <span key={it.key} className="cal-chip">
                        <i className="cal-dot" style={{ background: it.color || "var(--accent)" }} />
                        {it.time && !it.allDay && it.date === d && <b>{it.time}</b>}{it.title}
                      </span>
                    ))}
                    {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
                  </span>
                  <span className="cal-dots" aria-hidden="true">{items.slice(0, 4).map(it => <i key={it.key} style={{ background: it.color || "var(--accent)" }} />)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="glass cal-side">
          <div className="label">{selected === t ? "Today" : fmt(selected, { weekday: "long" })}</div>
          <h2>{fmt(selected, { month: "long", day: "numeric", year: "numeric" })}</h2>
          <button className="btn cal-add-btn" onClick={() => setEditing({ kind: "new", date: selected })}>+ Add an event on {fmt(selected, { month: "short", day: "numeric" })}</button>
          {dayItems.length === 0 ? <Empty>Nothing planned.</Empty> : (
            <ul className="list cal-items">
              {dayItems.map(it => (
                <li key={it.key}>
                  <button className="cal-item" onClick={() => open(it)}>
                    <i className="cal-bar-color" style={{ background: it.color || "var(--accent)" }} />
                    <span className="grow1">
                      <span className="t">{it.title}</span>
                      <span className="sub">{timeRange(it)}{it.source === "google" ? ` · ${it.event.calendar}` : " · Dashboard"}</span>
                      {(it.source === "google" ? it.event.location : it.entry.data.location) &&
                        <span className="sub">{it.source === "google" ? it.event.location : it.entry.data.location}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {g.status === "paused" && <p className="sub">Tap Sync Google Calendar to show your Google events.</p>}
        </aside>
      </div>
      {editing && <EventEditor target={editing} dash={dash} g={g} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}
