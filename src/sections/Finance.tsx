import { AddForm, Bar, DateField, Empty, Panel, Remove, money } from "../components/ui";
import { fmt, parse, today } from "../lib/dates";
import type { Dashboard } from "../lib/useDashboard";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "JPY", "AED", "CHF"];
const CATEGORIES = ["Groceries", "Rent", "Eating out", "Transport", "Shopping", "Bills", "Travel", "Salary"];

export function Finance({ dash }: { dash: Dashboard }) {
  const t = today(), cur = dash.prefs.currency, fmtMoney = (n: number) => money(n, cur);
  const mo = dash.entries.money.filter(x => x.data.date.startsWith(t.slice(0, 7)));
  const sum = (kind: "income" | "expense") => mo.filter(x => x.data.kind === kind).reduce((s, x) => s + (+x.data.amount || 0), 0);
  const inc = sum("income"), out = sum("expense"), net = inc - out;
  const cats: Record<string, number> = {};
  for (const x of mo) if (x.data.kind === "expense") cats[x.data.category || "Other"] = (cats[x.data.category || "Other"] || 0) + (+x.data.amount || 0);
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5), max = top[0]?.[1] || 1;
  const recent = [...dash.entries.money].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <Panel id="p-money" title="Finance" cover="c-money" addLabel="Add transaction"
      label={parse(t).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      extra={
        <select className="btn sm" aria-label="Currency" value={cur} onChange={ev => dash.setCurrency(ev.target.value)}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      }
      form={close => (
        <AddForm onClose={close} onSave={v => dash.add("money", {
          label: v.label.trim(), amount: Math.abs(parseFloat(v.amount)) || 0,
          kind: v.kind === "income" ? "income" : "expense", category: v.category.trim(), date: v.date,
        })}>
          <input className="grow" name="label" placeholder="Description" required aria-label="Description" />
          <input type="number" name="amount" placeholder="Amount" min="0" step="0.01" required aria-label="Amount" />
          <select name="kind" aria-label="Type"><option value="expense">Spent</option><option value="income">Received</option></select>
          <input name="category" placeholder="Category" list="cats" aria-label="Category" />
          <datalist id="cats">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</datalist>
          <DateField name="date" label="Date" />
        </AddForm>
      )}>
      <div className="kpis">
        <div className="kpi"><div className="label">In</div><div className="v">{fmtMoney(inc)}</div></div>
        <div className="kpi"><div className="label">Out</div><div className="v">{fmtMoney(out)}</div></div>
        <div className="kpi"><div className="label">Net</div><div className={"v " + (net >= 0 ? "pos" : "neg")}>{(net > 0 ? "+" : "") + fmtMoney(net)}</div></div>
      </div>
      {top.length > 0 && (
        <div className="bars" aria-label="Spending by category this month">
          {top.map(([c, v]) => (
            <div className="bar" key={c}><span className="t">{c}</span><Bar pct={(v / max) * 100} /><span className="num">{fmtMoney(v)}</span></div>
          ))}
        </div>
      )}
      {recent.length ? (
        <ul className="list">
          {recent.map(x => (
            <li key={x.id}>
              <span className="grow1">
                <span className="t">{x.data.label}</span>
                <div className="sub">{[fmt(x.data.date, { month: "short", day: "numeric" }), x.data.category].filter(Boolean).join(" · ")}</div>
              </span>
              <span className={"num " + (x.data.kind === "income" ? "amt-in" : "amt-out")}>
                {(x.data.kind === "income" ? "+" : "−") + fmtMoney(+x.data.amount || 0)}
              </span>
              <Remove label={x.data.label} onClick={() => dash.remove(x)} />
            </li>
          ))}
        </ul>
      ) : <Empty>Log money in and out to see this month's picture.</Empty>}
    </Panel>
  );
}
