import { useEffect, useRef, useState, type FormEvent } from "react";
import { plural } from "../components/ui";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { PageShell } from "./PageShell";

/** Sticky-note pastels, flat like real paper. */
export const STICKY_COLORS: Record<string, string> = {
  butter: "Butter", peach: "Peach", blush: "Blush", lilac: "Lilac", sky: "Sky", mint: "Mint",
};
const COLOR_IDS = Object.keys(STICKY_COLORS);

const stamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
};
/** A small, steady tilt per note so the board looks hand-stuck without jumping around. */
const tilt = (id: string) => ((([...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 7) - 3) * 0.6).toFixed(1);

function Dots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <span className="gr-dots" role="radiogroup" aria-label="Note color">
      {COLOR_IDS.map(c => (
        <button type="button" key={c} role="radio" aria-checked={value === c} aria-label={STICKY_COLORS[c]} title={STICKY_COLORS[c]}
          className={`gr-dot sticky-${c}` + (value === c ? " on" : "")} onClick={() => onChange(c)} />
      ))}
    </span>
  );
}

/** Grows a textarea to fit what's in it. */
const fit = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };

function Sticky({ note, dash }: { note: Entry<"gratitude">; dash: Dashboard }) {
  const [text, setText] = useState(note.data.text);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setText(note.data.text), [note.data.text]);
  const save = () => {
    const t = text.trim();
    if (!t) return setText(note.data.text);
    if (t !== note.data.text) dash.patch(note, { text: t });
  };
  return (
    <li className={`gr-note sticky-${note.data.color}`} style={{ rotate: `${tilt(note.id)}deg` }} onMouseLeave={() => setConfirm(false)}>
      <textarea className="gr-text gr-scroll" value={text} aria-label="Grateful for" onChange={e => setText(e.target.value)} onBlur={save} />
      <div className="gr-foot">
        <time className="gr-time" dateTime={new Date(note.data.at).toISOString()}>{stamp(note.data.at)}</time>
        <span className="gr-tools">
          <Dots value={note.data.color} onChange={color => dash.patch(note, { color })} />
          <button className={"gr-del" + (confirm ? " sure" : "")} aria-label={confirm ? "Tap again to delete" : "Delete note"} title={confirm ? "Tap again to delete" : "Delete"}
            onClick={() => (confirm ? dash.remove(note) : setConfirm(true))}>{confirm ? "Delete?" : "×"}</button>
        </span>
      </div>
    </li>
  );
}

export function GratitudePage({ dash }: { dash: Dashboard }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLOR_IDS[0]);
  const area = useRef<HTMLTextAreaElement>(null);
  const notes = [...dash.entries.gratitude].sort((a, b) => b.data.at - a.data.at);
  useEffect(() => fit(area.current), [text]);

  const add = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await dash.add("gratitude", { text: t, color, at: Date.now() });
    // The next note gets the next color, so the board stays mixed.
    setColor(c => COLOR_IDS[(COLOR_IDS.indexOf(c) + 1) % COLOR_IDS.length]);
    area.current?.focus();
  };

  return (
    <PageShell path="/gratitude">
      <form className={`gr-new sticky-${color}`} onSubmit={add}>
        <textarea ref={area} className="gr-text" value={text} rows={2} placeholder="Today I'm grateful for…" aria-label="Today I'm grateful for"
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }} />
        <div className="gr-foot">
          <Dots value={color} onChange={setColor} />
          <button className="btn primary sm" disabled={!text.trim()}>Stick it</button>
        </div>
      </form>
      {notes.length > 0 && <p className="sub gr-count">{plural(notes.length, "thing")} to be grateful for</p>}
      {notes.length === 0 ? (
        <section className="glass page-empty">
          <img className="mascot lg" src="/mascot.svg" alt="" />
          <h2>Your board is empty</h2>
          <p className="sub">Write one small thing you're grateful for above. Each note keeps the date and time you stuck it up.</p>
        </section>
      ) : (
        <ul className="gr-board">{notes.map(n => <Sticky key={n.id} note={n} dash={dash} />)}</ul>
      )}
    </PageShell>
  );
}
