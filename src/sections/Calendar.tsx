import { Fragment } from "react";
import { AddForm, DateField, Empty, ExampleTag, Panel, Remove } from "../components/ui";
import { addDays, daysBetween, fmt, iso, parse, today } from "../lib/dates";
import type { GoogleEvent } from "../lib/google";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useGoogleCalendar, type GoogleCalendar } from "../lib/useGoogleCalendar";

type Item =
  | { key: string; date: string; time: string; title: string; source: "local"; entry: Entry<"events"> }
  | { key: string; date: string; time: string; title: string; source: "google"; event: GoogleEvent };

function GoogleControl({ g }: { g: GoogleCalendar }) {
  if (g.status === "unavailable") return null;
  if (g.status === "on") return <button className="btn sm" onClick={g.disconnect} title="Stop showing Google Calendar events">Disconnect Google</button>;
  return (
    <button className="btn sm gcal" onClick={g.connect} disabled={g.status === "loading"}>
      {g.status === "loading" ? "Connecting…" : g.status === "paused" ? "Sync Google Calendar" : "Connect Google Calendar"}
    </button>
  );
}

export function Calendar({ dash }: { dash: Dashboard }) {
  const g = useGoogleCalendar();
  const t = today();
  const inRange = (d: string) => d >= t && daysBetween(t, d) <= 13;

  const items: Item[] = [
    ...dash.entries.events.filter(e => inRange(e.data.date)).map(e => ({
      key: e.id, date: e.data.date, time: e.data.time || "", title: e.data.title, source: "local" as const, entry: e,
    })),
    ...g.events.filter(e => inRange(e.date)).map(e => ({
      key: `g:${e.id}`, date: e.date, time: e.time, title: e.title, source: "google" as const, event: e,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));

  const week = Array.from({ length: 7 }, (_, i) => iso(addDays(new Date(), i)));
  const days = [...new Set(items.map(e => e.date))];

  return (
    <Panel id="p-events" title="Calendar" cover="c-events" label="Next 14 days" addLabel="Add event" extra={<GoogleControl g={g} />}
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("events", { title: v.title.trim(), date: v.date, time: v.time || "" })}>
          <input className="grow" name="title" placeholder="What's happening?" required aria-label="Event" />
          <DateField name="date" label="Date" />
          <input type="time" name="time" aria-label="Time (optional)" />
        </AddForm>
      )}>
      {g.error && <p className="err">{g.error}</p>}
      {g.status === "paused" && !g.error && <p className="sub">Tap Sync to show your Google Calendar events again.</p>}
      <div className="week">
        {week.map((d, i) => {
          const n = items.filter(e => e.date === d).length;
          return (
            <div key={d} className={"day" + (i === 0 ? " today" : "")}>
              <span className="dw">{parse(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="dn">{parse(d).getDate()}</span>
              <div className="dots">{Array.from({ length: Math.min(n, 4) }, (_, k) => <i key={k} />)}</div>
            </div>
          );
        })}
      </div>
      {items.length === 0 ? <Empty>Nothing on the calendar for the next two weeks.</Empty> : (
        <div>
          {days.map(day => {
            const dd = daysBetween(t, day);
            return (
              <Fragment key={day}>
                <div className="agenda-day">{dd === 0 ? "Today" : dd === 1 ? "Tomorrow" : fmt(day)}</div>
                <ul className="list">
                  {items.filter(e => e.date === day).map(e => (
                    <li key={e.key}>
                      <span className="time">{e.time || "all day"}</span>
                      {e.source === "local" ? <>
                        <span className="grow1 t">{e.title}<ExampleTag show={e.entry.data.example} /></span>
                        <Remove label={e.title} onClick={() => dash.remove(e.entry)} />
                      </> : <>
                        <span className="grow1 t">
                          {e.event.link ? <a className="plain" href={e.event.link} target="_blank" rel="noreferrer">{e.title}</a> : e.title}
                          <div className="sub"><i className="cal-dot" style={{ background: e.event.color || "var(--accent)" }} />{e.event.calendar}</div>
                        </span>
                      </>}
                    </li>
                  ))}
                </ul>
              </Fragment>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
