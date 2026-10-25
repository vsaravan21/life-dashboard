import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fmt, today } from "../lib/dates";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";

/** List colors: the card background, and whether it needs light text. */
export const LIST_COLORS: Record<string, { name: string; bg: string; dark: boolean }> = {
  navy: { name: "Midnight", bg: "#1f2044", dark: true },
  plum: { name: "Plum", bg: "#3a2343", dark: true },
  coral: { name: "Coral", bg: "#f6a58f", dark: false },
  peach: { name: "Peach", bg: "#fde1d3", dark: false },
  pink: { name: "Blush", bg: "#f9d3df", dark: false },
  lavender: { name: "Lavender", bg: "#e3d6f5", dark: false },
  sage: { name: "Sage", bg: "#d7ead8", dark: false },
  sky: { name: "Sky", bg: "#d4e6f5", dark: false },
  butter: { name: "Butter", bg: "#fbefc4", dark: false },
};
const colorOf = (c: string) => LIST_COLORS[c] ?? LIST_COLORS.navy;

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="ev-colors" role="radiogroup" aria-label="List color">
      {Object.entries(LIST_COLORS).map(([id, c]) => (
        <button type="button" key={id} role="radio" aria-checked={value === id} title={c.name} aria-label={c.name}
          className={"sw" + (value === id ? " on" : "")} style={{ background: c.bg }} onClick={() => onChange(id)} />
      ))}
    </div>
  );
}

const Check = ({ done }: { done: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill={done ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
    {done && <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="var(--list-bg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
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

/** One list card: its tasks in the order they were added, then a "New task" line. */
function ListCard({ list, tasks, dash, focusNew }: { list: Entry<"lists"> | null; tasks: Entry<"todos">[]; dash: Dashboard; focusNew: boolean }) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState(list?.data.title ?? "Tasks");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const newRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusNew) newRef.current?.focus(); }, [focusNew]);
  useEffect(() => { if (list) setTitle(list.data.title); }, [list?.data.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = colorOf(list?.data.color ?? "lavender");
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
    <section className={"tl-card" + (c.dark ? " dark" : "")} style={{ ["--list-bg" as string]: c.bg }} aria-label={title}>
      <header className="tl-head">
        <div className="tl-heading">
          {list
            ? <input className="tl-title" value={title} aria-label="List name" onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
                onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
            : <h2 className="tl-title">Tasks</h2>}
          <span className="tl-date">{list ? `Created ${fmt(list.data.created, { month: "short", day: "numeric", year: "numeric" })}` : "Added from the home page"}</span>
        </div>
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
  const [color, setColor] = useState("navy");
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
          <form className={"tl-card tl-compose" + (colorOf(color).dark ? " dark" : "")} style={{ ["--list-bg" as string]: colorOf(color).bg }}
            onSubmit={e => { e.preventDefault(); create(); }}>
            <input className="tl-title" autoFocus value={name} placeholder="Name your list" aria-label="List name" onChange={e => setName(e.target.value)} />
            <span className="tl-date">Created {fmt(today(), { month: "short", day: "numeric", year: "numeric" })}</span>
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
