import { useState, type FormEvent } from "react";
import { Empty, Panel, Remove, plural } from "../components/ui";
import type { Entry, NoteData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";

function NoteEditor({ initial, onSave, onClose }: {
  initial?: Pick<NoteData, "title" | "body">;
  onSave: (title: string, body: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const title = String(f.get("title") || "").trim(), body = String(f.get("body") || "").trim();
    if (!title && !body) return onClose();
    setBusy(true);
    try { await onSave(title, body); onClose(); } finally { setBusy(false); }
  };
  return (
    <form className="note-edit" onSubmit={submit}
      onKeyDown={ev => { if (ev.key === "Escape") onClose(); if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) ev.currentTarget.requestSubmit(); }}>
      <input name="title" placeholder="Title" aria-label="Note title" defaultValue={initial?.title} autoFocus={!initial} />
      <textarea name="body" placeholder="Write something…" aria-label="Note" defaultValue={initial?.body} autoFocus={!!initial} />
      <div className="acts">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

const edited = (ms: number) => {
  const d = new Date(ms), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
};

export function Notes({ dash }: { dash: Dashboard }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const all = dash.entries.notes;
  const list = all
    .filter(n => !q || `${n.data.title}\n${n.data.body}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || b.data.updatedAt - a.data.updatedAt);

  const save = (n: Entry<"notes">) => (title: string, body: string) => dash.patch(n, { title, body, updatedAt: Date.now() });

  return (
    <Panel id="p-notes" title="Notes" cover="c-notes" addLabel="New note"
      label={plural(all.length, "note")}
      extra={all.length > 3 ? <input className="note-search" type="search" placeholder="Search notes" aria-label="Search notes" value={query} onChange={e => setQuery(e.target.value)} /> : undefined}
      form={close => (
        <NoteEditor onClose={close} onSave={(title, body) => dash.add("notes", { title, body, pinned: false, updatedAt: Date.now() })} />
      )}>
      {all.length === 0 ? <Empty>Jot down ideas, lists and anything you want to keep handy. Tap + to start a note.</Empty>
        : list.length === 0 ? <Empty>No notes match “{query}”.</Empty> : (
        <div className="notes">
          {list.map(n => editing === n.id ? (
            <div key={n.id} className="note"><NoteEditor initial={n.data} onSave={save(n)} onClose={() => setEditing(null)} /></div>
          ) : (
            <article key={n.id} className={"note" + (n.data.pinned ? " pinned" : "")} tabIndex={0}
              onClick={() => setEditing(n.id)} onKeyDown={e => e.key === "Enter" && e.currentTarget === e.target && setEditing(n.id)}>
              {n.data.title && <h3>{n.data.title}</h3>}
              {n.data.body && <div className="body">{n.data.body}</div>}
              <div className="foot" onClick={e => e.stopPropagation()}>
                <span className="meta">{edited(n.data.updatedAt)}</span>
                <span>
                  <button className={"pin" + (n.data.pinned ? " on" : "")} aria-pressed={n.data.pinned}
                    aria-label={n.data.pinned ? "Unpin note" : "Pin note"} title={n.data.pinned ? "Unpin" : "Pin to top"}
                    onClick={() => dash.patch(n, { pinned: !n.data.pinned })}>
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill={n.data.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M9 3h6l-1 6 4 4H6l4-4Z" /><path d="M12 13v8" /></svg>
                  </button>
                  <Remove label={n.data.title || "note"} onClick={() => dash.remove(n)} />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
