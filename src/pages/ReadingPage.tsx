import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImportButton } from "../components/ImportButton";
import { plural } from "../components/ui";
import { findCover, isWebCover, NO_COVER } from "../lib/covers";
import { today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { BookData, Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useStoredUrl } from "../lib/useStoredUrl";
import { LIST_COLORS, colorOf } from "./TodoPage";
import { PageShell } from "./PageShell";

const PAINTS = Object.keys(LIST_COLORS);
/** A steady pastel for books without a cover, so each one keeps its color. */
const paintFor = (title: string) => colorOf(PAINTS[[...title].reduce((n, c) => n + c.charCodeAt(0), 0) % PAINTS.length]).cover;
const yearOf = (b: BookData) => (b.finished || "").slice(0, 4);

function Cover({ book, dash }: { book: Entry<"books">; dash: Dashboard }) {
  const c = book.data.cover;
  const web = !!c && isWebCover(c);
  // A cover you added is stored like a photo; one found online is loaded straight from its address.
  const stored = useStoredUrl(dash.store, c && c !== NO_COVER && !web ? c : null);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [c]);
  const src = web ? c : stored.src;
  if (src && !broken && !stored.failed) return <img key={stored.attempt} className="bk-img" src={src} alt="" loading="lazy" decoding="async" onError={() => (web ? setBroken(true) : stored.onError())} />;
  return (
    <div className={`bk-img bk-plain paint ${paintFor(book.data.title)}`} aria-hidden="true">
      <span className="bk-plain-title">{book.data.title}</span>
      {book.data.author && <span className="bk-plain-author">{book.data.author}</span>}
    </div>
  );
}

/** A book on the shelf: cover, then title and author. Hovering shows your thoughts; clicking opens it. */
function BookTile({ book, dash, onOpen }: { book: Entry<"books">; dash: Dashboard; onOpen: () => void }) {
  const t = book.data.thoughts?.trim();
  return (
    <li className="bk-tile">
      <button className="bk-cover" onClick={onOpen} aria-label={`${book.data.title}${t ? ". Your thoughts: " + t : ""}. Open`}>
        <Cover book={book} dash={dash} />
        <span className={"bk-thoughts" + (t ? "" : " empty")}>
          {t ? <span className="bk-thoughts-text">{t}</span> : <span>+ Add your thoughts</span>}
        </span>
        {book.data.status === "reading" && <span className="bk-badge">{book.data.progress}%</span>}
      </button>
      <span className="bk-title">{book.data.title}</span>
      {book.data.author && <span className="bk-author">{book.data.author}</span>}
    </li>
  );
}

/** Everything about one book: thoughts, title, author, when it was read, its cover. */
function BookDialog({ book, dash, notify, onClose }: { book: Entry<"books">; dash: Dashboard; notify: (m: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [d, setD] = useState(book.data);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const dlg = ref.current!;
    if (!dlg.open) dlg.showModal();
    return () => dlg.close();
  }, []);
  const set = (p: Partial<BookData>) => setD(x => ({ ...x, ...p }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const title = d.title.trim() || book.data.title;
    const done = d.status === "done";
    const changed = title !== book.data.title || (d.author || "").trim() !== (book.data.author || "");
    dash.patch(book, {
      ...d, title, author: (d.author || "").trim(), thoughts: (d.thoughts || "").trim(),
      progress: done ? 100 : d.status === "want" ? 0 : d.progress,
      finished: done ? (d.finished || today().slice(0, 4)) : "",
      // A new title or author may find a better cover, unless the cover is one you added.
      ...(changed && (!d.cover || d.cover === NO_COVER || isWebCover(d.cover)) ? { cover: "" } : {}),
    });
    onClose();
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { set({ cover: await dash.store.uploadPhoto(await shrinkPhoto(f, 900)) }); }
    catch (e) { notify(e instanceof Error ? e.message : "Couldn't use that photo."); }
    finally { setBusy(false); }
  };

  return (
    <dialog ref={ref} className="glass ev-dialog bk-dialog" aria-label={book.data.title} onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <form className="ev-form" onSubmit={save}>
        <div className="ev-head">
          <span className="label">Book</span>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="bk-dlg-top">
          <div className="bk-dlg-cover"><Cover book={{ ...book, data: d }} dash={dash} /></div>
          <div className="bk-dlg-fields">
            <input className="ev-title" value={d.title} aria-label="Title" onChange={e => set({ title: e.target.value })} />
            <input className="bk-input" value={d.author || ""} placeholder="Author" aria-label="Author" onChange={e => set({ author: e.target.value })} />
            <div className="bk-row">
              <select className="btn" value={d.status} aria-label="Status" onChange={e => set({ status: e.target.value as BookData["status"] })}>
                <option value="done">Read</option><option value="reading">Reading now</option><option value="want">Want to read</option>
              </select>
              {d.status === "done" && (
                <input className="btn bk-year" inputMode="numeric" value={yearOf(d)} aria-label="Year read"
                  onChange={e => set({ finished: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              )}
              {d.status === "reading" && (
                <label className="bk-prog sub">
                  <input type="range" min={0} max={100} step={5} value={d.progress} aria-label="Progress" onChange={e => set({ progress: Number(e.target.value) })} /> {d.progress}%
                </label>
              )}
            </div>
            <button type="button" className="btn sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Adding…" : "Use my own cover"}</button>
            <input ref={file} type="file" accept="image/*" hidden aria-label="Cover image" onChange={e => upload(e.target.files?.[0])} />
          </div>
        </div>
        <span className="label">Your thoughts</span>
        <textarea className="bk-notes" rows={6} value={d.thoughts || ""} placeholder="What stayed with you? Favorite lines, what you'd tell a friend…"
          aria-label="Your thoughts" onChange={e => set({ thoughts: e.target.value })} autoFocus={!d.thoughts} />
        <div className="ev-foot">
          <button type="button" className={"btn" + (confirm ? " danger" : "")} onClick={() => (confirm ? (dash.remove(book), onClose()) : setConfirm(true))}>
            {confirm ? "Delete this book?" : "Delete"}
          </button>
          <span className="grow1" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </dialog>
  );
}

/** Find covers for books that have none yet, one at a time, and keep what's found. */
function useCoverLookup(dash: Dashboard) {
  const tried = useRef(new Set<string>());
  const missing = dash.entries.books.filter(b => !b.data.cover && !tried.current.has(b.id));
  useEffect(() => {
    let live = true;
    (async () => {
      for (const b of missing) {
        if (!live) return;
        tried.current.add(b.id);
        try { dash.patch(b, { cover: await findCover(b.data.title, b.data.author) }); }
        catch { /* offline or blocked: try again next visit */ }
      }
    })();
    return () => { live = false; };
  }, [missing.map(b => b.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Shelf({ title, count, books, dash, open }: { title: string; count?: string; books: Entry<"books">[]; dash: Dashboard; open: (b: Entry<"books">) => void }) {
  if (!books.length) return null;
  return (
    <section className="glass bk-shelf" aria-label={title}>
      <h2 className="bk-shelf-title">{title} {count && <span className="sub">{count}</span>}</h2>
      <ul className="bk-grid">{books.map(b => <BookTile key={b.id} book={b} dash={dash} onOpen={() => open(b)} />)}</ul>
    </section>
  );
}

export function ReadingPage({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  useCoverLookup(dash);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const books = [...dash.entries.books].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = books.filter(b => b.data.status === "done");
  const years = [...new Set(done.map(b => yearOf(b.data)))].sort((a, b) => (b || "0").localeCompare(a || "0"));
  const opened = books.find(b => b.id === openId);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const status = v.status as BookData["status"];
    await dash.add("books", {
      title: v.title.trim(), author: v.author.trim(), status, progress: status === "done" ? 100 : 0,
      finished: status === "done" ? (v.year || today().slice(0, 4)) : "",
    });
    form.reset();
    (form.elements.namedItem("title") as HTMLInputElement).focus();
  };

  return (
    <PageShell path="/reading" actions={<>
      <ImportButton dash={dash} onDone={notify} />
      <button className="btn primary" onClick={() => setAdding(true)}>+ Add book</button>
    </>}>
      {adding && (
        <form className="glass fl-form" onSubmit={add}>
          <input className="btn fl-wide" name="title" placeholder="Title" required aria-label="Title" autoFocus />
          <input className="btn fl-wide" name="author" placeholder="Author" aria-label="Author" />
          <select className="btn" name="status" aria-label="Status" defaultValue="done">
            <option value="done">Read in</option><option value="reading">Reading now</option><option value="want">Want to read</option>
          </select>
          <input className="btn bk-year" name="year" inputMode="numeric" defaultValue={today().slice(0, 4)} aria-label="Year read" />
          <button className="btn primary">Add book</button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>Done</button>
        </form>
      )}
      {books.length === 0 && !adding ? (
        <section className="glass page-empty">
          <img className="mascot lg" src="/mascot.svg" alt="" />
          <h2>Your bookshelf is empty</h2>
          <p className="sub">Add the books you've read and they'll line up by year with their covers. Hover over one to see your thoughts on it.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>+ Add book</button>
        </section>
      ) : (<>
        <Shelf title="Reading now" books={books.filter(b => b.data.status === "reading")} dash={dash} open={b => setOpenId(b.id)} />
        {years.map(y => {
          const list = done.filter(b => yearOf(b.data) === y);
          return <Shelf key={y || "none"} title={y ? `Read in ${y}` : "Read"} count={plural(list.length, "book")} books={list} dash={dash} open={b => setOpenId(b.id)} />;
        })}
        <Shelf title="Want to read" books={books.filter(b => b.data.status === "want")} dash={dash} open={b => setOpenId(b.id)} />
      </>)}
      {opened && <BookDialog key={opened.id} book={opened} dash={dash} notify={notify} onClose={() => setOpenId(null)} />}
    </PageShell>
  );
}
