import { useEffect, useRef, useState, type FormEvent } from "react";
import { plural } from "../components/ui";
import { daysBetween, fmt, today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { Entry, TripData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { colorOf, Swatches } from "./TodoPage";
import { PageShell } from "./PageShell";

const TRIP_COLORS = ["sunset", "mint", "periwinkle", "blush", "honey", "orchid", "peach", "prism", "petal"];
const long = (s: string) => fmt(s, { month: "short", day: "numeric", year: "numeric" });

function span(t: TripData) {
  const sameYear = t.start.slice(0, 4) === t.end.slice(0, 4);
  const start = fmt(t.start, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  const nights = Math.max(0, daysBetween(t.start, t.end));
  return `${t.start === t.end ? long(t.start) : `${start} – ${long(t.end)}`}${nights ? ` · ${plural(nights, "night")}` : ""}`;
}

function when(t: TripData, now: string) {
  if (t.end < now) return null;
  const d = daysBetween(now, t.start);
  return d <= 0 ? { text: "now", cls: " good" } : { text: d === 1 ? "tomorrow" : `in ${d} days`, cls: "" };
}

function Slide({ dash, photo, alt }: { dash: Dashboard; photo: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    dash.store.photoUrl(photo).then(u => live && setSrc(u));
    return () => { live = false; };
  }, [dash.store, photo]);
  return <div className="tr-slide">{src ? <img src={src} alt={alt} loading="lazy" draggable={false} /> : <span className="sub">Loading…</span>}</div>;
}

/** A trip's photos as swipeable slides, with arrows, dots and a way to add more. */
function Slides({ trip, dash, notify }: { trip: Entry<"trips">; dash: Dashboard; notify: (m: string) => void }) {
  const photos = trip.data.photos ?? [];
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(0);
  const i = Math.min(at, Math.max(0, photos.length - 1));

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const to = (n + photos.length) % photos.length;
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
  };
  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter(f => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    const refs: string[] = [];
    try {
      for (const f of list) { refs.push(await dash.store.uploadPhoto(await shrinkPhoto(f))); setBusy(b => b - 1); }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't add that photo.");
    } finally {
      setBusy(0);
      if (input.current) input.current.value = "";
    }
    if (refs.length) {
      const start = photos.length;
      await dash.patch(trip, { photos: [...photos, ...refs] });
      requestAnimationFrame(() => go(start));
    }
  };
  const removeCurrent = async () => {
    const ref = photos[i];
    if (!ref) return;
    await dash.patch(trip, { photos: photos.filter((_, n) => n !== i) });
    dash.store.removePhoto(ref).catch(() => undefined);
    // The next photo slides into this spot; at the end, the browser pulls back to the new last one.
    setAt(Math.max(0, Math.min(i, photos.length - 2)));
  };

  const picker = <input ref={input} type="file" accept="image/*" multiple hidden aria-label={`Add photos to ${trip.data.place}`} onChange={e => add(e.target.files)} />;
  if (!photos.length) return (
    <button className="tr-empty" onClick={() => input.current?.click()} disabled={busy > 0}>
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></svg>
      <span>{busy ? `Adding ${busy} photo${busy === 1 ? "" : "s"}…` : "Add photos"}</span>
      {picker}
    </button>
  );
  return (
    <div className="tr-slides" aria-roledescription="carousel" aria-label={`${trip.data.place} photos`}>
      <div className="tr-track" ref={track} onScroll={onScroll}>
        {photos.map((p, n) => <Slide key={p} dash={dash} photo={p} alt={`${trip.data.place}, photo ${n + 1} of ${photos.length}`} />)}
      </div>
      {photos.length > 1 && <>
        <button className="tr-nav prev" aria-label="Previous photo" onClick={() => go(i - 1)}>‹</button>
        <button className="tr-nav next" aria-label="Next photo" onClick={() => go(i + 1)}>›</button>
      </>}
      <div className="tr-bar">
        <span className="tr-count">{i + 1} / {photos.length}</span>
        {photos.length > 1 && photos.length <= 12 && (
          <span className="tr-dots">{photos.map((p, n) => <button key={p} className={n === i ? "on" : ""} aria-label={`Photo ${n + 1}`} onClick={() => go(n)} />)}</span>
        )}
        <span className="tr-acts">
          <button className="tr-act" onClick={() => input.current?.click()} disabled={busy > 0} aria-label="Add photos" title="Add photos">{busy ? "…" : "+"}</button>
          <button className="tr-act" onClick={removeCurrent} aria-label="Remove this photo" title="Remove this photo">×</button>
        </span>
      </div>
      {picker}
    </div>
  );
}

/** One trip: its place and dates on a colored cover, then its photo slides. */
function TripCard({ trip, dash, notify }: { trip: Entry<"trips">; dash: Dashboard; notify: (m: string) => void }) {
  const [place, setPlace] = useState(trip.data.place);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setPlace(trip.data.place), [trip.data.place]);
  const color = trip.data.color || TRIP_COLORS[0];
  const badge = when(trip.data, today());

  const savePlace = () => {
    const p = place.trim() || "Untitled trip";
    setPlace(p);
    if (p !== trip.data.place) dash.patch(trip, { place: p });
  };
  const setDate = (key: "start" | "end", v: string) => {
    if (!v) return;
    const next = { ...trip.data, [key]: v };
    if (next.end < next.start) return notify("The return date is before the start date.");
    dash.patch(trip, { [key]: v });
  };

  return (
    <section className="glass tl-card" aria-label={trip.data.place}>
      <header className={`cover tl-head ${colorOf(color).cover}`}>
        <div className="tl-heading">
          <input className="tl-title" value={place} aria-label="Trip name" onChange={e => setPlace(e.target.value)} onBlur={savePlace}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} />
          <span className="tl-date">{span(trip.data)}</span>
        </div>
        {badge && <span className={"pill" + badge.cls}>{badge.text}</span>}
        <button className="tl-menu-btn" aria-label="Trip options" aria-expanded={menu} onClick={() => { setMenu(m => !m); setConfirm(false); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </button>
      </header>
      {menu && (
        <div className="tl-menu">
          <span className="label">Dates</span>
          <div className="tr-dates">
            <input className="btn" type="date" value={trip.data.start} aria-label="Leaving" onChange={e => setDate("start", e.target.value)} />
            <span className="sub">to</span>
            <input className="btn" type="date" value={trip.data.end} aria-label="Back" onChange={e => setDate("end", e.target.value)} />
          </div>
          <span className="label">Color</span>
          <Swatches value={color} onChange={c => dash.patch(trip, { color: c })} />
          <button className={"btn sm" + (confirm ? " danger" : "")} onClick={() => (confirm ? dash.remove(trip) : setConfirm(true))}>
            {confirm ? `Delete ${trip.data.place}?` : "Delete trip"}
          </button>
        </div>
      )}
      {trip.data.note && <p className="sub tr-note">{trip.data.note}</p>}
      <Slides trip={trip} dash={dash} notify={notify} />
    </section>
  );
}

function TripJournal({ dash, notify, composing, setComposing }: { dash: Dashboard; notify: (m: string) => void; composing: boolean; setComposing: (v: boolean) => void }) {
  const t = today();
  const [color, setColor] = useState(TRIP_COLORS[0]);
  const trips = [...dash.entries.trips].sort((a, b) => b.data.start.localeCompare(a.data.start));
  const years = [...new Set(trips.map(x => x.data.start.slice(0, 4)))];

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (v.end < v.start) return notify("The return date is before the start date.");
    await dash.add("trips", { place: v.place.trim() || "Untitled trip", start: v.start, end: v.end, color, photos: [] });
    setComposing(false);
    setColor(TRIP_COLORS[(trips.length + 1) % TRIP_COLORS.length]);
  };

  const compose = composing && (
    <form className="glass tl-card tl-compose" onSubmit={create}>
      <div className={`cover tl-head ${colorOf(color).cover}`}>
        <div className="tl-heading">
          <input className="tl-title" name="place" autoFocus placeholder="Where did you go?" aria-label="Trip name" required />
        </div>
      </div>
      <span className="label">Dates</span>
      <div className="tr-dates">
        <input className="btn" type="date" name="start" defaultValue={t} required aria-label="Leaving" />
        <span className="sub">to</span>
        <input className="btn" type="date" name="end" defaultValue={t} required aria-label="Back" />
      </div>
      <span className="label">Color</span>
      <Swatches value={color} onChange={setColor} />
      <div className="tl-compose-acts">
        <button type="button" className="btn" onClick={() => setComposing(false)}>Cancel</button>
        <button className="btn primary">Add trip</button>
      </div>
    </form>
  );

  if (!trips.length) return (
    <div className="tl-grid">
      {compose || (
        <section className="glass page-empty tl-empty">
          <img className="mascot lg" src="/mascot.svg" alt="" />
          <h2>No trips yet</h2>
          <p className="sub">Add a trip to give it a card, then fill it with photos you can swipe through.</p>
          <button className="btn primary" onClick={() => setComposing(true)}>+ New trip</button>
        </section>
      )}
    </div>
  );
  return (<>
    {compose && <div className="tl-grid">{compose}</div>}
    {years.map(y => {
      const list = trips.filter(x => x.data.start.startsWith(y));
      return (
        <section key={y} className="lb-year" aria-label={y}>
          <h2 className="lb-year-title">{y} <span className="sub">{plural(list.length, "trip")}</span></h2>
          <div className="tl-grid">{list.map(x => <TripCard key={x.id} trip={x} dash={dash} notify={notify} />)}</div>
        </section>
      );
    })}
  </>);
}

const code = (s: string) => (/^[a-z]{3}$/i.test(s.trim()) ? s.trim().toUpperCase() : s.trim());

function Flights({ dash, composing, setComposing }: { dash: Dashboard; composing: boolean; setComposing: (v: boolean) => void }) {
  const t = today();
  const flights = [...dash.entries.flights].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt));
  const years = [...new Set(flights.map(f => f.data.date.slice(0, 4)))];
  const airports = new Set(flights.flatMap(f => [f.data.from, f.data.to]));
  const airlines = new Set(flights.map(f => f.data.airline).filter(Boolean));

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    await dash.add("flights", { date: v.date, from: code(v.from), to: code(v.to), airline: v.airline.trim(), number: v.number.trim().toUpperCase() });
    form.reset();
    (form.elements.namedItem("from") as HTMLInputElement).focus();
  };

  return (<>
    {composing && (
      <form className="glass fl-form" onSubmit={add}>
        <input className="btn" type="date" name="date" defaultValue={t} required aria-label="Date" />
        <input className="btn fl-code" name="from" placeholder="From (SFO)" required aria-label="From" />
        <span className="fl-arrow" aria-hidden="true">→</span>
        <input className="btn fl-code" name="to" placeholder="To (SEA)" required aria-label="To" />
        <input className="btn" name="airline" placeholder="Airline" aria-label="Airline" />
        <input className="btn fl-num" name="number" placeholder="Flight no." aria-label="Flight number" />
        <button className="btn primary">Add flight</button>
        <button type="button" className="btn" onClick={() => setComposing(false)}>Done</button>
      </form>
    )}
    {flights.length === 0 ? (!composing && (
      <section className="glass page-empty">
        <img className="mascot lg" src="/mascot.svg" alt="" />
        <h2>No flights yet</h2>
        <p className="sub">Log each flight you take to see where you've been, how many airports you've touched and who you fly with most.</p>
        <button className="btn primary" onClick={() => setComposing(true)}>+ Add flight</button>
      </section>
    )) : (<>
      <section className="glass sum-card">
        <div className="summary">
          <span className="chip accent"><b>{flights.length}</b> {flights.length === 1 ? "flight" : "flights"}</span>
          <span className="chip"><b>{airports.size}</b> {airports.size === 1 ? "airport" : "airports"}</span>
          {airlines.size > 0 && <span className="chip"><b>{airlines.size}</b> {airlines.size === 1 ? "airline" : "airlines"}</span>}
          <span className="chip"><b>{flights.filter(f => f.data.date.startsWith(t.slice(0, 4))).length}</b> in {t.slice(0, 4)}</span>
        </div>
      </section>
      {years.map(y => {
        const list = flights.filter(f => f.data.date.startsWith(y));
        return (
          <section key={y} className="lb-year" aria-label={y}>
            <h2 className="lb-year-title">{y} <span className="sub">{plural(list.length, "flight")}</span></h2>
            <ul className="glass fl-list">
              {list.map(f => (
                <li key={f.id} className="fl-row">
                  <span className="fl-route"><b>{f.data.from}</b><span className="fl-arrow" aria-hidden="true">→</span><b>{f.data.to}</b></span>
                  <span className="fl-meta">{[f.data.airline, f.data.number].filter(Boolean).join(" ")}</span>
                  <span className="fl-date sub">{fmt(f.data.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <button className="tl-x" aria-label={`Remove ${f.data.from} to ${f.data.to}`} title="Remove" onClick={() => dash.remove(f)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>)}
  </>);
}

type Tab = "journal" | "flights";
const tabFromHash = (): Tab => (window.location.hash === "#flights" ? "flights" : "journal");

export function TravelPage({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [composing, setComposing] = useState(false);
  const setTab = (t: Tab) => {
    setTabState(t);
    setComposing(false);
    window.history.replaceState(null, "", t === "flights" ? "#flights" : window.location.pathname);
  };

  return (
    <PageShell path="/travel" actions={
      <button className="btn primary" onClick={() => setComposing(true)}>{tab === "journal" ? "+ New trip" : "+ Add flight"}</button>
    }>
      <div className="seg tr-tabs" role="tablist" aria-label="Travel">
        <button role="tab" aria-selected={tab === "journal"} className={tab === "journal" ? "on" : ""} onClick={() => setTab("journal")}>Trip journal</button>
        <button role="tab" aria-selected={tab === "flights"} className={tab === "flights" ? "on" : ""} onClick={() => setTab("flights")}>Flights I've Taken</button>
      </div>
      {tab === "journal"
        ? <TripJournal dash={dash} notify={notify} composing={composing} setComposing={setComposing} />
        : <Flights dash={dash} composing={composing} setComposing={setComposing} />}
    </PageShell>
  );
}
