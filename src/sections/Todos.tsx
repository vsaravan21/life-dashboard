import { AddForm, Empty, ExampleTag, Panel, Remove } from "../components/ui";
import { fmt, today } from "../lib/dates";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";

export function Todos({ dash }: { dash: Dashboard }) {
  const t = today();
  const all = dash.entries.todos;
  const open = all.filter(x => !x.data.done).sort((a, b) => (a.data.due || "￿").localeCompare(b.data.due || "￿") || a.createdAt.localeCompare(b.createdAt));
  const done = all.filter(x => x.data.done).sort((a, b) => (b.data.doneAt || 0) - (a.data.doneAt || 0));

  const row = (x: Entry<"todos">) => {
    const late = !x.data.done && !!x.data.due && x.data.due < t;
    return (
      <li key={x.id} className={x.data.done ? "done" : ""}>
        <input type="checkbox" className="check" checked={x.data.done} aria-label={`Done: ${x.data.text}`}
          onChange={ev => dash.patch(x, { done: ev.target.checked, doneAt: ev.target.checked ? Date.now() : null })} />
        <span className="grow1 t">{x.data.text}<ExampleTag show={x.data.example} /></span>
        {x.data.due && !x.data.done && (
          <span className={"pill" + (late ? " warn" : "")}>{late ? "overdue" : x.data.due === t ? "today" : fmt(x.data.due, { month: "short", day: "numeric" })}</span>
        )}
        <Remove label={x.data.text} onClick={() => dash.remove(x)} />
      </li>
    );
  };

  return (
    <Panel id="p-todos" title="To-do" cover="c-todos" label="On your plate" addLabel="Add task"
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("todos", { text: v.text.trim(), due: v.due || "", done: false })}>
          <input className="grow" name="text" placeholder="Task" required aria-label="Task" />
          <input type="date" name="due" aria-label="Due date (optional)" />
        </AddForm>
      )}>
      {open.length ? <ul className="list">{open.map(row)}</ul> : <Empty>All clear. Add a task when something comes up.</Empty>}
      {done.length > 0 && <>
        <div className="label">Done · {done.length}</div>
        <ul className="list">{done.slice(0, 3).map(row)}</ul>
      </>}
    </Panel>
  );
}
