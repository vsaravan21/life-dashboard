import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, newId } from "../components/Outline";
import { Bar, plural } from "../components/ui";
import { addDays, fmt, iso, parse, today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { Entry, ProjectData, ProjectItem, ProjectSection } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";
import { colorOf, Swatches } from "./TodoPage";
import { Slides } from "./TravelPage";

type Project = Entry<"projects">;
type Patch = (p: Partial<ProjectData>) => void;

const SECTIONS: Record<ProjectSection, { title: string; hint: string }> = {
  milestones: { title: "Milestones", hint: "The big checkpoints" },
  tasks: { title: "Next steps", hint: "What to do next" },
  practice: { title: "Practice log", hint: "Time spent, with a streak" },
  skills: { title: "Skills", hint: "Learning, and got it" },
  updates: { title: "Updates", hint: "A dated log of progress" },
  links: { title: "Links", hint: "GitHub, Figma, docs…" },
  wishlist: { title: "Wishlist & gear", hint: "Supplies, tools, things to try" },
  inspo: { title: "Inspiration", hint: "Photos that spark ideas" },
  notes: { title: "Notes", hint: "Ideas, plans, anything" },
  photos: { title: "Photos", hint: "What you've made" },
};
/** Which sections to suggest first for each type. */
const SUGGEST: Record<ProjectData["type"], ProjectSection[]> = {
  project: ["milestones", "tasks", "updates", "links", "photos", "notes", "inspo", "wishlist", "skills", "practice"],
  hobby: ["practice", "skills", "wishlist", "inspo", "photos", "notes", "tasks", "milestones", "updates", "links"],
};
const STATUS: Record<ProjectData["status"], string> = { idea: "Idea", active: "In progress", paused: "Paused", done: "Done" };
const shelved = (p: Project) => p.data.status === "paused" || p.data.status === "done";

/* ---------- sections ---------- */

/** A checklist you add to, tick, rename and remove from. `split` files ticked items under their own heading instead of striking them out. */
function Checklist({ items, onChange, placeholder, split, progress }: {
  items: ProjectItem[]; onChange: (items: ProjectItem[]) => void; placeholder: string; split?: string; progress?: boolean;
}) {
  const [text, setText] = useState("");
  const set = (id: string, p: Partial<ProjectItem>) => onChange(items.map(i => (i.id === id ? { ...i, ...p } : i)));
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onChange([...items, { id: newId(), text: text.trim(), done: false }]);
    setText("");
  };
  const done = items.filter(i => i.done).length;
  const row = (i: ProjectItem) => (
    <li key={i.id} className={"pj-item" + (i.done && !split ? " done" : "")}>
      <button className="pj-check" aria-label={i.done ? `Untick ${i.text}` : `Tick ${i.text}`} onClick={() => set(i.id, { done: !i.done })}><Check done={i.done} /></button>
      <input className="pj-item-text" defaultValue={i.text} aria-label="Item" key={i.text}
        onBlur={e => { const t = e.target.value.trim(); if (!t) e.target.value = i.text; else if (t !== i.text) set(i.id, { text: t }); }}
        onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
      <button className="pj-x" aria-label={`Remove ${i.text}`} onClick={() => onChange(items.filter(x => x.id !== i.id))}>×</button>
    </li>
  );
  return (
    <>
      {progress && items.length > 0 && <div className="pj-progress"><Bar pct={(done / items.length) * 100} /></div>}
      <ul className="pj-list">{(split ? items.filter(i => !i.done) : items).map(row)}</ul>
      <form onSubmit={add}><input className="pj-add" value={text} placeholder={placeholder} aria-label={placeholder} onChange={e => setText(e.target.value)} /></form>
      {split && done > 0 && <><span className="label pj-sub">{split}</span><ul className="pj-list">{items.filter(i => i.done).map(row)}</ul></>}
    </>
  );
}

const minutesText = (m: number) => (m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} hr`);

/** Days in a row with practice, counting back from today (or yesterday, so the streak survives until tonight). */
export function streak(dates: string[], now = today()) {
  const set = new Set(dates);
  let d = set.has(now) ? parse(now) : addDays(parse(now), -1), n = 0;
  while (set.has(iso(d))) { n++; d = addDays(d, -1); }
  return n;
}

function Practice({ log, onChange }: { log: NonNullable<ProjectData["practice"]>; onChange: (l: NonNullable<ProjectData["practice"]>) => void }) {
  const [date, setDate] = useState(today());
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const month = today().slice(0, 7);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const m = Math.round(Number(minutes));
    if (!m || m < 1) return;
    onChange([...log, { id: newId(), date, minutes: m, ...(note.trim() ? { note: note.trim() } : {}) }]);
    setNote("");
  };
  const recent = [...log].sort((a, b) => b.date.localeCompare(a.date));
  const s = streak(log.map(l => l.date));
  return (
    <>
      <div className="pj-stats">
        <div><b>{minutesText(log.filter(l => l.date.startsWith(month)).reduce((t, l) => t + l.minutes, 0))}</b><span className="sub">this month</span></div>
        <div><b>{s ? `${s} 🔥` : "0"}</b><span className="sub">day streak</span></div>
        <div><b>{minutesText(log.reduce((t, l) => t + l.minutes, 0))}</b><span className="sub">all time</span></div>
      </div>
      <form className="pj-log-form" onSubmit={add}>
        <input className="btn" type="date" value={date} aria-label="Date" onChange={e => setDate(e.target.value)} />
        <label className="pj-min"><input className="btn" type="number" min={1} value={minutes} aria-label="Minutes" onChange={e => setMinutes(e.target.value)} /> min</label>
        <input className="btn pj-grow" value={note} placeholder="What did you work on?" aria-label="Note" onChange={e => setNote(e.target.value)} />
        <button className="btn primary sm">Log it</button>
      </form>
      <ul className="pj-list pj-log">
        {recent.slice(0, 8).map(l => (
          <li key={l.id} className="pj-item">
            <span className="pj-when">{fmt(l.date, { month: "short", day: "numeric" })}</span>
            <span className="pj-mins">{minutesText(l.minutes)}</span>
            <span className="pj-grow sub">{l.note}</span>
            <button className="pj-x" aria-label="Remove session" onClick={() => onChange(log.filter(x => x.id !== l.id))}>×</button>
          </li>
        ))}
      </ul>
      {recent.length > 8 && <p className="sub">+ {plural(recent.length - 8, "earlier session")}</p>}
    </>
  );
}

function Updates({ list, onChange }: { list: NonNullable<ProjectData["updates"]>; onChange: (l: NonNullable<ProjectData["updates"]>) => void }) {
  const [text, setText] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onChange([...list, { id: newId(), date: today(), text: text.trim() }]);
    setText("");
  };
  return (
    <>
      <form onSubmit={add}><input className="pj-add" value={text} placeholder="What happened? Press Enter to post" aria-label="New update" onChange={e => setText(e.target.value)} /></form>
      <ol className="pj-timeline">
        {[...list].reverse().map(u => (
          <li key={u.id}>
            <span className="pj-when">{fmt(u.date, { month: "short", day: "numeric", year: "numeric" })}</span>
            <span className="pj-grow">{u.text}</span>
            <button className="pj-x" aria-label="Remove update" onClick={() => onChange(list.filter(x => x.id !== u.id))}>×</button>
          </li>
        ))}
      </ol>
    </>
  );
}

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

function Links({ list, onChange }: { list: NonNullable<ProjectData["links"]>; onChange: (l: NonNullable<ProjectData["links"]>) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    onChange([...list, { id: newId(), label: label.trim() || hostOf(full), url: full }]);
    setLabel(""); setUrl("");
  };
  return (
    <>
      <ul className="pj-links">
        {list.map(l => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noreferrer">{l.label}{l.label !== hostOf(l.url) && <span className="sub"> · {hostOf(l.url)}</span>}</a>
            <button className="pj-x" aria-label={`Remove ${l.label}`} onClick={() => onChange(list.filter(x => x.id !== l.id))}>×</button>
          </li>
        ))}
      </ul>
      <form className="pj-log-form" onSubmit={add}>
        <input className="btn" value={label} placeholder="Name (optional)" aria-label="Link name" onChange={e => setLabel(e.target.value)} />
        <input className="btn pj-grow" value={url} placeholder="Paste a link" aria-label="Link address" onChange={e => setUrl(e.target.value)} />
        <button className="btn sm">Add</button>
      </form>
    </>
  );
}

function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setText(value), [value]);
  useEffect(() => { const el = area.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [text]);
  return <textarea ref={area} className="pj-notes-text" rows={4} value={text} placeholder="Ideas, plans, what you learned…" aria-label="Notes"
    onChange={e => setText(e.target.value)} onBlur={() => text !== value && onSave(text)} />;
}

function InspoTile({ dash, photo, onRemove }: { dash: Dashboard; photo: string; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let live = true; dash.store.photoUrl(photo).then(u => live && setSrc(u)); return () => { live = false; }; }, [dash.store, photo]);
  return (
    <li className="pj-inspo-tile">
      {src && <img src={src} alt="" loading="lazy" />}
      <button className="pj-x" aria-label="Remove photo" onClick={onRemove}>×</button>
    </li>
  );
}

function Inspo({ project, dash, notify, patch }: { project: Project; dash: Dashboard; notify: (m: string) => void; patch: Patch }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const list = project.data.inspo ?? [];
  const add = async (files: FileList | null) => {
    const imgs = [...(files ?? [])].filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(true);
    const refs: string[] = [];
    try { for (const f of imgs) refs.push(await dash.store.uploadPhoto(await shrinkPhoto(f, 900))); }
    catch (e) { notify(e instanceof Error ? e.message : "Couldn't add that photo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
    if (refs.length) patch({ inspo: [...list, ...refs] });
  };
  return (
    <ul className="pj-inspo">
      {list.map(p => <InspoTile key={p} dash={dash} photo={p} onRemove={() => { patch({ inspo: list.filter(x => x !== p) }); dash.store.removePhoto(p).catch(() => undefined); }} />)}
      <li>
        <button className="pj-inspo-add" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : "+ Add"}</button>
        <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Add inspiration photos" onChange={e => add(e.target.files)} />
      </li>
    </ul>
  );
}

function SectionCard({ id, children, onHide, extra }: { id: ProjectSection; children: ReactNode; onHide: () => void; extra?: ReactNode }) {
  return (
    <section className={"glass pj-card pj-card-" + id} aria-label={SECTIONS[id].title}>
      <header className="pj-card-head">
        <h3>{SECTIONS[id].title}</h3>
        {extra}
        <button className="pj-hide" onClick={onHide} title="Hide this section. Anything in it is kept.">Hide</button>
      </header>
      <div className="pj-card-body">{children}</div>
    </section>
  );
}

/* ---------- one project ---------- */

function ProjectView({ project, dash, notify, onDeleted }: { project: Project; dash: Dashboard; notify: (m: string) => void; onDeleted: () => void }) {
  const d = project.data;
  const patch: Patch = p => void dash.patch(project, p);
  const [name, setName] = useState(d.name);
  const [why, setWhy] = useState(d.why ?? "");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setName(d.name); setWhy(d.why ?? ""); setMenu(false); setConfirm(false); }, [project.id, d.name, d.why]);
  const on = d.sections;
  const hide = (s: ProjectSection) => patch({ sections: on.filter(x => x !== s) });
  const offered = SUGGEST[d.type].filter(s => !on.includes(s));

  const body = (s: ProjectSection) => {
    switch (s) {
      case "milestones": return <Checklist items={d.milestones ?? []} onChange={milestones => patch({ milestones })} placeholder="+ Add a milestone" progress />;
      case "tasks": return <Checklist items={d.tasks ?? []} onChange={tasks => patch({ tasks })} placeholder="+ Add a next step" />;
      case "skills": return <Checklist items={d.skills ?? []} onChange={skills => patch({ skills })} placeholder="+ Add a skill you're learning" split="Got it ✓" />;
      case "wishlist": return <Checklist items={d.wishlist ?? []} onChange={wishlist => patch({ wishlist })} placeholder="+ Add something to get or try" split="Got it" />;
      case "practice": return <Practice log={d.practice ?? []} onChange={practice => patch({ practice })} />;
      case "updates": return <Updates list={d.updates ?? []} onChange={updates => patch({ updates })} />;
      case "links": return <Links list={d.links ?? []} onChange={links => patch({ links })} />;
      case "notes": return <Notes value={d.notes ?? ""} onSave={notes => patch({ notes })} />;
      case "inspo": return <Inspo project={project} dash={dash} notify={notify} patch={patch} />;
      case "photos": return <Slides trip={project} label={d.name} dash={dash} notify={notify} />;
    }
  };

  return (
    <div className="pj-view">
      <header className={`glass pj-head cover ${colorOf(d.color).cover}`}>
        <input className="pj-emoji" value={d.emoji} aria-label="Emoji" maxLength={4} onChange={e => patch({ emoji: e.target.value })} />
        <div className="pj-heading">
          <input className="pj-name" value={name} aria-label="Name" onChange={e => setName(e.target.value)}
            onBlur={() => { const n = name.trim() || d.name; setName(n); if (n !== d.name) patch({ name: n }); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
          <input className="pj-why" value={why} placeholder={d.type === "hobby" ? "Why you love it" : "What it's for, in a line"} aria-label="Why"
            onChange={e => setWhy(e.target.value)} onBlur={() => why.trim() !== (d.why ?? "") && patch({ why: why.trim() })} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
          <div className="pj-meta">
            <span className="pill">{d.type === "hobby" ? "Hobby" : "Project"}</span>
            <select className={"pj-status s-" + d.status} value={d.status} aria-label="Status" onChange={e => patch({ status: e.target.value as ProjectData["status"] })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="pj-date">{d.type === "hobby" ? "Since" : "Started"}
              <input type="date" value={d.start ?? ""} onChange={e => patch({ start: e.target.value })} />
            </label>
            {d.type === "project" && <label className="pj-date">Target
              <input type="date" value={d.target ?? ""} onChange={e => patch({ target: e.target.value })} />
            </label>}
          </div>
        </div>
        <button className="tl-menu-btn" aria-label="Options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </button>
      </header>
      {menu && (
        <div className="tl-menu pj-menu glass">
          <span className="label">Color</span>
          <Swatches value={d.color} onChange={color => patch({ color })} />
          <span className="label">Type</span>
          <div className="seg">
            {(["project", "hobby"] as const).map(t => <button key={t} className={d.type === t ? "on" : ""} onClick={() => patch({ type: t })}>{t === "hobby" ? "Hobby" : "Project"}</button>)}
          </div>
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? (dash.remove(project), onDeleted()) : setConfirm(true))}>
            {confirm ? `Delete ${d.name} and everything in it?` : "Delete"}
          </button>
        </div>
      )}
      <div className="pj-grid">
        {on.map(s => (
          <SectionCard key={s} id={s} onHide={() => hide(s)}
            extra={s === "milestones" && (d.milestones?.length ?? 0) > 0 ? <span className="sub">{Math.round(((d.milestones ?? []).filter(m => m.done).length / d.milestones!.length) * 100)}%</span> : undefined}>
            {body(s)}
          </SectionCard>
        ))}
      </div>
      {offered.length > 0 && (
        <div className="pj-offer">
          <span className="label">Add a section</span>
          <div className="pj-chips">
            {offered.map(s => (
              <button key={s} className="btn sm" title={SECTIONS[s].hint} onClick={() => patch({ sections: [...on, s] })}>+ {SECTIONS[s].title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- the page ---------- */

function NewProject({ dash, onMade, onCancel }: { dash: Dashboard; onMade: (id: string) => void; onCancel?: () => void }) {
  const [type, setType] = useState<ProjectData["type"]>("project");
  const [emoji, setEmoji] = useState("");
  const make = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    const colors = ["sunset", "periwinkle", "mint", "orchid", "peach", "blush", "honey", "petal"];
    const made = await dash.add("projects", {
      name, type, emoji: emoji.trim() || (type === "hobby" ? "🎨" : "🚀"), color: colors[dash.entries.projects.length % colors.length],
      status: "active", start: today(), sections: ["notes", "photos"],
    });
    if (made) onMade(made.id);
  };
  return (
    <form className="glass pj-new" onSubmit={make}>
      <div className="seg" role="radiogroup" aria-label="Type">
        <button type="button" role="radio" aria-checked={type === "project"} className={type === "project" ? "on" : ""} onClick={() => setType("project")}>🚀 Project</button>
        <button type="button" role="radio" aria-checked={type === "hobby"} className={type === "hobby" ? "on" : ""} onClick={() => setType("hobby")}>🎨 Hobby</button>
      </div>
      <div className="pj-new-row">
        <input className="btn pj-new-emoji" value={emoji} placeholder={type === "hobby" ? "🎨" : "🚀"} aria-label="Emoji" maxLength={4} onChange={e => setEmoji(e.target.value)} />
        <input className="btn pj-grow" name="name" required autoFocus placeholder={type === "hobby" ? "Piano, pottery, running…" : "Portfolio site, room makeover…"} aria-label="Name" />
        <button className="btn primary">Create</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
      <p className="sub">It starts with notes and photos. Add milestones, a practice log and more once it's made.</p>
    </form>
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
  const live = all.filter(p => !shelved(p));
  const shelf = all.filter(shelved);
  const current = sel === "shelf" ? null : all.find(p => p.id === sel) ?? live[0] ?? null;
  const showShelf = sel === "shelf" || (!current && shelf.length > 0);
  // A shelved project you opened keeps its tab while you're on it.
  const tabs = current && shelved(current) ? [...live, current] : live;

  return (
    <PageShell path="/projects" actions={<button className="btn primary" onClick={() => setMaking(true)}>+ New</button>}>
      {all.length > 0 && (
        <div className="seg pj-tabs" role="tablist" aria-label="Projects and hobbies">
          {tabs.map(p => (
            <button key={p.id} role="tab" aria-selected={!making && !showShelf && current?.id === p.id} className={!making && !showShelf && current?.id === p.id ? "on" : ""} onClick={() => setSel(p.id)}>
              <span aria-hidden="true">{p.data.emoji}</span> {p.data.name}
            </button>
          ))}
          {shelf.length > 0 && (
            <button role="tab" aria-selected={!making && showShelf} className={!making && showShelf ? "on" : ""} onClick={() => setSel("shelf")}>Done & paused ({shelf.length})</button>
          )}
        </div>
      )}
      {making || all.length === 0 ? (
        <>
          {all.length === 0 && (
            <section className="glass page-empty">
              <img className="mascot lg" src="/mascot.svg" alt="" />
              <h2>Start your first project or hobby</h2>
              <p className="sub">Each one gets its own tab, with only the sections it needs: milestones for a project, a practice log and streak for a hobby.</p>
            </section>
          )}
          <NewProject dash={dash} onMade={setSel} onCancel={all.length ? () => setMaking(false) : undefined} />
        </>
      ) : showShelf ? (
        <ul className="pj-shelf">
          {shelf.map(p => (
            <li key={p.id}>
              <button className={`glass pj-shelf-card`} onClick={() => setSel(p.id)}>
                <span className={`pj-shelf-cover cover ${colorOf(p.data.color).cover}`}><span className="pj-shelf-emoji">{p.data.emoji}</span></span>
                <b>{p.data.name}</b>
                <span className="sub">{STATUS[p.data.status]} · {p.data.type === "hobby" ? "Hobby" : "Project"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : current ? (
        <ProjectView key={current.id} project={current} dash={dash} notify={notify} onDeleted={() => setSel("")} />
      ) : null}
    </PageShell>
  );
}
