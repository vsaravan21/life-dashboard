import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { newId } from "../components/Outline";
import { plural } from "../components/ui";
import { today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import { isImageFile, isVideoFile, isVideoRef, MAX_FILE_MB } from "../lib/media";
import type { Entry, ProjectCard, ProjectData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";
import { colorOf, Swatches } from "./TodoPage";

type Project = Entry<"projects">;
const STATUS: Record<ProjectData["status"], string> = { idea: "Idea", active: "In progress", paused: "Paused", done: "Done" };
const COLORS = ["sunset", "periwinkle", "mint", "orchid", "peach", "blush", "honey", "petal"];

const sizeText = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE");

function useUrl(dash: Dashboard, ref: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let live = true; dash.store.photoUrl(ref).then(u => live && setSrc(u)); return () => { live = false; }; }, [dash.store, ref]);
  return src;
}

function Media({ dash, photo, onOpen, onRemove }: { dash: Dashboard; photo: string; onOpen: (src: string) => void; onRemove: () => void }) {
  const src = useUrl(dash, photo);
  return (
    <li className="pc-media">
      {src && (isVideoRef(photo)
        ? <video src={src} controls playsInline preload="metadata" />
        : <button className="pc-media-open" aria-label="View photo" onClick={() => onOpen(src)}><img src={src} alt="" loading="lazy" draggable={false} /></button>)}
      <button className="pc-x on-media" aria-label="Remove photo" onClick={onRemove}>×</button>
    </li>
  );
}

function FileRow({ dash, file, onRemove }: { dash: Dashboard; file: ProjectCard["files"][number]; onRemove: () => void }) {
  const src = useUrl(dash, file.ref);
  return (
    <li className="pc-file">
      <a href={src ?? undefined} download={file.name} target="_blank" rel="noreferrer">
        <span className="pc-ext">{extOf(file.name)}</span>
        <span className="pc-file-name">{file.name}</span>
        <span className="sub">{sizeText(file.size)}</span>
      </a>
      <button className="pc-x" aria-label={`Remove ${file.name}`} onClick={onRemove}>×</button>
    </li>
  );
}

/** One card: a title, text, photos and files. Drop files on it, or use the buttons. */
function Card({ card, dash, notify, onChange, onDelete, onOpen }: {
  card: ProjectCard; dash: Dashboard; notify: (m: string) => void;
  onChange: (p: Partial<ProjectCard>) => void; onDelete: () => void; onOpen: (src: string) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [text, setText] = useState(card.text);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const photoIn = useRef<HTMLInputElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const latest = useRef(card);
  latest.current = card;
  useEffect(() => setTitle(card.title), [card.title]);
  useEffect(() => setText(card.text), [card.text]);
  useEffect(() => { const el = area.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [text]);

  const add = async (list: File[]) => {
    const big = list.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (big.length) notify(`${big.length === 1 ? `"${big[0].name}" is` : `${big.length} files are`} over ${MAX_FILE_MB} MB, so ${big.length === 1 ? "it was" : "they were"} skipped.`);
    const ok = list.filter(f => !big.includes(f));
    if (!ok.length) return;
    setBusy(ok.length);
    const media: string[] = [], files: ProjectCard["files"] = [];
    try {
      for (const f of ok) {
        if (isImageFile(f) && f.type !== "image/svg+xml") media.push(await dash.store.uploadPhoto(await shrinkPhoto(f)));
        else if (isVideoFile(f)) media.push(await dash.store.uploadPhoto(f));
        else files.push({ ref: await dash.store.uploadPhoto(f), name: f.name, size: f.size, type: f.type });
        setBusy(b => b - 1);
      }
    } catch (e) { notify(e instanceof Error ? e.message : "Couldn't add that file."); }
    finally { setBusy(0); }
    // Read the card again, in case it changed while files were uploading.
    const now = latest.current;
    if (media.length || files.length) onChange({ media: [...now.media, ...media], files: [...now.files, ...files] });
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); };
  const forget = (ref: string) => dash.store.removePhoto(ref).catch(() => undefined);

  return (
    <article className={"glass pc" + (over ? " over" : "")} onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }} onDrop={drop}>
      <header className="pc-head">
        <input className="pc-title" value={title} placeholder="Card title" aria-label="Card title" onChange={e => setTitle(e.target.value)}
          onBlur={() => title.trim() !== card.title && onChange({ title: title.trim() })} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
        <button className={"pc-del" + (confirm ? " sure" : "")} onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)}
          aria-label={confirm ? "Tap again to delete this card" : "Delete card"} title="Delete card">{confirm ? "Delete card?" : "×"}</button>
      </header>
      <textarea ref={area} className="pc-text" rows={2} value={text} placeholder="Write something…" aria-label="Card text"
        onChange={e => setText(e.target.value)} onBlur={() => text !== card.text && onChange({ text })} />
      {card.media.length > 0 && (
        <ul className="pc-grid">
          {card.media.map(m => <Media key={m} dash={dash} photo={m} onOpen={onOpen} onRemove={() => { onChange({ media: card.media.filter(x => x !== m) }); forget(m); }} />)}
        </ul>
      )}
      {card.files.length > 0 && (
        <ul className="pc-files">
          {card.files.map(f => <FileRow key={f.ref} dash={dash} file={f} onRemove={() => { onChange({ files: card.files.filter(x => x.ref !== f.ref) }); forget(f.ref); }} />)}
        </ul>
      )}
      <footer className="pc-foot">
        <button className="btn sm" disabled={busy > 0} onClick={() => photoIn.current?.click()}>+ Photos</button>
        <button className="btn sm" disabled={busy > 0} onClick={() => fileIn.current?.click()}>+ Files</button>
        {busy > 0 && <span className="sub">Adding {plural(busy, "file")}…</span>}
        {over && <span className="sub">Drop to add</span>}
        <input ref={photoIn} type="file" accept="image/*,video/*" multiple hidden aria-label="Add photos or videos" onChange={e => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={fileIn} type="file" multiple hidden aria-label="Add files" onChange={e => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </footer>
    </article>
  );
}

function ProjectView({ project, dash, notify, onDeleted }: { project: Project; dash: Dashboard; notify: (m: string) => void; onDeleted: () => void }) {
  const d = project.data;
  const cards = d.cards ?? [];
  const [name, setName] = useState(d.name);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const latest = useRef(project);
  latest.current = project;
  useEffect(() => setName(d.name), [d.name]);

  // Always build on the newest cards, so quick edits to two cards don't undo each other.
  const setCards = (fn: (c: ProjectCard[]) => ProjectCard[]) => dash.patch(latest.current, { cards: fn(latest.current.data.cards ?? []) });
  const addCard = () => setCards(c => [...c, { id: newId(), title: "", text: "", media: [], files: [] }]);

  return (
    <div className="pj-view">
      <header className={`glass pj-head cover ${colorOf(d.color).cover}`}>
        <div className="pj-heading">
          <input className="pj-name" value={name} aria-label="Project name" onChange={e => setName(e.target.value)}
            onBlur={() => { const n = name.trim() || d.name; setName(n); if (n !== d.name) dash.patch(project, { name: n }); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
          {!(d.hideStatus && d.hideDates) && (
            <div className="pj-meta">
              {!d.hideStatus && (
                <select className={"pj-status s-" + d.status} value={d.status} aria-label="Status" onChange={e => dash.patch(project, { status: e.target.value as ProjectData["status"] })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              {!d.hideDates && <>
                <label className="pj-date">Start<input type="date" value={d.start ?? ""} onChange={e => dash.patch(project, { start: e.target.value })} /></label>
                <label className="pj-date">End<input type="date" value={d.end ?? ""} min={d.start} onChange={e => dash.patch(project, { end: e.target.value })} /></label>
              </>}
            </div>
          )}
        </div>
        <button className="tl-menu-btn" aria-label="Project options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </button>
      </header>
      {menu && (
        <div className="tl-menu pj-menu glass">
          <span className="label">Show</span>
          <label className="pj-toggle"><input type="checkbox" checked={!d.hideStatus} onChange={e => dash.patch(project, { hideStatus: !e.target.checked })} /> Status</label>
          <label className="pj-toggle"><input type="checkbox" checked={!d.hideDates} onChange={e => dash.patch(project, { hideDates: !e.target.checked })} /> Dates</label>
          <span className="label">Color</span>
          <Swatches value={d.color} onChange={color => dash.patch(project, { color })} />
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? (dash.remove(project), onDeleted()) : setConfirm(true))}>
            {confirm ? `Delete ${d.name} and everything in it?` : "Delete project"}
          </button>
        </div>
      )}
      <div className="pc-wall">
        {cards.map(c => (
          <Card key={c.id} card={c} dash={dash} notify={notify} onOpen={setViewing}
            onChange={p => setCards(list => list.map(x => (x.id === c.id ? { ...x, ...p } : x)))}
            onDelete={() => {
              setCards(list => list.filter(x => x.id !== c.id));
              for (const r of [...c.media, ...c.files.map(f => f.ref)]) dash.store.removePhoto(r).catch(() => undefined);
            }} />
        ))}
        <button className="pc-new" onClick={addCard}>+ Add a card</button>
      </div>
      {viewing && (
        <div className="pc-lightbox" role="dialog" aria-label="Photo" tabIndex={-1} ref={el => el?.focus()}
          onClick={() => setViewing(null)} onKeyDown={e => e.key === "Escape" && setViewing(null)}>
          <img src={viewing} alt="" />
          <button className="pc-x" aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}

const fromHash = () => decodeURIComponent(window.location.hash.slice(1));

export function ProjectsPage({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const all = [...dash.entries.projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [sel, setSelState] = useState(fromHash);
  const [making, setMaking] = useState(false);
  const setSel = (id: string) => {
    setSelState(id);
    setMaking(false);
    window.history.replaceState(null, "", id ? `#${encodeURIComponent(id)}` : window.location.pathname);
  };
  const current = all.find(p => p.id === sel) ?? all[0] ?? null;

  const make = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    const made = await dash.add("projects", { name, color: COLORS[all.length % COLORS.length], status: "active", start: today(), cards: [] });
    if (made) setSel(made.id);
  };

  return (
    <PageShell path="/projects" actions={<button className="btn primary" onClick={() => setMaking(true)}>+ New project</button>}>
      {all.length > 0 && (
        <div className="seg pj-tabs" role="tablist" aria-label="Projects">
          {all.map(p => (
            <button key={p.id} role="tab" aria-selected={!making && current?.id === p.id} className={!making && current?.id === p.id ? "on" : ""} onClick={() => setSel(p.id)}>
              {!p.data.hideStatus && <span className={"pj-dot s-" + p.data.status} title={STATUS[p.data.status]} aria-hidden="true" />}{p.data.name}
            </button>
          ))}
        </div>
      )}
      {making || !current ? (
        <>
          {!current && (
            <section className="glass page-empty">
              <img className="mascot lg" src="/mascot.svg" alt="" />
              <h2>Start your first project</h2>
              <p className="sub">Each project gets its own tab with dates and a status. Fill it with cards of notes, photos and files.</p>
            </section>
          )}
          <form className="glass pj-new" onSubmit={make}>
            <input className="btn pj-grow" name="name" required autoFocus placeholder="Name your project" aria-label="Project name" />
            <button className="btn primary">Create</button>
            {current && <button type="button" className="btn" onClick={() => setMaking(false)}>Cancel</button>}
          </form>
        </>
      ) : (
        <ProjectView key={current.id} project={current} dash={dash} notify={notify} onDeleted={() => setSel("")} />
      )}
    </PageShell>
  );
}
