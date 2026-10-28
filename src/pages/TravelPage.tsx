import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { plural } from "../components/ui";
import { daysBetween, fmt, today } from "../lib/dates";
import { busiestYears, byYear, countryOf, flightWhen, isInternational, isUpcoming, yearStats } from "../lib/flights";
import { shrinkPhoto } from "../lib/image";
import { isVideoFile, isVideoRef, MAX_VIDEO_MB } from "../lib/media";
import { ImportButton } from "../components/ImportButton";
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

/** At most this many dots show; with more photos, the row slides along with the one you're on. */
const MAX_DOTS = 7;
/** The photo numbers whose dots show, keeping the current one near the middle. */
function dotWindow(total: number, at: number) {
  const size = Math.min(total, MAX_DOTS);
  const start = Math.max(0, Math.min(at - Math.floor(size / 2), total - size));
  return Array.from({ length: size }, (_, k) => start + k);
}
/** End dots shrink when more photos lie beyond them, a hint that the row keeps going. */
function dotEdge(total: number, at: number, n: number) {
  const w = dotWindow(total, at);
  return (n === w[0] && n > 0) || (n === w[w.length - 1] && n < total - 1);
}

/** A stored photo's or video's displayable URL, once it's ready. */
function useMediaUrl(dash: Dashboard, ref: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    dash.store.photoUrl(ref).then(u => live && setSrc(u));
    return () => { live = false; };
  }, [dash.store, ref]);
  return src;
}

function Slide({ dash, photo, alt, lift }: { dash: Dashboard; photo: string; alt: string; lift?: number }) {
  const src = useMediaUrl(dash, photo);
  return (
    <div className={"tr-slide" + (lift !== undefined ? " lifted" : "")} style={lift !== undefined ? { transform: `translateX(${lift}px) scale(.93)` } : undefined}>
      {!src ? <span className="sub">Loading…</span>
        : isVideoRef(photo) ? <video src={src} controls playsInline preload="metadata" aria-label={alt} />
        : <img src={src} alt={alt} loading="lazy" draggable={false} />}
    </div>
  );
}

/** A trip's photos and videos as swipeable slides, with arrows, dots and a way to add more. Drag a photo sideways to move it. */
export function Slides({ trip, label, dash, notify }: { trip: Entry<"trips"> | Entry<"projects">; label: string; dash: Dashboard; notify: (m: string) => void }) {
  const saved = trip.data.photos;
  // Trips and projects both keep their slides in `photos`.
  const setPhotos = (photos: string[]) => dash.patch(trip as Entry<"trips">, { photos });
  const [draft, setDraft] = useState<string[] | null>(null);
  const photos = draft ?? saved ?? [];
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(0);
  const [lift, setLift] = useState<{ ref: string; dx: number } | null>(null);
  const i = Math.min(at, Math.max(0, photos.length - 1));

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const to = (n + photos.length) % photos.length;
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const now = Math.round(el.scrollLeft / el.clientWidth);
    setAt(now);
    // A video keeps playing only while it's the one on screen.
    el.querySelectorAll("video").forEach(v => { if (v.closest(".tr-slide") !== el.children[now]) v.pause(); });
  };
  const add = async (files: FileList | null) => {
    const all = [...(files ?? [])].filter(f => f.type.startsWith("image/") || isVideoFile(f));
    const big = all.filter(f => isVideoFile(f) && f.size > MAX_VIDEO_MB * 1024 * 1024);
    if (big.length) notify(`${big.length === 1 ? `"${big[0].name}" is` : `${big.length} videos are`} over ${MAX_VIDEO_MB} MB, so ${big.length === 1 ? "it was" : "they were"} skipped. Try a shorter clip.`);
    const list = all.filter(f => !big.includes(f));
    if (!list.length) return;
    setBusy(list.length);
    const refs: string[] = [];
    try {
      for (const f of list) { refs.push(await dash.store.uploadPhoto(isVideoFile(f) ? f : await shrinkPhoto(f))); setBusy(b => b - 1); }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't add that file.");
    } finally {
      setBusy(0);
      if (input.current) input.current.value = "";
    }
    if (refs.length) {
      const start = photos.length;
      await setPhotos([...photos, ...refs]);
      requestAnimationFrame(() => go(start));
    }
  };
  const removeCurrent = async () => {
    const ref = photos[i];
    if (!ref) return;
    await setPhotos(photos.filter((_, n) => n !== i));
    dash.store.removePhoto(ref).catch(() => undefined);
    // The next photo slides into this spot; at the end, the browser pulls back to the new last one.
    setAt(Math.max(0, Math.min(i, photos.length - 2)));
  };
  /** Move the photo at `from` one step either way, keeping it on screen. */
  const shift = (list: string[], from: number, by: number) => {
    const to = from + by;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    const el = track.current;
    if (el) requestAnimationFrame(() => { el.scrollTo({ left: to * el.clientWidth }); setAt(to); });
    return next;
  };
  const save = (next: string[]) => {
    if (next.join("|") !== (saved ?? []).join("|")) void setPhotos(next).finally(() => setDraft(null));
    else setDraft(null);
  };

  // Press on a photo and drag it sideways: past about a third of the frame it trades places with its neighbor.
  // A mouse picks it up as soon as it moves; a finger holds still for a moment first, so a quick swipe still flips through.
  const onPointerDown = (e: ReactPointerEvent) => {
    const el = track.current, slide = (e.target as HTMLElement).closest(".tr-slide");
    if (!el || photos.length < 2 || !slide || e.button !== 0) return;
    // Leave a video's own play bar alone.
    if ((e.target as HTMLElement).tagName === "VIDEO" && e.clientY > slide.getBoundingClientRect().bottom - 56) return;
    const touch = e.pointerType !== "mouse";
    let order = [...photos], from = Math.round(el.scrollLeft / el.clientWidth), x0 = e.clientX, y0 = e.clientY, held = !touch, moved = false;
    const ref = order[from];
    const timer = touch ? window.setTimeout(() => { held = true; setLift({ ref, dx: 0 }); navigator.vibrate?.(15); }, 320) : 0;
    const block = (t: TouchEvent) => { if (held) t.preventDefault(); };
    const move = (m: PointerEvent) => {
      const dx = m.clientX - x0;
      if (!held) { if (Math.hypot(dx, m.clientY - y0) > 8) end(); return; }
      if (!moved && Math.abs(dx) < 6) return;
      moved = true;
      m.preventDefault();
      const w = el.clientWidth, by = dx > w / 3 ? 1 : dx < -w / 3 ? -1 : 0;
      if (by && from + by >= 0 && from + by < order.length) {
        order = shift(order, from, by);
        from += by;
        x0 += by * w;
        setDraft(order);
      }
      setLift({ ref, dx: m.clientX - x0 });
    };
    const end = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.removeEventListener("touchmove", block);
      setLift(null);
      if (moved) save(order);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    el.addEventListener("touchmove", block, { passive: false });
  };
  // With the photos in focus, the arrow keys flip through them and Shift + arrow moves the one showing.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const by = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!by || e.target !== e.currentTarget) return;
    e.preventDefault();
    if (e.shiftKey) save(shift(photos, i, by));
    else go(i + by);
  };

  const picker = <input ref={input} type="file" accept="image/*,video/*" multiple hidden aria-label={`Add photos or videos to ${label}`} onChange={e => add(e.target.files)} />;
  if (!photos.length) return (
    <button className="tr-empty" onClick={() => input.current?.click()} disabled={busy > 0}>
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></svg>
      <span>{busy ? `Adding ${busy} file${busy === 1 ? "" : "s"}…` : "Add photos or videos"}</span>
      {picker}
    </button>
  );
  return (<>
    <div className="tr-slides" aria-roledescription="carousel" aria-label={`${label} photos`}>
      <div className={"tr-track" + (lift ? " lifting" : "")} ref={track} onScroll={onScroll} onPointerDown={onPointerDown} onKeyDown={onKeyDown} tabIndex={0}
        aria-label={photos.length > 1 ? "Drag a photo sideways to move it, or press Shift and an arrow key" : undefined}>
        {photos.map((p, n) => (
          <Slide key={p} dash={dash} photo={p} alt={`${label}, ${isVideoRef(p) ? "video" : "photo"} ${n + 1} of ${photos.length}`}
            lift={lift?.ref === p ? lift.dx : undefined} />
        ))}
      </div>
      {lift && <span className="tr-moving" aria-live="polite">Moving to {i + 1} of {photos.length}</span>}
      {photos.length > 1 && <>
        <button className="tr-nav prev" aria-label="Previous photo" onClick={() => go(i - 1)}>‹</button>
        <button className="tr-nav next" aria-label="Next photo" onClick={() => go(i + 1)}>›</button>
      </>}
      <div className="tr-bar">
        <span className="tr-count">{i + 1} / {photos.length}</span>
        {photos.length > 1 && (
          <span className="tr-dots">{dotWindow(photos.length, i).map(n => (
            <button key={photos[n]} className={(n === i ? "on" : "") + (dotEdge(photos.length, i, n) ? " edge" : "")} aria-label={`Photo ${n + 1}`} onClick={() => go(n)} />
          ))}</span>
        )}
        <span className="tr-acts">
          <button className="tr-act" onClick={() => input.current?.click()} disabled={busy > 0} aria-label="Add photos or videos" title="Add photos or videos">{busy ? "…" : "+"}</button>
          <button className="tr-act" onClick={removeCurrent} aria-label="Remove this photo" title="Remove this one">×</button>
        </span>
      </div>
      {picker}
    </div>
  </>);
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
      <Slides trip={trip} label={trip.data.place} dash={dash} notify={notify} />
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
          <p className="sub">Add a trip to give it a card, then fill it with photos and videos you can swipe through.</p>
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
const count = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function FlightRow({ f, dash, now }: { f: Entry<"flights">; dash: Dashboard; now: string }) {
  const d = f.data, abroad = isInternational(d);
  return (
    <li className="fl-row">
      <div className="fl-main">
        <span className="fl-route"><b>{d.from}</b><span className="fl-arrow" aria-hidden="true">→</span><b>{d.to}</b></span>
        {(d.reason || d.airline || d.number) && <span className="fl-meta">{[d.reason, [d.airline, d.number].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</span>}
        {(d.note || abroad || isUpcoming(d, now)) && (
          <span className="fl-tags">
            {isUpcoming(d, now) && <span className="pill">booked</span>}
            {abroad && <span className="pill fl-intl">international</span>}
            {d.note && <span className="pill fl-note">✦ {d.note}</span>}
          </span>
        )}
      </div>
      <span className="fl-date sub">{flightWhen(d.date)}</span>
      <button className="tl-x" aria-label={`Remove ${d.from} to ${d.to}`} title="Remove" onClick={() => dash.remove(f)}>×</button>
    </li>
  );
}

function Flights({ dash, composing, setComposing }: { dash: Dashboard; composing: boolean; setComposing: (v: boolean) => void }) {
  const t = today();
  const groups = byYear(dash.entries.flights);
  const all = dash.entries.flights.map(f => f.data);
  const places = new Set(all.flatMap(f => [f.from, f.to]));
  const countries = new Set([...places].map(countryOf));
  const busiest = busiestYears(groups);
  const first = groups[groups.length - 1]?.year;

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const extra = Object.fromEntries(Object.entries({ reason: v.reason.trim(), note: v.note.trim() }).filter(([, x]) => x));
    await dash.add("flights", { date: v.date, from: code(v.from), to: code(v.to), ...extra });
    form.reset();
    (form.elements.namedItem("from") as HTMLInputElement).focus();
  };

  return (<>
    {composing && (
      <form className="glass fl-form" onSubmit={add}>
        <input className="btn" type="month" name="date" defaultValue={t.slice(0, 7)} required aria-label="Month" />
        <input className="btn fl-code" name="from" placeholder="From" required aria-label="From" />
        <span className="fl-arrow" aria-hidden="true">→</span>
        <input className="btn fl-code" name="to" placeholder="To" required aria-label="To" />
        <input className="btn fl-wide" name="reason" placeholder="Why? (Back to school…)" aria-label="Reason" />
        <input className="btn fl-wide" name="note" placeholder="A first? (First solo flight…)" aria-label="Note" />
        <button className="btn primary">Add flight</button>
        <button type="button" className="btn" onClick={() => setComposing(false)}>Done</button>
      </form>
    )}
    {groups.length === 0 ? (!composing && (
      <section className="glass page-empty">
        <img className="mascot lg" src="/mascot.svg" alt="" />
        <h2>No flights yet</h2>
        <p className="sub">Log each flight to see your years in the air: how many flights, which cities and countries, and your firsts. Or import a flights file.</p>
        <button className="btn primary" onClick={() => setComposing(true)}>+ Add flight</button>
      </section>
    )) : (<>
      <section className="glass sum-card">
        <div className="summary">
          <span className="chip accent"><b>{all.length}</b> {all.length === 1 ? "flight" : "flights"} since {first}</span>
          <span className="chip"><b>{places.size}</b> {places.size === 1 ? "city" : "cities"}</span>
          <span className="chip"><b>{countries.size}</b> {countries.size === 1 ? "country" : "countries"}</span>
          {groups.length > 1 && <span className="chip">Busiest {busiest.years.length > 1 ? "years" : "year"} <b>{[...busiest.years].reverse().join(" & ")}</b> · {busiest.flights} flights</span>}
        </div>
      </section>
      {groups.map(g => {
        const s = yearStats(g.year, g.flights.map(f => f.data), t);
        return (
          <section key={g.year} className="glass fl-year" aria-label={g.year}>
            <header className="fl-year-head">
              <div>
                <h2 className="fl-year-title">{g.year}</h2>
                <p className="fl-headline"><b>{count(s.flights, "flight")}</b> in {g.year}{s.upcoming ? ` · ${s.flown} flown, ${s.upcoming} booked` : ""}</p>
              </div>
              <div className="summary fl-stats">
                <span className="chip"><b>{s.cities}</b> {s.cities === 1 ? "city" : "cities"}</span>
                {s.international > 0 && <span className="chip"><b>{s.international}</b> international</span>}
                {s.countries.length > 0 && <span className="chip">{s.countries.join(", ")}</span>}
              </div>
            </header>
            <div className="card-scroll"><ul className="fl-list">{g.flights.map(f => <FlightRow key={f.id} f={f} dash={dash} now={t} />)}</ul></div>
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
    <PageShell path="/travel" actions={<>
      {tab === "flights" && <ImportButton dash={dash} onDone={notify} />}
      <button className="btn primary" onClick={() => setComposing(true)}>{tab === "journal" ? "+ New trip" : "+ Add flight"}</button>
    </>}>
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
