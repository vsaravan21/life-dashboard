import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Nav } from "./components/Nav";
import { money, plural } from "./components/ui";
import { daysBetween, dayOfYear, daysInYear, isoWeek, today } from "./lib/dates";
import { cloudStore, demoStore, supabase, type Store } from "./lib/store";
import { useDashboard, type Dashboard } from "./lib/useDashboard";
import { Calendar } from "./sections/Calendar";
import { Finance } from "./sections/Finance";
import { Goals } from "./sections/Goals";
import { Journal } from "./sections/Journal";
import { Reading } from "./sections/Reading";
import { Todos } from "./sections/Todos";
import { Travel } from "./sections/Travel";
import { Wins } from "./sections/Wins";

const NAME = "Varsha";

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const notify = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return { msg, notify };
}

function Greeting() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const h = now.getHours();
  return (
    <section className="glass greet-card">
      <div className="orb lg" />
      <h1>{h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"} <b>{NAME}</b>, here's your day.</h1>
      <div className="date">
        {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · Week {isoWeek(now)} · day {dayOfYear(now)} of {daysInYear(now.getFullYear())}
      </div>
    </section>
  );
}

function Summary({ dash }: { dash: Dashboard }) {
  const t = today(), y = t.slice(0, 4), e = dash.entries;
  const evToday = e.events.filter(x => x.data.date === t).length;
  const open = e.todos.filter(x => !x.data.done), late = open.filter(x => x.data.due && x.data.due < t).length;
  const spent = e.money.filter(x => x.data.kind === "expense" && x.data.date.startsWith(t.slice(0, 7))).reduce((s, x) => s + (+x.data.amount || 0), 0);
  const next = e.trips.filter(x => x.data.end >= t).sort((a, b) => a.data.start.localeCompare(b.data.start))[0];
  const books = e.books.filter(b => b.data.status === "done" && (b.data.finished || "").startsWith(y)).length;
  const wins = e.wins.filter(w => w.data.date.startsWith(y)).length;
  const d = next ? daysBetween(t, next.data.start) : 0;
  return (
    <section className="glass sum-card">
      <div className="label">At a glance</div>
      <div className="summary">
        <span className="chip accent"><b>{evToday}</b> {evToday === 1 ? "event" : "events"} today</span>
        <span className={"chip" + (late ? " warn" : "")}><b>{open.length}</b> open tasks{late ? ` · ${late} overdue` : ""}</span>
        <span className="chip"><b>{money(spent, dash.prefs.currency)}</b> spent this month</span>
        {next && <span className="chip">{d <= 0 ? <>In <b>{next.data.place}</b> now</> : <><b>{next.data.place}</b> in {plural(d, "day")}</>}</span>}
        <span className="chip"><b>{books}</b> {books === 1 ? "book" : "books"} in {y}</span>
        <span className="chip"><b>{wins}</b> {wins === 1 ? "win" : "wins"} in {y}</span>
      </div>
    </section>
  );
}

function ExamplesNotice({ dash }: { dash: Dashboard }) {
  const [armed, setArmed] = useState(false);
  if (!dash.exampleCount) return null;
  return (
    <div className="notice">
      <span>These are example entries so you can see how each section works. Add your own, then clear them.</span>
      <button className={"btn sm" + (armed ? " primary" : "")} onClick={() => (armed ? dash.clearExamples() : setArmed(true))}>
        {armed ? `Remove ${plural(dash.exampleCount, "example")}?` : "Clear examples"}
      </button>
    </div>
  );
}

function DashboardView({ store, onSignOut, seedKey }: { store: Store; onSignOut?: () => void; seedKey?: string }) {
  const { msg, notify } = useToast();
  const dash = useDashboard(store, notify, seedKey);
  return (
    <>
      <div className="glow" aria-hidden="true" />
      <div className="wrap">
        <Nav onSignOut={onSignOut} />
        <main id="top">
          <div className="hero"><Greeting /><Summary dash={dash} /></div>
          {store.mode === "demo" && (
            <div className="notice">Entries are saved in this browser only. Turn on sign-in to sync across devices (see README).</div>
          )}
          {dash.error && <div className="notice">Couldn't load your data: {dash.error}</div>}
          <ExamplesNotice dash={dash} />
          {dash.ready && (
            <div className="grid">
              <Calendar dash={dash} />
              <Todos dash={dash} />
              <Finance dash={dash} />
              <Goals dash={dash} />
              <Travel dash={dash} notify={notify} />
              <Reading dash={dash} />
              <Wins dash={dash} />
              <Journal dash={dash} notify={notify} />
            </div>
          )}
        </main>
      </div>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}

function SignIn() {
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const email = String(new FormData(ev.currentTarget).get("email") || "").trim();
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message);
    else { setErr(null); setSent(email); }
  };
  return (
    <>
      <div className="glow" aria-hidden="true" />
      <div className="signin-wrap">
        <form className="glass signin" onSubmit={submit}>
          <div className="orb lg" />
          <h1>Welcome back</h1>
          {sent ? <p className="sub">Check {sent} for a sign-in link.</p> : <>
            <p className="sub">Enter your email and we'll send you a sign-in link.</p>
            <input type="email" name="email" required placeholder="you@example.com" aria-label="Email" autoComplete="email" />
            <button className="btn primary">Send link</button>
          </>}
          {err && <p className="err">{err}</p>}
        </form>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  const store = useMemo(() => (supabase && userId ? cloudStore(supabase, userId) : supabase ? null : demoStore()), [userId]);

  if (!supabase) return <DashboardView store={store!} />;
  if (session === undefined) return <div className="glow" aria-hidden="true" />;
  if (!session || !store) return <SignIn />;
  return <DashboardView key={userId} store={store} seedKey={`life-dashboard:seeded:${userId}`} onSignOut={() => supabase!.auth.signOut()} />;
}
