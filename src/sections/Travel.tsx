import { AddForm, DateField, Empty, ExampleTag, Panel, Remove, plural } from "../components/ui";
import { daysBetween, fmt, today } from "../lib/dates";
import type { Dashboard } from "../lib/useDashboard";

export function Travel({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const t = today(), y = t.slice(0, 4);
  const up = dash.entries.trips.filter(x => x.data.end >= t).sort((a, b) => a.data.start.localeCompare(b.data.start));
  const pastThisYear = dash.entries.trips.filter(x => x.data.end < t && x.data.start.startsWith(y)).length;
  const short = (s: string) => fmt(s, { month: "short", day: "numeric" });

  return (
    <Panel id="p-trips" title="Travel" cover="c-trips" label="Trips" addLabel="Add trip"
      form={close => (
        <AddForm onClose={close} onSave={v => {
          if (v.end < v.start) { notify("The return date is before the start date."); return false; }
          return dash.add("trips", { place: v.place.trim(), start: v.start, end: v.end, note: v.note.trim() });
        }}>
          <input className="grow" name="place" placeholder="Where to?" required aria-label="Destination" />
          <DateField name="start" label="Leaving" />
          <DateField name="end" label="Back" />
          <input className="grow" name="note" placeholder="Notes (flight, hotel…)" aria-label="Notes" />
        </AddForm>
      )}>
      {up.length === 0 ? <Empty>No trips planned. Add one to start the countdown.</Empty> : (
        <ul className="list">
          {up.map(x => {
            const d = daysBetween(t, x.data.start), nights = Math.max(0, daysBetween(x.data.start, x.data.end));
            return (
              <li key={x.id}>
                <div className="grow1">
                  <span className="t strong">{x.data.place}</span><ExampleTag show={x.data.example} />
                  <div className="sub">{`${short(x.data.start)} – ${short(x.data.end)} · ${plural(nights, "night")}`}{x.data.note ? ` · ${x.data.note}` : ""}</div>
                </div>
                <span className={"pill" + (d <= 0 ? " good" : "")}>{d <= 0 ? "now" : d === 1 ? "tomorrow" : `in ${d} days`}</span>
                <Remove label={x.data.place} onClick={() => dash.remove(x)} />
              </li>
            );
          })}
        </ul>
      )}
      {pastThisYear > 0 && <div className="meta">{plural(pastThisYear, "trip")} taken so far in {y}</div>}
    </Panel>
  );
}
