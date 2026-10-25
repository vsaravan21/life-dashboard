import { useMemo, useState, type FormEvent } from "react";
import { Empty, Remove } from "../components/ui";
import { addDays, fmt, iso, parse, today } from "../lib/dates";
import type { GoogleEvent } from "../lib/google";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { GoogleControl } from "../sections/Calendar";
import { PageShell } from "./PageShell";

type Item =
  | { key: string; date: string; time: string; title: string; color?: string; source: "local"; entry: Entry<"events"> }
  | { key: string; date: string; time: string; title: string; color?: string; source: "google"; event: GoogleEvent };

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export function CalendarPage({ dash }: { dash: Dashboard }) {
  const t = today();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState(t);

  // Six full weeks, Sunday first, covering the shown month.
  const gridStart = addDays(month, -month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => iso(addDays(gridStart, i)));
  const from = days[0], to = iso(addDays(gridStart, 42));
  const g = useGoogleCalendar(from, to);

  const byDay = useMemo(() => {
    const items: Item[] = [
      ...dash.entries.events.filter(e => e.data.date >= from && e.data.date < to).map(e => ({
        key: e.id, date: e.data.date, time: e.data.time || "", title: e.data.title, source: "local" as const, entry: e,
      })),
      ...g.events.filter(e => e.date >= from && e.date < to).map(e => ({
        key: `g:${e.id}`, date: e.date, time: e.time, title: e.title, color: e.color, source: "google" as const, event: e,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
    const map = new Map<string, Item[]>();
    for (const it of items) map.set(it.date, [...(map.get(it.date) ?? []), it]);
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
  const addEvent = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget, f = new FormData(form);
    const title = String(f.get("title") || "").trim();
    if (!title) return;
    await dash.add("events", { title, date: selected, time: String(f.get("time") || "") });
    form.reset();
  };

  return (
    <PageShell path="/calendar" actions={<GoogleControl g={g} />}>
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
                        {it.time && <b>{it.time}</b>}{it.title}
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
          <form className="cal-add" onSubmit={addEvent}>
            <input name="title" placeholder="Add an event" aria-label="New event title" required />
            <input type="time" name="time" aria-label="Time (optional)" />
            <button className="btn primary" aria-label="Add event">Add</button>
          </form>
          {dayItems.length === 0 ? <Empty>Nothing planned.</Empty> : (
            <ul className="list">
              {dayItems.map(it => (
                <li key={it.key}>
                  <span className="time">{it.time || "all day"}</span>
                  <span className="grow1 t">
                    {it.source === "google" && it.event.link
                      ? <a className="plain" href={it.event.link} target="_blank" rel="noreferrer">{it.title}</a>
                      : it.title}
                    {it.source === "google" && <div className="sub"><i className="cal-dot" style={{ background: it.color || "var(--accent)" }} />{it.event.calendar}</div>}
                  </span>
                  {it.source === "local" && <Remove label={it.title} onClick={() => dash.remove(it.entry)} />}
                </li>
              ))}
            </ul>
          )}
          {g.status === "paused" && <p className="sub">Tap Sync Google Calendar to show your Google events.</p>}
        </aside>
      </div>
    </PageShell>
  );
}
