import { useCallback, useEffect, useState, type FormEvent } from "react";
import { money } from "../components/ui";
import { fmt } from "../lib/dates";
import {
  FinanceError, financeApi, financeAuth, isDebt, netWorth, openPlaid, sendSignInLink, setFinancePassword, signInWithPassword,
  signOutOfFinance, useFinanceSession,
  type Bank, type Transaction,
} from "../lib/finance";
import { PageShell } from "./PageShell";

/** Money with cents, for balances and transactions. */
const cents = (n: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n); }
  catch { return n.toFixed(2); }
};

export const Lock = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);

/** Email and password (or emailed link) sign-in for your account. */
export function SignInCard({ title = "Finance is private", sub = "Sign in to see your accounts. The rest of the dashboard stays open as it is." }: { title?: string; sub?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      if (mode === "password") { await signInWithPassword(email.trim(), password); setState("idle"); }
      else { await sendSignInLink(email.trim()); setState("sent"); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setState("idle");
    }
  };
  const swap = () => { setMode(m => (m === "password" ? "link" : "password")); setError(null); setState("idle"); };
  return (
    <section className="glass fin-lock">
      <span className="fin-lock-icon"><Lock /></span>
      <h2>{title}</h2>
      {state === "sent" ? (
        <p className="sub">Check <b>{email}</b> for a sign-in link. Open it on this device and you'll land back here.</p>
      ) : (
        <>
          {sub && <p className="sub">{sub}</p>}
          <form className="fin-signin" onSubmit={submit}>
            <input type="email" required autoComplete="email" placeholder="Your email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} />
            {mode === "password" && (
              <input type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} />
            )}
            <button className="btn primary" disabled={state === "busy"}>
              {state === "busy" ? (mode === "password" ? "Signing in…" : "Sending…") : mode === "password" ? "Sign in" : "Email me a link"}
            </button>
          </form>
        </>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      <button type="button" className="linkish fin-swap" onClick={swap}>
        {mode === "password" ? "No password yet? Email me a sign-in link" : "Sign in with a password instead"}
      </button>
    </section>
  );
}

/** Set or change the Finance password while signed in. */
export function PasswordForm({ onDone }: { onDone: (msg: string) => void }) {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setError("Use at least 10 characters.");
    if (pw !== again) return setError("The two passwords don't match.");
    setBusy(true);
    try { await setFinancePassword(pw); onDone("Password saved. Next time, sign in with your email and this password."); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the password."); }
    finally { setBusy(false); }
  };
  return (
    <form className="glass fin-pw" onSubmit={submit}>
      <span className="label">Password</span>
      <div className="fin-signin">
        <input type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={pw} onChange={e => setPw(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder="Type it again" aria-label="Repeat new password" value={again} onChange={e => setAgain(e.target.value)} />
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        <button type="button" className="btn" onClick={() => onDone("")}>Cancel</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </form>
  );
}

const kindLabel = (type: string, subtype: string | null) =>
  ({ depository: "Cash", credit: "Credit card", loan: "Loan", investment: "Investment", brokerage: "Investment" } as Record<string, string>)[type]
  ?? (subtype || type);

function Accounts({ banks, onChange }: { banks: Bank[]; onChange: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (b: Bank) => {
    if (confirm !== b.id) return setConfirm(b.id);
    setBusy(b.id);
    try { await financeApi("remove", { id: b.id }); onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't disconnect."); }
    finally { setBusy(null); setConfirm(null); }
  };
  const reconnect = async (b: Bank) => {
    setError(null);
    try { if (await openPlaid(b.id)) onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reconnect."); }
  };

  return (
    <div className="fin-banks">
      {error && <p className="err" role="alert">{error}</p>}
      {banks.map(b => (
        <section key={b.id} className="glass fin-bank">
          <header className="fin-bank-head">
            <div>
              <h3>{b.institution}</h3>
              <span className="meta">Connected {fmt(b.connectedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <button className={"btn sm" + (confirm === b.id ? " danger" : "")} disabled={busy === b.id} onClick={() => remove(b)}
              onBlur={() => setConfirm(c => (c === b.id ? null : c))}>
              {busy === b.id ? "Disconnecting…" : confirm === b.id ? "Disconnect for good?" : "Disconnect"}
            </button>
          </header>
          {b.problem && (
            <div className="notice fin-problem">
              <span>{b.problem.message}</span>
              {b.problem.reconnect && <button className="btn sm primary" onClick={() => reconnect(b)}>Sign in to {b.institution} again</button>}
            </div>
          )}
          <ul className="list">
            {b.accounts.map(a => (
              <li key={a.id}>
                <span className="grow1">
                  <span className="t">{a.name}{a.mask && <span className="meta"> ••{a.mask}</span>}</span>
                  <span className="sub">{kindLabel(a.type, a.subtype)}{a.available != null && a.type === "depository" && a.available !== a.current ? ` · ${cents(a.available, a.currency)} available` : ""}</span>
                </span>
                <span className={"fin-amt" + (isDebt(a) ? " debt" : "")}>{a.current == null ? "—" : cents(isDebt(a) ? -Math.abs(a.current) : a.current, a.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Transactions({ list, notReady }: { list: Transaction[] | null; notReady: string[] }) {
  const [q, setQ] = useState("");
  if (!list) return <p className="sub">Loading transactions…</p>;
  const needle = q.trim().toLowerCase();
  const shown = list.filter(t => !needle || `${t.name} ${t.category ?? ""} ${t.account}`.toLowerCase().includes(needle));
  const days = [...new Set(shown.map(t => t.date))];
  return (
    <section className="glass fin-tx">
      <div className="fin-tx-head">
        <h2>Last 30 days</h2>
        {list.length > 5 && <input type="search" className="note-search" placeholder="Search" aria-label="Search transactions" value={q} onChange={e => setQ(e.target.value)} />}
      </div>
      {notReady.length > 0 && <p className="sub">{notReady.join(", ")} {notReady.length === 1 ? "is" : "are"} still sending transactions. That can take a few minutes after connecting.</p>}
      {shown.length === 0 ? <p className="empty">{list.length ? "Nothing matches." : "No transactions yet."}</p> : days.map(d => (
        <div key={d}>
          <div className="agenda-day">{fmt(d, { weekday: "short", month: "short", day: "numeric" })}</div>
          <ul className="list">
            {shown.filter(t => t.date === d).map(t => (
              <li key={t.id}>
                <span className="grow1">
                  <span className="t">{t.name}{t.pending && <span className="pill">pending</span>}</span>
                  <span className="sub">{[t.category, `${t.institution} ${t.account}`.trim()].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={"fin-amt" + (t.amount > 0 ? " in" : "")}>{t.amount > 0 ? "+" : ""}{cents(t.amount, t.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Signedin({ email }: { email: string }) {
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [notReady, setNotReady] = useState<string[]>([]);
  const [error, setError] = useState<FinanceError | Error | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNote, setPwNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await financeApi<{ banks: Bank[] }>("summary");
      setBanks(s.banks);
      if (s.banks.length) {
        const t = await financeApi<{ transactions: Transaction[]; notReady: string[] }>("transactions", { days: 30 });
        setTx(t.transactions);
        setNotReady(t.notReady);
      } else { setTx([]); setNotReady([]); }
    } catch (e) { setError(e instanceof Error ? e : new Error("Couldn't load Finance.")); setBanks(b => b ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try { if (await openPlaid()) await load(); }
    catch (e) { setError(e instanceof Error ? e : new Error("Couldn't connect.")); }
    finally { setConnecting(false); }
  };

  const notAllowed = error instanceof FinanceError && error.code === "not_allowed";
  const totals = banks ? netWorth(banks) : null;
  const cur = banks?.[0]?.accounts[0]?.currency ?? "USD";

  return (
    <>
      <div className="fin-bar">
        <span className="meta"><Lock /> Signed in as {email}</span>
        <span className="grow1" />
        <button className="btn sm" onClick={load}>Refresh</button>
        <button className="btn sm" onClick={() => { setPwOpen(o => !o); setPwNote(""); }}>Set password</button>
        <button className="btn sm" onClick={() => signOutOfFinance()}>Sign out</button>
      </div>
      {pwOpen && <PasswordForm onDone={msg => { setPwOpen(false); setPwNote(msg); }} />}
      {pwNote && <div className="notice"><span>{pwNote}</span></div>}
      {error && (
        <div className="notice"><span className="err">{error.message}</span>
          {notAllowed && <button className="btn sm" onClick={() => signOutOfFinance()}>Use another email</button>}
        </div>
      )}
      {!notAllowed && banks && totals && (
        <>
          <section className="glass fin-hero">
            <div>
              <div className="label">Net worth</div>
              <div className="fin-net">{money(totals.net, cur)}</div>
            </div>
            <div className="kpis">
              <div className="kpi"><div className="label">Assets</div><div className="v">{money(totals.assets, cur)}</div></div>
              <div className="kpi"><div className="label">Debts</div><div className="v">{money(totals.debts, cur)}</div></div>
            </div>
            <button className="btn primary" onClick={connect} disabled={connecting}>{connecting ? "Opening Plaid…" : "+ Connect a bank"}</button>
          </section>
          {banks.length === 0 ? (
            <section className="glass page-empty">
              <h2>No banks connected yet</h2>
              <p className="sub">Connect your bank, cards, and investments like Betterment through Plaid. You sign in on Plaid's screen, and this site only gets read-only access. It can never move money.</p>
            </section>
          ) : (
            <div className="fin-layout">
              <Accounts banks={banks} onChange={load} />
              <Transactions list={tx} notReady={notReady} />
            </div>
          )}
        </>
      )}
      {!banks && !error && <p className="sub">Loading your accounts…</p>}
    </>
  );
}

export function FinancePage() {
  const session = useFinanceSession();
  return (
    <PageShell path="/finance">
      {!financeAuth ? <section className="glass page-empty"><h2>Finance isn't set up</h2><p className="sub">Add the Supabase settings to turn on the Finance sign-in (see README).</p></section>
        : session === undefined ? <p className="sub">Checking sign-in…</p>
          : session ? <Signedin email={session.user.email ?? ""} />
            : <SignInCard />}
    </PageShell>
  );
}
