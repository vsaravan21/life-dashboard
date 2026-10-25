import { useState, type FormEvent, type ReactNode } from "react";
import { today } from "../lib/dates";

export const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const Bar = ({ pct }: { pct: number }) => (
  <div className="track">
    <div className="fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);

export const Remove = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button className="x" aria-label={`Remove ${label}`} title="Remove" onClick={onClick}>×</button>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(0, Math.min(100, v)));
  return (
    <div className="stepper">
      <button className="btn sm" aria-label="Less progress" onClick={() => set(value - 10)}>−</button>
      <button className="btn sm" aria-label="More progress" onClick={() => set(value + 10)}>+</button>
    </div>
  );
}

type Values = Record<string, string>;

/**
 * A section's add form. `onSave` gets the text fields; return false to keep
 * the form open (for example after a validation message).
 */
export function AddForm({ children, onSave, onClose }: {
  children: ReactNode;
  onSave: (values: Values, form: HTMLFormElement) => Promise<boolean | void> | boolean | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const values = Object.fromEntries([...new FormData(form).entries()].filter(([, v]) => typeof v === "string")) as Values;
    setBusy(true);
    try {
      if ((await onSave(values, form)) !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="add" onSubmit={submit}>
      {children}
      <div className="acts">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

/** A required date input that starts on today. */
export const DateField = ({ name, label, required = true }: { name: string; label: string; required?: boolean }) => (
  <input type="date" name={name} aria-label={label} required={required} defaultValue={required ? today() : undefined} />
);

export function Panel({ id, title, cover, label, extra, addLabel, form, children }: {
  id: string;
  title: string;
  cover: string;
  label: ReactNode;
  extra?: ReactNode;
  addLabel: string;
  form: (close: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel glass" id={id}>
      <div className={`cover ${cover}`}>
        <h2>{title}</h2>
        <button className="add-btn" aria-label={addLabel} aria-expanded={open} onClick={() => setOpen(o => !o)}>+</button>
      </div>
      <div className="sec-meta"><span className="label">{label}</span>{extra}</div>
      {open && form(() => setOpen(false))}
      {children}
    </section>
  );
}
