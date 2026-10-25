import { Fragment } from "react";
import { AddForm, DateField, Empty, ExampleTag, Panel, Remove } from "../components/ui";
import { addDays, by, daysBetween, fmt, iso, parse, today } from "../lib/dates";
import type { Dashboard } from "../lib/useDashboard";

export function Calendar({ dash }: { dash: Dashboard }) {
  const t = today();
  const soon = dash.entries.events.filter(e => e.data.date >= t && daysBetween(t, e.data.date) <= 13)
    .sort((a, b) => by<typeof a.data>("date", "time")(a.data, b.data));
  const week = Array.from({ length: 7 }, (_, i) => iso(addDays(new Date(), i)));
  const days = [...new Set(soon.map(e => e.data.date))];

  return (
    <Panel id="p-events" title="Calendar" cover="c-events" label="Next 14 days" addLabel="Add event"
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("events", { title: v.title.trim(), date: v.date, time: v.time || "" })}>
          <input className="grow" name="title" placeholder="What's happening?" required aria-label="Event" />
          <DateField name="date" label="Date" />
          <input type="time" name="time" aria-label="Time (optional)" />
        </AddForm>
      )}>
      <div className="week">
        {week.map((d, i) => {
          const n = soon.filter(e => e.data.date === d).length;
          return (
            <div key={d} className={"day" + (i === 0 ? " today" : "")}>
              <span className="dw">{parse(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="dn">{parse(d).getDate()}</span>
              <div className="dots">{Array.from({ length: Math.min(n, 4) }, (_, k) => <i key={k} />)}</div>
            </div>
          );
        })}
      </div>
      {soon.length === 0 ? <Empty>Nothing on the calendar for the next two weeks.</Empty> : (
        <div>
          {days.map(day => {
            const dd = daysBetween(t, day);
            return (
              <Fragment key={day}>
                <div className="agenda-day">{dd === 0 ? "Today" : dd === 1 ? "Tomorrow" : fmt(day)}</div>
                <ul className="list">
                  {soon.filter(e => e.data.date === day).map(e => (
                    <li key={e.id}>
                      <span className="time">{e.data.time || "all day"}</span>
                      <span className="grow1 t">{e.data.title}<ExampleTag show={e.data.example} /></span>
                      <Remove label={e.data.title} onClick={() => dash.remove(e)} />
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
