import { useEffect, useMemo, useState } from "react";
import { plural } from "../components/ui";
import { signOutOfFinance } from "../lib/finance";
import { moveToCloud, type MoveResult } from "../lib/moveToCloud";
import { demoStore } from "../lib/store";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { Lock, PasswordForm, SignInCard } from "./FinancePage";
import { PageShell } from "./PageShell";

const movedKey = (userId: string) => `life-dashboard:moved:${userId}`;
const readFlag = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Save every entry as a JSON file. Photos stay where they are; the file keeps their references. */
function download(entries: Entry[], label: string) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), from: label, entries }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `my-life-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const all = (dash: Dashboard) => Object.values(dash.entries).flat() as Entry[];

/** What's saved only in this browser, and the button that moves it into your account. */
function MoveCard({ dash, userId }: { dash: Dashboard; userId: string }) {
  const local = useMemo(() => demoStore(), []);
  const [count, setCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<MoveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState(() => readFlag(movedKey(userId)));
  useEffect(() => { local.load().then(s => setCount(s.entries.length)); }, [local]);

  const move = async () => {
    setError(null);
    setResult(null);
    setProgress([0, count ?? 0]);
    try {
      const r = await moveToCloud(local, dash.store, all(dash), (d, t) => setProgress([d, t]));
      setResult(r);
      const when = new Date().toISOString();
      try { localStorage.setItem(movedKey(userId), when); } catch { /* fine */ }
      setMoved(when);
      await dash.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/entries_kind_check|check constraint/.test(msg)
        ? "Your database needs a one-time update before everything can move. Run the sync setup SQL in Supabase, then try again. Nothing was lost; anything already moved won't be copied twice."
        : `Couldn't finish moving: ${msg}. Nothing was lost, and trying again picks up where it stopped.`);
    } finally { setProgress(null); }
  };

  if (count === null || (count === 0 && !result)) return null;
  return (
    <section className="glass acct-card">
      <span className="label">This browser</span>
      {result ? (
        <p className="sub">Done. Moved {plural(result.moved, "thing")}{result.photos ? ` and ${plural(result.photos, "photo")}` : ""} into your account{result.skipped ? `; ${result.skipped} were already there` : ""}. The copy in this browser stays as a spare.</p>
      ) : moved ? (
        <p className="sub">You moved this browser's {plural(count, "thing")} into your account on {new Date(moved).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}. Moving again only adds what's new.</p>
      ) : (
        <p className="sub">{plural(count, "thing")} (goals, trips, books, photos and the rest) {count === 1 ? "is" : "are"} saved only in this browser. Move {count === 1 ? "it" : "them"} into your account to back {count === 1 ? "it" : "them"} up and see {count === 1 ? "it" : "them"} everywhere.</p>
      )}
      {progress && <div className="acct-prog"><div className="gl-bar"><span style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%` }} /></div><span className="sub">Moving {progress[0]} of {progress[1]}…</span></div>}
      {error && <p className="err" role="alert">{error}</p>}
      {!progress && !result && <div className="acct-acts"><button className={"btn" + (moved ? "" : " primary")} onClick={move}>{moved ? "Move again" : "Move them to my account"}</button></div>}
    </section>
  );
}

export function AccountPage({ dash, sync }: { dash: Dashboard; sync: { email: string; userId: string } | null }) {
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNote, setPwNote] = useState("");
  const n = all(dash).length;

  if (!sync) return (
    <PageShell path="/account">
      <SignInCard title="Back up and sync" sub="" />
      <section className="glass acct-card">
        <span className="label">Right now</span>
        <p className="sub">Your {plural(n, "thing")} {n === 1 ? "is" : "are"} saved only in this browser. Clearing your browsing data or switching devices would lose {n === 1 ? "it" : "them"}.</p>
        {n > 0 && <div className="acct-acts"><button className="btn" onClick={() => download(all(dash), "this browser")}>Download a backup file</button></div>}
      </section>
    </PageShell>
  );

  return (
    <PageShell path="/account">
      <section className="glass acct-card">
        <div className="acct-head">
          <span className="acct-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6a4.5 4.5 0 0 0 0 8.9Z" /><path d="m9.5 14 1.8 1.8 3.4-3.6" /></svg></span>
          <div>
            <h2>Synced</h2>
            <p className="sub"><Lock /> {sync.email}</p>
          </div>
        </div>
        <p className="sub">Everything you add is saved to your account and shows up on any device where you sign in. Your account holds {plural(n, "thing")}.</p>
        <div className="acct-acts">
          <button className="btn" onClick={() => download(all(dash), sync.email)} disabled={!n}>Download a backup file</button>
          <button className="btn" onClick={() => { setPwOpen(o => !o); setPwNote(""); }}>Change password</button>
          <button className="btn" onClick={() => signOutOfFinance()}>Sign out</button>
        </div>
      </section>
      {pwOpen && <PasswordForm onDone={msg => { setPwOpen(false); setPwNote(msg); }} />}
      {pwNote && <div className="notice"><span>{pwNote}</span></div>}
      <MoveCard dash={dash} userId={sync.userId} />
    </PageShell>
  );
}
