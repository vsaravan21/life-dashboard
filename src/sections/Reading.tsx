import type { ReactNode } from "react";
import { AddForm, Bar, Empty, Panel, Remove, Stepper } from "../components/ui";
import { fmt, today } from "../lib/dates";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";

export function Reading({ dash }: { dash: Dashboard }) {
  const y = today().slice(0, 4);
  const books = dash.entries.books;
  const reading = books.filter(b => b.data.status === "reading");
  const want = books.filter(b => b.data.status === "want");
  const done = books.filter(b => b.data.status === "done").sort((a, b) => (b.data.finished || "").localeCompare(a.data.finished || ""));
  const finishedThisYear = done.filter(b => (b.data.finished || "").startsWith(y)).length;

  const name = (b: Entry<"books">) => <>
    <span className="t strong">{b.data.title}</span>
    {b.data.author && <div className="sub">{b.data.author}</div>}
  </>;
  const group = (label: string, items: ReactNode[]) => items.length > 0 && <>
    <div className="label">{label}</div>
    <ul className="list">{items}</ul>
  </>;

  return (
    <Panel id="p-books" title="Reading" cover="c-books" label={`${finishedThisYear} finished in ${y}`} addLabel="Add book"
      form={close => (
        <AddForm onClose={close} onSave={v => {
          const status = v.status as "reading" | "want" | "done";
          return dash.add("books", { title: v.title.trim(), author: v.author.trim(), status, progress: status === "done" ? 100 : 0, finished: status === "done" ? today() : "" });
        }}>
          <input className="grow" name="title" placeholder="Title" required aria-label="Title" />
          <input name="author" placeholder="Author" aria-label="Author" />
          <select name="status" aria-label="Status">
            <option value="reading">Reading now</option><option value="want">Want to read</option><option value="done">Finished</option>
          </select>
        </AddForm>
      )}>
      {group("Reading now", reading.map(b => (
        <li key={b.id}>
          <div className="grow1">
            {name(b)}
            <div className="prog">
              <Bar pct={b.data.progress} /><span className="num sub">{b.data.progress}%</span>
              <Stepper value={b.data.progress} onChange={v => dash.patch(b, { progress: v })} />
              <button className="btn sm" onClick={() => dash.patch(b, { status: "done", progress: 100, finished: today() })}>Finished</button>
            </div>
          </div>
          <Remove label={b.data.title} onClick={() => dash.remove(b)} />
        </li>
      )))}
      {group("Up next", want.map(b => (
        <li key={b.id}>
          <div className="grow1">{name(b)}</div>
          <button className="btn sm" onClick={() => dash.patch(b, { status: "reading", progress: 0 })}>Start</button>
          <Remove label={b.data.title} onClick={() => dash.remove(b)} />
        </li>
      )))}
      {group("Recently finished", done.slice(0, 3).map(b => (
        <li key={b.id}>
          <div className="grow1">{name(b)}</div>
          {b.data.finished && <span className="meta">{fmt(b.data.finished, { month: "short", day: "numeric" })}</span>}
          <Remove label={b.data.title} onClick={() => dash.remove(b)} />
        </li>
      )))}
      {books.length === 0 && <Empty>Add what you're reading and what's next on the pile.</Empty>}
    </Panel>
  );
}
