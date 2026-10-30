import { useRef, useState, type FormEvent } from "react";
import { daysBetween, fmt, today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { Entry, UpNextData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useStoredUrl } from "../lib/useStoredUrl";
import { colorOf, Swatches } from "../pages/TodoPage";

type Trip = Entry<"upnext">;
const COLORS = ["sunset", "periwinkle", "mint", "blush", "honey", "orchid"];
const BOOKED = [["flights", "Flights"], ["stay", "Stay"], ["timeoff", "Time off"]] as const;
/** Two tiles show until you ask for the rest. */
const SHOWN = 2;

/** Dated trips soonest first, then the ones you're still dreaming about. Trips that are over drop off. */
export function upcoming(trips: Trip[], now = today()) {
  const live = trips.filter(t => !t.data.start || (t.data.end || t.data.start) >= now);
  return live.sort((a, b) => {
    if (!!a.data.start !== !!b.data.start) return a.data.start ? -1 : 1;
    return (a.data.start ?? "").localeCompare(b.data.start ?? "") || a.createdAt.localeCompare(b.createdAt);
  });
}

/** The big line on a tile: how many days to go, "Now" while you're there, or roughly when for a dream. */
export function countdown(d: UpNextData, now = today()): { big: string; small: string } {
  if (!d.start) return { big: d.when?.trim() || "Someday", small: "dreaming" };
  const days = daysBetween(now, d.start);
  if (days <= 0) return { big: "Now", small: "you're there!" };
  if (days === 1) return { big: "1", small: "day to go" };
  return { big: String(days), small: "days to go" };
}

const dates = (d: UpNextData) => {
  if (!d.start) return "";
  const end = d.end && d.end !== d.start ? d.end : "";
  const sameYear = !end || end.slice(0, 4) === d.start.slice(0, 4);
  const start = fmt(d.start, { month: "short", day: "numeric", ...(sameYear && end ? {} : { year: "numeric" }) });
  return end ? `${start} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}` : start;
};

function Tile({ trip, dash, big, onEdit }: { trip: Trip; dash: Dashboard; big: boolean; onEdit: () => void }) {
  const d = trip.data;
  const { src } = useStoredUrl(dash.store, d.photo);
  const c = countdown(d);
  const toggle = (k: keyof NonNullable<UpNextData["booked"]>) => dash.patch(trip, { booked: { ...d.booked, [k]: !d.booked?.[k] } });
  return (
    <article className={`un-tile cover ${colorOf(d.color).cover}` + (big ? " big" : "") + (src ? " has-photo" : "")} aria-label={d.place}>
      {src && <img className="un-photo" src={src} alt="" decoding="async" />}
      <button className="un-edit" aria-label={`Edit ${d.place}`} title="Edit" onClick={onEdit}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></svg>
      </button>
      <div className="un-count">
        <b className={d.start ? "" : "loose"}>{c.big}</b>
        <span>{c.small}</span>
      </div>
      <div className="un-info">
        <h3>{d.place}</h3>
        {(d.sub || d.start) && <p>{[d.sub, dates(d)].filter(Boolean).join(" · ")}</p>}
        <div className="un-booked" role="group" aria-label="Booked">
          {BOOKED.map(([k, label]) => (
            <button key={k} className={d.booked?.[k] ? "on" : ""} aria-pressed={!!d.booked?.[k]} onClick={() => toggle(k)}>
              {d.booked?.[k] && <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              {label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Add a trip, or change one: where, a line under it, dates (or a rough "when"), color and a photo. */
function TripForm({ trip, dash, notify, color: startColor, onDone }: { trip?: Trip; dash: Dashboard; notify: (m: string) => void; color: string; onDone: () => void }) {
  const d = trip?.data;
  const [color, setColor] = useState(d?.color ?? startColor);
  const [dated, setDated] = useState(d ? !!d.start : true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (dated && v.end && v.end < v.start) return notify("The return date is before the start date.");
    setBusy(true);
    try {
      let ref = dropPhoto ? undefined : d?.photo;
      if (photo) ref = await dash.store.uploadPhoto(await shrinkPhoto(photo, 1200));
      if (d?.photo && d.photo !== ref) dash.store.removePhoto(d.photo).catch(() => undefined);
      const data: UpNextData = {
        place: v.place.trim() || "Somewhere", sub: v.sub.trim() || undefined, color, photo: ref, booked: d?.booked,
        ...(dated ? { start: v.start, end: v.end || undefined } : { when: v.when.trim() || undefined }),
      };
      if (trip) await dash.patch(trip, { ...data, ...(dated ? { when: undefined } : { start: undefined, end: undefined }) });
      else await dash.add("upnext", data);
      onDone();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't save that trip.");
    } finally { setBusy(false); }
  };

  return (
    <form className="add un-form" onSubmit={save}>
      <input className="grow" name="place" defaultValue={d?.place} placeholder="Where to? New York, Europe…" required aria-label="Where" autoFocus />
      <input className="grow" name="sub" defaultValue={d?.sub} placeholder="A line under it, like Paris · Rome · Amalfi (optional)" aria-label="Details" />
      <div className="seg" role="radiogroup" aria-label="Dates">
        <button type="button" role="radio" aria-checked={dated} className={dated ? "on" : ""} onClick={() => setDated(true)}>Dates set</button>
        <button type="button" role="radio" aria-checked={!dated} className={!dated ? "on" : ""} onClick={() => setDated(false)}>Still dreaming</button>
      </div>
      {dated ? (
        <div className="un-dates">
          <label className="sub">Leaving <input className="btn" type="date" name="start" defaultValue={d?.start ?? today()} required /></label>
          <label className="sub">Back <input className="btn" type="date" name="end" defaultValue={d?.end} /></label>
        </div>
      ) : (
        <input className="grow" name="when" defaultValue={d?.when} placeholder="Roughly when? Summer 2027, someday…" aria-label="Roughly when" />
      )}
      <Swatches value={color} onChange={setColor} />
      <div className="un-photo-row">
        <button type="button" className="btn sm" onClick={() => file.current?.click()}>{photo ? photo.name : d?.photo && !dropPhoto ? "Change photo" : "Add a photo"}</button>
        {(photo || (d?.photo && !dropPhoto)) && <button type="button" className="btn sm" onClick={() => { setPhoto(null); setDropPhoto(true); }}>Use the color instead</button>}
        <input ref={file} type="file" accept="image/*" hidden aria-label="Photo" onChange={e => { setPhoto(e.target.files?.[0] ?? null); setDropPhoto(false); }} />
      </div>
      <div className="acts">
        {trip && (
          <button type="button" className={"btn" + (confirm ? " danger" : "")} onClick={() => (confirm ? (dash.remove(trip), onDone()) : setConfirm(true))}>
            {confirm ? `Remove ${d!.place}?` : "Remove"}
          </button>
        )}
        <span className="grow1" />
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : trip ? "Save" : "Add trip"}</button>
      </div>
    </form>
  );
}

/** Big trips coming up, as countdown tiles. Lives only on the home page. */
export function UpNext({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = upcoming(dash.entries.upnext);
  const shown = all ? list : list.slice(0, SHOWN);
  const more = list.length - SHOWN;
  const editTrip = list.find(t => t.id === editing);
  const close = () => { setAdding(false); setEditing(null); };

  return (
    <section className="panel glass un-card" id="p-upnext">
      <div className="cover c-trips">
        <h2>Up next</h2>
        <button className="add-btn" aria-label="Add a trip" aria-expanded={adding} onClick={() => { setEditing(null); setAdding(a => !a); }}>+</button>
      </div>
      <div className="sec-meta">
        <span className="label">Big trips</span>
        {more > 0 && <button className="pill un-more" aria-expanded={all} onClick={() => setAll(a => !a)}>{all ? "Show less" : `+${more} more`}</button>}
      </div>
      {(adding || editTrip) && (
        <TripForm key={editTrip?.id ?? "new"} trip={editTrip} dash={dash} notify={notify} color={COLORS[dash.entries.upnext.length % COLORS.length]} onDone={close} />
      )}
      {list.length === 0 && !adding ? (
        <button className="un-empty" onClick={() => setAdding(true)}>
          <b>Where to next?</b>
          <span className="sub">Add a big trip to start the countdown</span>
          <span className="un-plus" aria-hidden="true">+</span>
        </button>
      ) : (
        <div className={"un-tiles n" + Math.min(shown.length, 2)}>
          {shown.map(t => <Tile key={t.id} trip={t} dash={dash} big={shown.length === 1} onEdit={() => { setAdding(false); setEditing(t.id); }} />)}
        </div>
      )}
    </section>
  );
}
