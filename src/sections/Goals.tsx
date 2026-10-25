import { AddForm, Bar, Empty, ExampleTag, Panel, Remove, Stepper } from "../components/ui";
import { daysBetween, fmt, today } from "../lib/dates";
import type { Dashboard } from "../lib/useDashboard";

export function Goals({ dash }: { dash: Dashboard }) {
  const t = today();
  const list = [...dash.entries.goals].sort((a, b) =>
    Number(a.data.progress >= 100) - Number(b.data.progress >= 100) || (a.data.target || "￿").localeCompare(b.data.target || "￿"));

  return (
    <Panel id="p-goals" title="Goals" cover="c-goals" label="Working toward" addLabel="Add goal"
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("goals", { title: v.title.trim(), target: v.target || "", progress: 0 })}>
          <input className="grow" name="title" placeholder="Goal" required aria-label="Goal" />
          <input type="date" name="target" aria-label="Target date (optional)" />
        </AddForm>
      )}>
      {list.length === 0 ? <Empty>Add a goal and nudge its progress as you go.</Empty> : (
        <ul className="list">
          {list.map(g => {
            const p = g.data.progress || 0, past = g.data.target ? daysBetween(t, g.data.target) < 0 : false;
            return (
              <li key={g.id}>
                <div className="grow1">
                  <div className="row-between">
                    <span className="t">{g.data.title}<ExampleTag show={g.data.example} /></span>
                    {p >= 100 ? <span className="pill good">done</span>
                      : g.data.target ? <span className={"pill" + (past ? " warn" : "")}>{past ? "past target" : "by " + fmt(g.data.target, { month: "short", year: "numeric" })}</span>
                      : null}
                  </div>
                  <div className="prog"><Bar pct={p} /><span className="num sub">{p}%</span><Stepper value={p} onChange={v => dash.patch(g, { progress: v })} /></div>
                </div>
                <Remove label={g.data.title} onClick={() => dash.remove(g)} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
