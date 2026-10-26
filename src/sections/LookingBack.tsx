import { newId, Outline } from "../components/Outline";
import { AddForm, Empty, Panel } from "../components/ui";
import type { LookbackData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { monthCover, monthName } from "../pages/LookingBackPage";

/** This month's Looking Back card: its highlights, editable in place. */
export function LookingBack({ dash }: { dash: Dashboard }) {
  const now = new Date(), year = now.getFullYear(), month = now.getMonth() + 1;
  const entry = dash.entries.lookback.find(m => m.data.year === year && m.data.month === month);
  const sections = entry?.data.sections ?? [];
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const update = (id: string, items: LookbackData["sections"][number]["items"]) =>
    entry && dash.patch(entry, { sections: sections.map(s => (s.id === id ? { ...s, items } : s)) });

  const add = (text: string) => {
    const item = { id: newId(), text };
    if (!entry) return dash.add("lookback", { year, month, sections: [{ id: newId(), title: "", items: [item] }] });
    if (!sections.length) return dash.patch(entry, { sections: [{ id: newId(), title: "", items: [item] }] });
    // New highlights go to the last section, where the month's latest things are.
    const last = sections[sections.length - 1];
    return dash.patch(entry, { sections: sections.map(s => (s.id === last.id ? { ...s, items: [...s.items, item] } : s)) });
  };

  return (
    <Panel id="p-lookback" title="Looking Back" cover={monthCover(month)} addLabel="Add a highlight"
      label={`${monthName(month)} ${year}${count ? ` · ${count} ${count === 1 ? "highlight" : "highlights"}` : ""}`}
      form={close => (
        <AddForm onClose={close} onSave={v => add(v.text.trim())}>
          <input className="grow" name="text" placeholder={`Something from ${monthName(month)}`} required aria-label="Highlight" />
        </AddForm>
      )}>
      {count === 0 ? <Empty>Nothing for {monthName(month)} yet. Add the fun things, people and wins as they happen.</Empty> : (
        <div className="card-scroll home-scroll">
          {sections.map(s => (
            <div className="lb-group" key={s.id}>
              {s.title && <div className="lb-group-head"><span className="lb-section label">{s.title}</span></div>}
              <Outline items={s.items} onChange={items => update(s.id, items)} placeholder="Add a highlight" label={`New highlight${s.title ? ` in ${s.title}` : ""}`} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
