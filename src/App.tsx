import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Nav } from "./components/Nav";
import { Sprout } from "./components/Sprout";
import { plural } from "./components/ui";
import { daysBetween, dayOfYear, daysInYear, isoWeek, today } from "./lib/dates";
import { cloudStore, demoStore, supabase, type Store } from "./lib/store";
import { PAGES, useRoute } from "./lib/router";
import { useDashboard, type Dashboard } from "./lib/useDashboard";
import { CalendarPage } from "./pages/CalendarPage";
import { NotesPage } from "./pages/NotesPage";
import { GratitudePage } from "./pages/GratitudePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { JournalPage } from "./pages/JournalPage";
import { TodoPage } from "./pages/TodoPage";
import { FinancePage } from "./pages/FinancePage";
import { GoalsPage } from "./pages/GoalsPage";
import { LookingBackPage } from "./pages/LookingBackPage";
import { TravelPage } from "./pages/TravelPage";
import { ReadingPage } from "./pages/ReadingPage";
import { AccountPage } from "./pages/AccountPage";
import { financeAuth, useFinanceSession } from "./lib/finance";
import { EmptyPage } from "./pages/PageShell";
import { Calendar } from "./sections/Calendar";
import { Journal } from "./sections/Journal";
import { LookingBack } from "./sections/LookingBack";
import { Notes } from "./sections/Notes";
import { Reading } from "./sections/Reading";
import { Todos } from "./sections/Todos";
import { UpNext } from "./sections/UpNext";
import { Travel } from "./sections/Travel";

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
      <Sprout />
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
  const next = e.trips.filter(x => x.data.end >= t).sort((a, b) => a.data.start.localeCompare(b.data.start))[0];
  const books = e.books.filter(b => b.data.status === "done" && (b.data.finished || "").startsWith(y)).length;
  const d = next ? daysBetween(t, next.data.start) : 0;
  return (
    <section className="glass sum-card">
      <div className="label">At a glance</div>
      <div className="summary">
        <span className="chip accent"><b>{evToday}</b> {evToday === 1 ? "event" : "events"} today</span>
        <span className={"chip" + (late ? " warn" : "")}><b>{open.length}</b> open tasks{late ? ` · ${late} overdue` : ""}</span>
        {next && <span className="chip">{d <= 0 ? <>In <b>{next.data.place}</b> now</> : <><b>{next.data.place}</b> in {plural(d, "day")}</>}</span>}
        <span className="chip"><b>{books}</b> {books === 1 ? "book" : "books"} in {y}</span>
      </div>
    </section>
  );
}

type Sync = { email: string; userId: string } | null;

function DashboardView({ store, onSignOut, sync }: { store: Store; onSignOut?: () => void; sync?: Sync }) {
  const { msg, notify } = useToast();
  const dash = useDashboard(store, notify);
  const route = useRoute();
  useEffect(() => {
    const page = PAGES.find(p => p.path === route);
    document.title = page ? `${page.label} · My Life` : "My Life";
  }, [route]);

  const home = (
    <>
      <div className="hero"><Greeting /><Summary dash={dash} /></div>
      <div className="grid">
        <UpNext dash={dash} notify={notify} />
        <Calendar dash={dash} />
        <Todos dash={dash} />
        <LookingBack dash={dash} />
        <Travel dash={dash} notify={notify} />
        <Reading dash={dash} />
        <Journal dash={dash} notify={notify} />
        <Notes dash={dash} />
      </div>
    </>
  );

  return (
    <>
      <div className="glow" aria-hidden="true" />
      <div className="wrap">
        <Nav route={route} onSignOut={onSignOut} sync={sync === undefined ? undefined : sync && { email: sync.email }} />
        <main id="top">
          {dash.error && <div className="notice">Couldn't load your data: {dash.error}</div>}
          {dash.ready && (
            route === "/" ? home
              : route === "/calendar" ? <CalendarPage dash={dash} />
              : route === "/notes" ? <NotesPage dash={dash} />
              : route === "/todo" ? <TodoPage dash={dash} />
              : route === "/finance" ? <FinancePage />
              : route === "/goals" ? <GoalsPage dash={dash} notify={notify} />
              : route === "/account" ? <AccountPage dash={dash} sync={sync ?? null} />
              : route === "/reading" ? <ReadingPage dash={dash} notify={notify} />
              : route === "/journal" ? <JournalPage dash={dash} notify={notify} />
              : route === "/projects" ? <ProjectsPage dash={dash} notify={notify} />
              : route === "/gratitude" ? <GratitudePage dash={dash} />
              : route === "/travel" ? <TravelPage dash={dash} notify={notify} />
              : route === "/looking-back" ? <LookingBackPage dash={dash} notify={notify} />
              : <EmptyPage path={route} />
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
          <img className="mascot lg" src="/mascot.svg" alt="" />
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

/**
 * The open site: anyone can use it, saving to their browser. Signing in (the
 * same account as Finance) switches to saving in that account, synced everywhere.
 */
function OpenApp() {
  const session = useFinanceSession();
  const userId = session?.user.id;
  const store = useMemo(() => (financeAuth && userId ? cloudStore(financeAuth, userId) : demoStore()), [userId]);
  if (session === undefined) return <div className="glow" aria-hidden="true" />;
  const sync = financeAuth ? (session ? { email: session.user.email ?? "", userId: session.user.id } : null) : undefined;
  return <DashboardView key={userId ?? "browser"} store={store} sync={sync} />;
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

  if (!supabase) return <OpenApp />;
  if (session === undefined) return <div className="glow" aria-hidden="true" />;
  if (!session || !store) return <SignIn />;
  return <DashboardView key={userId} store={store} onSignOut={() => supabase!.auth.signOut()} />;
}
