import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fmt, today } from "../lib/dates";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";

/** List colors: the same blurred pastel paints as the section covers. */
export const LIST_COLORS: Record<string, { name: string; cover: string }> = {
  blush: { name: "Blush", cover: "c-events" },
  peach: { name: "Peach", cover: "c-todos" },
  mint: { name: "Mint", cover: "c-money" },
  periwinkle: { name: "Periwinkle", cover: "c-goals" },
  sunset: { name: "Sunset", cover: "c-trips" },
  orchid: { name: "Orchid", cover: "c-books" },
  honey: { name: "Honey", cover: "c-wins" },
  prism: { name: "Prism", cover: "c-journal" },
  petal: { name: "Petal", cover: "c-notes" },
};
const DEFAULT_COLOR = "peach";
export const colorOf = (c: string) => LIST_COLORS[c] ?? LIST_COLORS[DEFAULT_COLOR];

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="ev-colors" role="radiogroup" aria-label="List color">
      {Object.entries(LIST_COLORS).map(([id, c]) => (
        <button type="button" key={id} role="radio" aria-checked={value === id} title={c.name} aria-label={c.name}
          className={`sw paint ${c.cover}` + (value === id ? " on" : "")} onClick={() => onChange(id)} />
      ))}
    </div>
  );
}

const Check = ({ done }: { done: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill={done ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
    {done && <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);

function Task({ task, dash }: { task: Entry<"todos">; dash: Dashboard }) {
  const [text, setText] = useState(task.data.text);
  useEffect(() => setText(task.data.text), [task.data.text]);
  const save = () => {
    const t = text.trim();
    if (!t) return dash.remove(task);
    if (t !== task.data.text) dash.patch(task, { text: t });
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") { setText(task.data.text); e.currentTarget.blur(); }
  };
  const done = task.data.done;
  return (
    <li className={"tl-task" + (done ? " done" : "")}>
      <button className="tl-check" aria-pressed={done} aria-label={`${done ? "Not done" : "Done"}: ${task.data.text}`}
        onClick={() => dash.patch(task, { done: !done, doneAt: done ? null : Date.now() })}><Check done={done} /></button>
      <input className="tl-text" value={text} aria-label="Task" onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={key} />
      <button className="tl-x" aria-label={`Remove ${task.data.text}`} title="Remove" onClick={() => dash.remove(task)}>×</button>
    </li>
  );
}

/** Star a list (and unstar the rest, since only one shows on the home page), or unstar it. */
export function star(list: Entry<"lists">, dash: Dashboard) {
  const on = !list.data.starred;
  if (on) for (const l of dash.entries.lists) if (l.id !== list.id && l.data.starred) dash.patch(l, { starred: false });
  dash.patch(list, { starred: on });
}

/** One list card: its tasks in the order they were added, then a "New task" line. */
function ListCard({ list, tasks, dash, focusNew }: { list: Entry<"lists"> | null; tasks: Entry<"todos">[]; dash: Dashboard; focusNew: boolean }) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState(list?.data.title ?? "Tasks");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const newRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusNew) newRef.current?.focus(); }, [focusNew]);
  useEffect(() => { if (list) setTitle(list.data.title); }, [list?.data.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = colorOf(list?.data.color ?? "petal");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    dash.add("todos", { text, done: false, due: "", ...(list ? { listId: list.id } : {}) });
    setDraft("");
  };
  const saveTitle = () => {
    if (!list) return;
    const t = title.trim() || "Untitled list";
    setTitle(t);
    if (t !== list.data.title) dash.patch(list, { title: t });
  };
  const removeList = async () => {
    if (!list) return;
    if (!confirm) return setConfirm(true);
    for (const t of tasks) dash.remove(t);
    dash.remove(list);
  };
  const done = tasks.filter(t => t.data.done).length;

  return (
    <section className="glass tl-card" aria-label={title}>
      <header className={`cover tl-head ${c.cover}`}>
        <div className="tl-heading">
          {list
            ? <input className="tl-title" value={title} aria-label="List name" onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
                onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
            : <h2 className="tl-title">Tasks</h2>}
          <span className="tl-date">{list ? `Created ${fmt(list.data.created, { month: "short", day: "numeric", year: "numeric" })}` : "Added from the home page"}</span>
        </div>
        {list && (
          <button className={"tl-menu-btn tl-star" + (list.data.starred ? " on" : "")} aria-pressed={!!list.data.starred}
            aria-label={list.data.starred ? "Unstar: stop showing on the home page" : "Star: show on the home page"}
            title={list.data.starred ? "Shown on the home page" : "Show on the home page"} onClick={() => star(list, dash)}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={list.data.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" /></svg>
          </button>
        )}
        {list && (
          <button className="tl-menu-btn" aria-label="List options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        )}
      </header>
      {menu && list && (
        <div className="tl-menu">
          <span className="label">Color</span>
          <Swatches value={list.data.color} onChange={color => dash.patch(list, { color })} />
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={removeList}>
            {confirm ? `Delete list${tasks.length ? ` and ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : ""}?` : "Delete list"}
          </button>
        </div>
      )}
      <ul className="tl-tasks">
        {tasks.map(t => <Task key={t.id} task={t} dash={dash} />)}
        <li className="tl-task tl-new">
          <span className="tl-check" aria-hidden="true"><Check done={false} /></span>
          <input ref={newRef} className="tl-text" value={draft} placeholder="New task" aria-label={`New task in ${title}`}
            onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} onBlur={add} />
        </li>
      </ul>
      {tasks.length > 0 && <div className="tl-foot">{done} of {tasks.length} done</div>}
    </section>
  );
}

export function TodoPage({ dash }: { dash: Dashboard }) {
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [fresh, setFresh] = useState<string | null>(null);

  const lists = [...dash.entries.lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(lists.map(l => l.id));
  const tasks = [...dash.entries.todos].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const loose = tasks.filter(t => !t.data.listId || !ids.has(t.data.listId));

  const create = async () => {
    const l = await dash.add("lists", { title: name.trim() || "Untitled list", color, created: today() });
    if (l) setFresh(l.id);
    setName("");
    setComposing(false);
  };

  return (
    <PageShell path="/todo" actions={<button className="btn primary" onClick={() => setComposing(true)}>+ New list</button>}>
      <div className="tl-grid">
        {composing && (
          <form className="glass tl-card tl-compose" onSubmit={e => { e.preventDefault(); create(); }}>
            <div className={`cover tl-head ${colorOf(color).cover}`}>
              <div className="tl-heading">
                <input className="tl-title" autoFocus value={name} placeholder="Name your list" aria-label="List name" onChange={e => setName(e.target.value)} />
                <span className="tl-date">Created {fmt(today(), { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
            <span className="label">Color</span>
            <Swatches value={color} onChange={setColor} />
            <div className="tl-compose-acts">
              <button type="button" className="btn" onClick={() => setComposing(false)}>Cancel</button>
              <button className="btn primary">Create list</button>
            </div>
          </form>
        )}
        {lists.map(l => (
          <ListCard key={l.id} list={l} tasks={tasks.filter(t => t.data.listId === l.id)} dash={dash} focusNew={fresh === l.id} />
        ))}
        {loose.length > 0 && <ListCard list={null} tasks={loose} dash={dash} focusNew={false} />}
        {!composing && lists.length === 0 && loose.length === 0 && (
          <section className="glass page-empty tl-empty">
            <h2>No lists yet</h2>
            <p className="sub">Make a list for anything: a trip, a project, groceries. Give it a name and a color, then add tasks.</p>
            <button className="btn primary" onClick={() => setComposing(true)}>+ New list</button>
          </section>
        )}
      </div>
    </PageShell>
  );
}
