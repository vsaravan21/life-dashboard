import { useRef, useState } from "react";
import { planImport } from "../lib/importFile";
import type { Dashboard } from "../lib/useDashboard";

/** Reads a goals file (see lib/importFile) and adds whatever isn't already here. */
export function ImportButton({ dash, onDone }: { dash: Dashboard; onDone?: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const plan = planImport(dash.entries, JSON.parse(await file.text()));
      for (const y of plan.years) await dash.add("goalyears", y);
      for (const c of plan.cats) await dash.add("goalcats", c);
      for (const m of plan.months) await dash.add("lookback", m);
      for (const f of plan.flights) await dash.add("flights", f);
      for (const b of plan.books) await dash.add("books", b);
      const added = [
        plan.years.length && `${plan.years.length} ${plan.years.length === 1 ? "year" : "years"}`,
        plan.cats.length && `${plan.cats.length} ${plan.cats.length === 1 ? "category" : "categories"}`,
        plan.months.length && `${plan.months.length} ${plan.months.length === 1 ? "month" : "months"}`,
        plan.flights.length && `${plan.flights.length} ${plan.flights.length === 1 ? "flight" : "flights"}`,
        plan.books.length && `${plan.books.length} ${plan.books.length === 1 ? "book" : "books"}`,
      ].filter(Boolean).join(", ");
      onDone?.(added ? `Imported ${added}.` : "Everything in that file is already here.");
    } catch (e) {
      onDone?.(e instanceof SyntaxError ? "That file isn't valid JSON." : e instanceof Error ? e.message : "Couldn't import that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Importing…" : "Import"}</button>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Import a file" onChange={e => pick(e.target.files?.[0])} />
    </>
  );
}
