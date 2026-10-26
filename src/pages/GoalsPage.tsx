import { useState } from "react";
import { ImportButton } from "../components/ImportButton";
import { Outline, tally } from "../components/Outline";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { colorOf, Swatches } from "./TodoPage";
import { PageShell } from "./PageShell";

const CAT_COLORS = ["periwinkle", "mint", "blush", "peach", "orchid", "honey", "sunset", "prism", "petal"];

/** One category card: its goals as a checklist, with sub-goals nested under them. */
function CategoryCard({ cat, dash, fresh }: { cat: Entry<"goalcats">; dash: Dashboard; fresh: boolean }) {
  const [title, setTitle] = useState(cat.data.title);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { done, total } = tally(cat.data.items);
  const saveTitle = () => {
    const t = title.trim() || "Untitled";
    setTitle(t);
    if (t !== cat.data.title) dash.patch(cat, { title: t });
  };
  return (
    <section className="glass tl-card" aria-label={cat.data.title}>
      <header className={`cover tl-head ${colorOf(cat.data.color).cover}`}>
        <div className="tl-heading">
          <input className="tl-title" value={title} aria-label="Category name" onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
          <span className="tl-date">{total ? `${done} of ${total} done` : "No goals yet"}</span>
        </div>
        <button className="tl-menu-btn" aria-label="Category options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </button>
      </header>
      {menu && (
        <div className="tl-menu">
          <span className="label">Color</span>
          <Swatches value={cat.data.color} onChange={color => dash.patch(cat, { color })} />
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? dash.remove(cat) : setConfirm(true))}>
            {confirm ? `Delete ${cat.data.title}${total ? ` and its ${total} goal${total === 1 ? "" : "s"}` : ""}?` : "Delete category"}
          </button>
        </div>
      )}
      {total > 0 && <div className="gl-bar" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></div>}
      <div className="card-scroll">
        <Outline checks items={cat.data.items} onChange={items => dash.patch(cat, { items })} placeholder="New goal" label={`New goal in ${cat.data.title}`} autoFocus={fresh} />
      </div>
    </section>
  );
}

export function GoalsPage({ dash, notify }: { dash: Dashboard; notify: (msg: string) => void }) {
  const years = [...new Set(dash.entries.goalyears.map(y => y.data.year))].sort((a, b) => b - a);
  const now = new Date().getFullYear();
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked !== null && years.includes(picked) ? picked : years.includes(now) ? now : years[0];

  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(String(now));
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CAT_COLORS[0]);
  const [fresh, setFresh] = useState<string | null>(null);

  const cats = dash.entries.goalcats.filter(c => c.data.year === year).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const all = cats.flatMap(c => c.data.items), done = all.filter(i => i.done).length;

  const addYear = async () => {
    const y = Number(newYear);
    if (!Number.isInteger(y) || y < 1900 || y > 2999) return notify("Enter a year like 2027.");
    if (!years.includes(y)) await dash.add("goalyears", { year: y });
    setPicked(y);
    setAddingYear(false);
  };
  const addCategory = async () => {
    const c = await dash.add("goalcats", { year, title: name.trim() || "Untitled", color, items: [] });
    if (c) setFresh(c.id);
    setName("");
    setColor(CAT_COLORS[(cats.length + 1) % CAT_COLORS.length]);
    setComposing(false);
  };

  const yearForm = (
    <form className="gl-addyear" onSubmit={e => { e.preventDefault(); addYear(); }}>
      <input className="btn" inputMode="numeric" autoFocus value={newYear} onChange={e => setNewYear(e.target.value)} aria-label="Year" />
      <button className="btn primary">Add</button>
      <button type="button" className="btn" onClick={() => setAddingYear(false)}>Cancel</button>
    </form>
  );

  return (
    <PageShell path="/goals" actions={<>
      <ImportButton dash={dash} onDone={notify} />
      {year !== undefined && <button className="btn primary" onClick={() => { setComposing(true); setColor(CAT_COLORS[cats.length % CAT_COLORS.length]); }}>+ New category</button>}
    </>}>
      {year === undefined ? (
        <section className="glass page-empty">
          <img className="mascot lg" src="/mascot.svg" alt="" />
          <h2>Start with a year</h2>
          <p className="sub">Add a year, then give it categories like Health or Career and fill each with goals you can tick off. Or import a goals file.</p>
          {addingYear ? yearForm : <button className="btn primary" onClick={() => setAddingYear(true)}>+ Add a year</button>}
        </section>
      ) : (<>
        <section className="glass gl-years">
          <div className="seg" role="tablist" aria-label="Year">
            {years.map(y => (
              <button key={y} role="tab" aria-selected={y === year} className={y === year ? "on" : ""} onClick={() => setPicked(y)}>{y}</button>
            ))}
          </div>
          {addingYear ? yearForm : <button className="btn sm" onClick={() => setAddingYear(true)}>+ Add year</button>}
          <div className="gl-sum">
            {all.length > 0 && <>
              <span><b>{done}</b> of {all.length} goals done in {year}</span>
              <div className="gl-bar" aria-hidden="true"><span style={{ width: `${(done / all.length) * 100}%` }} /></div>
            </>}
          </div>
        </section>
        <div className="tl-grid">
          {composing && (
            <form className="glass tl-card tl-compose" onSubmit={e => { e.preventDefault(); addCategory(); }}>
              <div className={`cover tl-head ${colorOf(color).cover}`}>
                <div className="tl-heading">
                  <input className="tl-title" autoFocus value={name} placeholder="Name the category" aria-label="Category name" onChange={e => setName(e.target.value)} />
                  <span className="tl-date">{year}</span>
                </div>
              </div>
              <span className="label">Color</span>
              <Swatches value={color} onChange={setColor} />
              <div className="tl-compose-acts">
                <button type="button" className="btn" onClick={() => setComposing(false)}>Cancel</button>
                <button className="btn primary">Add category</button>
              </div>
            </form>
          )}
          {cats.map(c => <CategoryCard key={c.id} cat={c} dash={dash} fresh={fresh === c.id} />)}
          {!composing && cats.length === 0 && (
            <section className="glass page-empty tl-empty">
              <h2>No categories in {year} yet</h2>
              <p className="sub">Add a category like Health, Career or Relationships, then list its goals. Press Tab on a goal to nest it under the one above.</p>
              <button className="btn primary" onClick={() => setComposing(true)}>+ New category</button>
            </section>
          )}
        </div>
      </>)}
    </PageShell>
  );
}
