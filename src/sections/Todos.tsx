import { AddForm, Empty, Panel, Remove } from "../components/ui";
import { fmt, today } from "../lib/dates";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { colorOf } from "../pages/TodoPage";

export function Todos({ dash }: { dash: Dashboard }) {
  const t = today();
  // A starred list takes over the card; otherwise it shows every task.
  const starred = dash.entries.lists.find(l => l.data.starred);
  const all = starred ? dash.entries.todos.filter(x => x.data.listId === starred.id) : dash.entries.todos;
  const open = all.filter(x => !x.data.done).sort((a, b) => (a.data.due || "￿").localeCompare(b.data.due || "￿") || a.createdAt.localeCompare(b.createdAt));
  const done = all.filter(x => x.data.done).sort((a, b) => (b.data.doneAt || 0) - (a.data.doneAt || 0));

  const row = (x: Entry<"todos">) => {
    const late = !x.data.done && !!x.data.due && x.data.due < t;
    return (
      <li key={x.id} className={x.data.done ? "done" : ""}>
        <input type="checkbox" className="check" checked={x.data.done} aria-label={`Done: ${x.data.text}`}
          onChange={ev => dash.patch(x, { done: ev.target.checked, doneAt: ev.target.checked ? Date.now() : null })} />
        <span className="grow1 t">{x.data.text}</span>
        {x.data.due && !x.data.done && (
          <span className={"pill" + (late ? " warn" : "")}>{late ? "overdue" : x.data.due === t ? "today" : fmt(x.data.due, { month: "short", day: "numeric" })}</span>
        )}
        <Remove label={x.data.text} onClick={() => dash.remove(x)} />
      </li>
    );
  };

  return (
    <Panel id="p-todos" title="To-do" cover={starred ? colorOf(starred.data.color).cover : "c-todos"} addLabel="Add task"
      label={starred ? <span><span className="star-mark" aria-hidden="true">★</span> {starred.data.title}</span> : "On your plate"}
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("todos", { text: v.text.trim(), due: v.due || "", done: false, ...(starred ? { listId: starred.id } : {}) })}>
          <input className="grow" name="text" placeholder="Task" required aria-label="Task" />
          <input type="date" name="due" aria-label="Due date (optional)" />
        </AddForm>
      )}>
      {open.length ? <ul className="list">{open.map(row)}</ul>
        : <Empty>{starred ? `Nothing left on ${starred.data.title}.` : "All clear. Add a task when something comes up."}</Empty>}
      {!starred && dash.entries.lists.length > 0 && <p className="sub">Star a list on the To-do page to show just that list here.</p>}
      {done.length > 0 && <>
        <div className="label">Done · {done.length}</div>
        <ul className="list">{done.slice(0, 3).map(row)}</ul>
      </>}
    </Panel>
  );
}
