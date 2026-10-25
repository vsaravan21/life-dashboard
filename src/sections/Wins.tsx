import { AddForm, DateField, Empty, Panel, Remove } from "../components/ui";
import { fmt, today } from "../lib/dates";
import type { Dashboard } from "../lib/useDashboard";

export function Wins({ dash }: { dash: Dashboard }) {
  const y = today().slice(0, 4);
  const list = [...dash.entries.wins].sort((a, b) => b.data.date.localeCompare(a.data.date));
  const thisYear = list.filter(w => w.data.date.startsWith(y)).length;

  return (
    <Panel id="p-wins" title="Achievements" cover="c-wins" label={`${thisYear} in ${y}`} addLabel="Add achievement"
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("wins", { title: v.title.trim(), date: v.date, note: v.note.trim() })}>
          <input className="grow" name="title" placeholder="What did you achieve?" required aria-label="Achievement" />
          <DateField name="date" label="Date" />
          <input className="grow" name="note" placeholder="A line about it (optional)" aria-label="Note" />
        </AddForm>
      )}>
      {list.length === 0 ? <Empty>Big or small, log what you pulled off.</Empty> : (
        <ul className="list">
          {list.slice(0, 8).map(w => (
            <li key={w.id}>
              <span className="trophy" aria-hidden="true">★</span>
              <div className="grow1">
                <span className="t">{w.data.title}</span>
                <div className="sub">{fmt(w.data.date, { month: "short", day: "numeric", year: "numeric" })}{w.data.note ? ` · ${w.data.note}` : ""}</div>
              </div>
              <Remove label={w.data.title} onClick={() => dash.remove(w)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
