import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { OutlineItem } from "../lib/types";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

const MAX_DEPTH = 2;

/** Grow a one-line textarea to fit its text, for browsers without `field-sizing: content`. */
function useAutoHeight(ref: React.RefObject<HTMLTextAreaElement>, text: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    const fit = () => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [ref, text]);
}

export const Check = ({ done }: { done: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill={done ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
    {done && <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);

interface RowProps {
  item: OutlineItem;
  checks: boolean;
  focus: boolean;
  onFocused: () => void;
  onCommit: (text: string) => void;
  onEnter: (text: string) => void;
  onIndent: (text: string, delta: 1 | -1) => boolean;
  onBackspaceEmpty: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function Row({ item, checks, focus, onFocused, onCommit, onEnter, onIndent, onBackspaceEmpty, onToggle, onRemove }: RowProps) {
  const [text, setText] = useState(item.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setText(item.text), [item.text]);
  useAutoHeight(ref, text);
  useEffect(() => { if (focus) { ref.current?.focus(); onFocused(); } }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") { e.preventDefault(); onEnter(text.trim()); }
    else if (e.key === "Tab") { if (onIndent(text.trim(), e.shiftKey ? -1 : 1)) e.preventDefault(); }
    else if (e.key === "Backspace" && text === "") { e.preventDefault(); onBackspaceEmpty(); }
    else if (e.key === "Escape") { setText(item.text); e.currentTarget.blur(); }
  };
  const done = !!item.done;
  return (
    <li className={"tl-task ol-row" + (done ? " done" : "")} data-depth={item.depth || 0}>
      {checks
        ? <button className="tl-check" aria-pressed={done} aria-label={`${done ? "Not done" : "Done"}: ${item.text}`} onClick={onToggle}><Check done={done} /></button>
        : <span className="ol-dot" aria-hidden="true" />}
      <textarea ref={ref} rows={1} className="tl-text ol-text" value={text} aria-label={checks ? "Goal" : "Item"}
        onChange={e => setText(e.target.value.replace(/\n/g, " "))} onBlur={() => onCommit(text.trim())} onKeyDown={key} />
      <button className="tl-x" aria-label={`Remove ${item.text}`} title="Remove" onClick={onRemove}>×</button>
    </li>
  );
}

/**
 * An editable outline: Enter adds a line below, Tab and Shift+Tab nest a line
 * under the one above, and an emptied line goes away. With `checks`, each line
 * can be ticked off.
 */
export function Outline({ items, onChange, checks = false, placeholder, label, autoFocus = false }: {
  items: OutlineItem[]; onChange: (items: OutlineItem[]) => void; checks?: boolean; placeholder: string; label: string; autoFocus?: boolean;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const newRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) newRef.current?.focus(); }, [autoFocus]);

  const at = (id: string) => items.findIndex(i => i.id === id);
  const withText = (id: string, text: string) => items.map(i => (i.id === id ? { ...i, text } : i));

  const commit = (id: string, text: string) => {
    const item = items[at(id)];
    if (!item) return;
    if (!text) onChange(items.filter(i => i.id !== id));
    else if (text !== item.text) onChange(withText(id, text));
  };
  const enter = (id: string, text: string) => {
    const i = at(id);
    if (!text) return newRef.current?.focus();
    const next = { id: newId(), text: "", depth: items[i].depth || 0, ...(checks ? { done: false } : {}) };
    const list = withText(id, text);
    list.splice(i + 1, 0, next);
    onChange(list);
    setFocusId(next.id);
  };
  const indent = (id: string, text: string, delta: 1 | -1) => {
    const i = at(id), depth = items[i].depth || 0;
    const max = i === 0 ? 0 : Math.min(MAX_DEPTH, (items[i - 1].depth || 0) + 1);
    const to = Math.max(0, Math.min(max, depth + delta));
    if (to === depth) return false;
    onChange(items.map(x => (x.id === id ? { ...x, text: text || x.text, depth: to } : x)));
    return true;
  };
  const backspace = (id: string) => {
    const i = at(id);
    onChange(items.filter(x => x.id !== id));
    if (i > 0) setFocusId(items[i - 1].id);
  };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text, depth: 0, ...(checks ? { done: false } : {}) }]);
    setDraft("");
  };

  return (
    <ul className="tl-tasks ol">
      {items.map(item => (
        <Row key={item.id} item={item} checks={checks} focus={focusId === item.id} onFocused={() => setFocusId(null)}
          onCommit={t => commit(item.id, t)} onEnter={t => enter(item.id, t)} onIndent={(t, d) => indent(item.id, t, d)}
          onBackspaceEmpty={() => backspace(item.id)} onToggle={() => onChange(items.map(x => (x.id === item.id ? { ...x, done: !x.done } : x)))}
          onRemove={() => onChange(items.filter(x => x.id !== item.id))} />
      ))}
      <li className="tl-task tl-new">
        {checks ? <span className="tl-check" aria-hidden="true"><Check done={false} /></span> : <span className="ol-dot" aria-hidden="true" />}
        <input ref={newRef} className="tl-text" value={draft} placeholder={placeholder} aria-label={label}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} onBlur={add} />
      </li>
    </ul>
  );
}

/** Done and total for an outline's checkable lines. */
export const tally = (items: OutlineItem[]) => ({ done: items.filter(i => i.done).length, total: items.length });
