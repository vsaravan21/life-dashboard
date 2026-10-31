import { useEffect, useState, type FormEvent } from "react";
import { type Framing, CoverNote, keepFraming, keepNotes, NoteField, NoteMark, Slides } from "../components/Slides";
import { plural } from "../components/ui";
import { fmt, today } from "../lib/dates";
import type { Entry, JournalData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";
import { colorOf, Swatches } from "./TodoPage";

const COLORS = ["prism", "blush", "periwinkle", "mint", "honey", "orchid", "peach", "sunset", "petal"];
/** Older moments kept one photo; highlights keep a list. Either way, this is the list. */
export const photosOf = (d: JournalData) => d.photos ?? (d.photo ? [d.photo] : []);

/** One highlight: a title and date on a colored cover, then its photos and videos. */
function HighlightCard({ h, dash, notify }: { h: Entry<"journal">; dash: Dashboard; notify: (m: string) => void }) {
  const d = h.data;
  const [title, setTitle] = useState(d.caption);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setTitle(d.caption), [d.caption]);
  const color = d.color || COLORS[0];
  const photos = photosOf(d);

  // Saving the list also moves an older single photo into it.
  const setPhotos = (list: string[]) => dash.patch(h, { photos: list, photo: undefined, notes: keepNotes(d.notes, list), framing: keepFraming(d.framing, list) });
  const setFraming = (ref: string, f: Framing | null) => {
    const { [ref]: _, ...rest } = d.framing ?? {};
    dash.patch(h, { photos, framing: f ? { ...rest, [ref]: f } : rest });
  };
  const setNote = (ref: string, text: string) => dash.patch(h, { notes: keepNotes({ ...d.notes, [ref]: text }, photos) });
  const saveTitle = () => {
    const t = title.trim() || "Untitled";
    setTitle(t);
    if (t !== d.caption) dash.patch(h, { caption: t });
  };

  return (
    <section className="glass tl-card" aria-label={d.caption}>
      <CoverNote note={d.note}>
        <header className={`cover tl-head ${colorOf(color).cover}`}>
          <div className="tl-heading">
            <input className="tl-title" value={title} aria-label="Highlight title" onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
              onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
            <span className="tl-date">{fmt(d.date, { month: "short", day: "numeric", year: "numeric" })}{d.note && <NoteMark />}</span>
          </div>
          <button className="tl-menu-btn" aria-label="Highlight options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        </header>
      </CoverNote>
      {menu && (
        <div className="tl-menu">
          <span className="label">Note</span>
          <NoteField value={d.note ?? ""} placeholder="A few words about this highlight. It shows when you hover the cover." onSave={note => dash.patch(h, { note })} />
          <span className="label">Date</span>
          <input className="btn" type="date" value={d.date} aria-label="Date" onChange={e => e.target.value && dash.patch(h, { date: e.target.value })} />
          <span className="label">Color</span>
          <Swatches value={color} onChange={c => dash.patch(h, { color: c })} />
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? dash.remove(h) : setConfirm(true))}>
            {confirm ? `Delete ${d.caption}?` : "Delete highlight"}
          </button>
        </div>
      )}
      <Slides photos={photos} setPhotos={setPhotos} notes={d.notes} setNote={setNote} framing={d.framing} setFraming={setFraming} label={d.caption} dash={dash} notify={notify} />
    </section>
  );
}

export function JournalPage({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const [composing, setComposing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const list = [...dash.entries.journal].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt));
  const years = [...new Set(list.map(x => x.data.date.slice(0, 4)))];

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await dash.add("journal", { caption: v.caption.trim() || "Untitled", date: v.date || today(), color, photos: [] });
    setComposing(false);
    setColor(COLORS[(list.length + 1) % COLORS.length]);
  };

  const compose = composing && (
    <form className="glass tl-card tl-compose" onSubmit={create}>
      <div className={`cover tl-head ${colorOf(color).cover}`}>
        <div className="tl-heading">
          <input className="tl-title" name="caption" autoFocus placeholder="What was the highlight?" aria-label="Highlight title" required />
        </div>
      </div>
      <span className="label">Date</span>
      <input className="btn" type="date" name="date" defaultValue={today()} required aria-label="Date" />
      <span className="label">Color</span>
      <Swatches value={color} onChange={setColor} />
      <div className="tl-compose-acts">
        <button type="button" className="btn" onClick={() => setComposing(false)}>Cancel</button>
        <button className="btn primary">Add highlight</button>
      </div>
    </form>
  );

  return (
    <PageShell path="/journal" actions={<button className="btn primary" onClick={() => setComposing(true)}>+ New highlight</button>}>
      {!list.length ? (
        <div className="tl-grid">
          {compose || (
            <section className="glass page-empty tl-empty">
              <img className="mascot lg" src="/mascot.svg" alt="" />
              <h2>No highlights yet</h2>
              <p className="sub">Add a highlight to give it a card, then fill it with photos and videos you can swipe through.</p>
              <button className="btn primary" onClick={() => setComposing(true)}>+ New highlight</button>
            </section>
          )}
        </div>
      ) : (<>
        {compose && <div className="tl-grid">{compose}</div>}
        {years.map(y => {
          const inYear = list.filter(x => x.data.date.startsWith(y));
          return (
            <section key={y} className="lb-year" aria-label={y}>
              <h2 className="lb-year-title">{y} <span className="sub">{plural(inYear.length, "highlight")}</span></h2>
              <div className="tl-grid">{inYear.map(x => <HighlightCard key={x.id} h={x} dash={dash} notify={notify} />)}</div>
            </section>
          );
        })}
      </>)}
    </PageShell>
  );
}
