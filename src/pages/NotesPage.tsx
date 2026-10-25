import { useEffect, useRef, useState } from "react";
import { Remove } from "../components/ui";
import type { Entry, NoteData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";

const edited = (ms: number) => {
  const d = new Date(ms), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
};

const firstLine = (body: string) => body.split("\n").find(l => l.trim())?.trim() ?? "";

/** Edits one note, saving a moment after typing stops and when leaving the note. */
function Editor({ note, dash, onBack }: { note: Entry<"notes">; dash: Dashboard; onBack: () => void }) {
  const [title, setTitle] = useState(note.data.title);
  const [body, setBody] = useState(note.data.body);
  const [saved, setSaved] = useState(true);
  const latest = useRef({ title, body, note });
  latest.current = { title, body, note };
  const timer = useRef<number>();

  const flush = () => {
    window.clearTimeout(timer.current);
    const { title, body, note } = latest.current;
    if (title === note.data.title && body === note.data.body) return;
    dash.patch(note, { title, body, updatedAt: Date.now() }).then(() => setSaved(true));
  };
  const change = (next: Partial<Pick<NoteData, "title" | "body">>) => {
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };
  // Save when switching notes or leaving the page.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="notes-editor">
      <div className="notes-editor-bar">
        <button className="btn sm notes-back" onClick={() => { flush(); onBack(); }}>‹ All notes</button>
        <span className="meta">{saved ? `Saved · ${edited(note.data.updatedAt)}` : "Saving…"}</span>
        <span className="notes-editor-acts">
          <button className={"pin" + (note.data.pinned ? " on" : "")} aria-pressed={note.data.pinned}
            aria-label={note.data.pinned ? "Unpin note" : "Pin note"} title={note.data.pinned ? "Unpin" : "Pin to top"}
            onClick={() => dash.patch(note, { pinned: !note.data.pinned })}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill={note.data.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M9 3h6l-1 6 4 4H6l4-4Z" /><path d="M12 13v8" /></svg>
          </button>
          <Remove label={title || "note"} onClick={() => { window.clearTimeout(timer.current); dash.remove(note); onBack(); }} />
        </span>
      </div>
      <input className="notes-title" value={title} placeholder="Title" aria-label="Note title" onChange={e => change({ title: e.target.value })} onBlur={flush} />
      <textarea className="notes-body" value={body} placeholder="Start writing…" aria-label="Note" onChange={e => change({ body: e.target.value })} onBlur={flush} />
    </div>
  );
}

export function NotesPage({ dash }: { dash: Dashboard }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const all = dash.entries.notes;
  const list = all
    .filter(n => !q || `${n.data.title}\n${n.data.body}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || b.data.updatedAt - a.data.updatedAt);
  const open = all.find(n => n.id === openId) ?? null;

  // On wide screens, show the most recent note instead of an empty editor.
  useEffect(() => {
    if (!open && list.length && window.matchMedia("(min-width: 900px)").matches) setOpenId(list[0].id);
  }, [open, list]);

  const create = async () => {
    const n = await dash.add("notes", { title: "", body: "", pinned: false, updatedAt: Date.now() });
    if (n) { setQuery(""); setOpenId(n.id); }
  };

  return (
    <PageShell path="/notes" actions={<button className="btn primary" onClick={create}>+ New note</button>}>
      <div className={"notes-layout" + (open ? " has-open" : "")}>
        <aside className="glass notes-list">
          <input className="note-search" type="search" placeholder="Search notes" aria-label="Search notes" value={query} onChange={e => setQuery(e.target.value)} />
          {all.length === 0 ? <p className="empty">No notes yet. Tap New note to start one.</p>
            : list.length === 0 ? <p className="empty">No notes match “{query}”.</p> : (
            <ul>
              {list.map(n => (
                <li key={n.id}>
                  <button className={"notes-item" + (n.id === openId ? " on" : "")} onClick={() => setOpenId(n.id)}>
                    <span className="notes-item-title">
                      {n.data.pinned && <svg viewBox="0 0 24 24" width="12" height="12" aria-label="Pinned" fill="currentColor"><path d="M9 3h6l-1 6 4 4H6l4-4Z" /><path d="M12 13v8" stroke="currentColor" strokeWidth="1.7" /></svg>}
                      {n.data.title || firstLine(n.data.body) || "New note"}
                    </span>
                    <span className="notes-item-sub"><span className="meta">{edited(n.data.updatedAt)}</span> {n.data.title ? firstLine(n.data.body) : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="glass notes-pane">
          {open ? <Editor key={open.id} note={open} dash={dash} onBack={() => setOpenId(null)} />
            : <p className="empty">Pick a note on the left, or start a new one.</p>}
        </section>
      </div>
    </PageShell>
  );
}
