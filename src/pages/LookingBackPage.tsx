import { useEffect, useState } from "react";
import { ImportButton } from "../components/ImportButton";
import { newId, Outline } from "../components/Outline";
import type { Entry, LookbackData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { colorOf, LIST_COLORS } from "./TodoPage";
import { PageShell } from "./PageShell";

/** Each month keeps its own color, cycling through the section paints. */
const COLORS = Object.keys(LIST_COLORS);
export const monthCover = (month: number) => colorOf(COLORS[(month - 1) % COLORS.length]).cover;
export const monthName = (month: number) => new Date(2000, month - 1, 1).toLocaleDateString(undefined, { month: "long" });

function SectionTitle({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input className="lb-section label" value={text} placeholder="Section title" aria-label="Section title"
      onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())}
      onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
  );
}

/** One month: its sections of highlights. */
function MonthCard({ month, dash }: { month: Entry<"lookback">; dash: Dashboard }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { sections } = month.data;
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const setSections = (next: LookbackData["sections"]) => dash.patch(month, { sections: next });
  const update = (id: string, change: Partial<LookbackData["sections"][number]>) =>
    setSections(sections.map(s => (s.id === id ? { ...s, ...change } : s)));

  return (
    <section className="glass tl-card lb-card" aria-label={`${monthName(month.data.month)} ${month.data.year}`}>
      <header className={`cover tl-head ${monthCover(month.data.month)}`}>
        <div className="tl-heading">
          <h2 className="tl-title">{monthName(month.data.month)}</h2>
          <span className="tl-date">{month.data.year} · {count} {count === 1 ? "highlight" : "highlights"}</span>
        </div>
        <button className="tl-menu-btn" aria-label="Month options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </button>
      </header>
      {menu && (
        <div className="tl-menu">
          <button className="btn sm" onClick={() => { setSections([...sections, { id: newId(), title: "New section", items: [] }]); setMenu(false); }}>+ Add section</button>
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? dash.remove(month) : setConfirm(true))}>
            {confirm ? `Delete ${monthName(month.data.month)} ${month.data.year}?` : "Delete month"}
          </button>
        </div>
      )}
      <div className="card-scroll">
      {sections.map(s => (
        <div className="lb-group" key={s.id}>
          {(s.title || sections.length > 1) && (
            <div className="lb-group-head">
              <SectionTitle value={s.title} onSave={title => update(s.id, { title })} />
              {sections.length > 1 && (
                <button className="tl-x" aria-label={`Remove section ${s.title}`} title="Remove section"
                  onClick={() => (s.items.length === 0 || window.confirm(`Remove "${s.title || "this section"}" and its ${s.items.length} items?`)) && setSections(sections.filter(x => x.id !== s.id))}>×</button>
              )}
            </div>
          )}
          <Outline items={s.items} onChange={items => update(s.id, { items })} placeholder="Add a highlight" label={`New highlight${s.title ? ` in ${s.title}` : ""}`} />
        </div>
      ))}
      </div>
    </section>
  );
}

export function LookingBackPage({ dash, notify }: { dash: Dashboard; notify: (msg: string) => void }) {
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const [pick, setPick] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const months = [...dash.entries.lookback].sort((a, b) => b.data.year - a.data.year || b.data.month - a.data.month);
  const years = [...new Set(months.map(m => m.data.year))];

  const add = async () => {
    const [y, m] = pick.split("-").map(Number);
    if (!y || !m) return notify("Pick a month.");
    const existing = months.find(x => x.data.year === y && x.data.month === m);
    if (!existing) await dash.add("lookback", { year: y, month: m, sections: [{ id: newId(), title: "", items: [] }] });
    else notify(`${monthName(m)} ${y} is already here.`);
    setAdding(false);
  };

  const form = (
    <form className="gl-addyear" onSubmit={e => { e.preventDefault(); add(); }}>
      <input className="btn" type="month" value={pick} onChange={e => setPick(e.target.value)} aria-label="Month" />
      <button className="btn primary">Add</button>
      <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
    </form>
  );

  return (
    <PageShell path="/looking-back" actions={<>
      <ImportButton dash={dash} onDone={notify} />
      {adding ? form : <button className="btn primary" onClick={() => setAdding(true)}>+ Add month</button>}
    </>}>
      {months.length === 0 ? (
        <section className="glass page-empty">
          <img className="mascot lg" src="/mascot.svg" alt="" />
          <h2>Look back on each month</h2>
          <p className="sub">Add a month and jot down the fun things, people and wins that made it. Or import a goals file.</p>
          {adding ? form : <button className="btn primary" onClick={() => setAdding(true)}>+ Add month</button>}
        </section>
      ) : years.map(y => {
        const list = months.filter(m => m.data.year === y);
        return (
          <section key={y} className="lb-year" aria-label={String(y)}>
            <h2 className="lb-year-title">{y} <span className="sub">{list.length} {list.length === 1 ? "month" : "months"}</span></h2>
            <div className="tl-grid">
              {list.map(m => <MonthCard key={m.id} month={m} dash={dash} />)}
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
