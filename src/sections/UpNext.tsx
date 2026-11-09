import { useRef, useState, type FormEvent } from "react";
import { daysBetween, fmt, today } from "../lib/dates";
import { shrinkPhoto } from "../lib/image";
import type { Entry, UpNextData } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import { useStoredUrl } from "../lib/useStoredUrl";
import { colorOf, Swatches } from "../pages/TodoPage";

type Trip = Entry<"upnext">;
const COLORS = ["sunset", "periwinkle", "mint", "blush", "honey", "orchid"];
/** Up to four tiles show until you ask for the rest. */
const SHOWN = 4;
const isWeb = (r?: string) => !!r && /^https?:\/\//.test(r);

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

/** A stored photo's link, or a web link as it is. */
function usePhoto(dash: Dashboard, ref?: string) {
  const stored = useStoredUrl(dash.store, isWeb(ref) ? null : ref);
  return isWeb(ref) ? { src: ref!, onError: () => undefined, attempt: 0, web: true } : { ...stored, web: false };
}

/** How bright the bottom of a photo is, 0 to 1, so the frosted text can pick light or dark glass. Web photos can't be read; they get dark glass. */
function brightness(img: HTMLImageElement): number | null {
  try {
    const c = document.createElement("canvas");
    c.width = 24; c.height = 12;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, img.naturalHeight * 0.55, img.naturalWidth, img.naturalHeight * 0.45, 0, 0, 24, 12);
    const px = g.getImageData(0, 0, 24, 12).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return sum / (px.length / 4) / 255;
  } catch { return null; }
}

function Tile({ trip, dash, size, onEdit }: { trip: Trip; dash: Dashboard; size: number; onEdit: () => void }) {
  const d = trip.data;
  const { src, onError, attempt, web } = usePhoto(dash, d.photo);
  const [light, setLight] = useState(false);
  const [open, setOpen] = useState(false);
  const c = countdown(d);
  const plan = d.itinerary?.trim();
  return (
    <article className={`un-tile cover ${colorOf(d.color).cover}` + (src ? " has-photo" : "") + (light ? " light" : "") + (open ? " open" : "") + (size === 1 ? " solo" : "")}
      aria-label={d.place} onClick={() => setOpen(o => !o)} onMouseLeave={() => setOpen(false)}>
      {src && <img key={attempt} className="un-photo" src={src} alt="" decoding="async" crossOrigin={web ? undefined : "anonymous"}
        onError={onError} onLoad={e => setLight((brightness(e.currentTarget) ?? 0) > 0.62)} />}
      <span className="un-chip"><b>{c.big}</b>{d.start && c.big !== "Now" ? " " + c.small : ""}</span>
      <button className="un-edit" aria-label={`Edit ${d.place}`} title="Edit" onClick={e => { e.stopPropagation(); onEdit(); }}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></svg>
      </button>
      <div className="un-glass">
        <h3>{d.place}</h3>
        <p>{[d.sub, dates(d)].filter(Boolean).join(" · ") || "Still dreaming"}</p>
      </div>
      <div className="un-plan" role="note" aria-label={`${d.place} itinerary`}>
        <span className="un-plan-head">Itinerary</span>
        {plan ? <div className="un-plan-text">{plan}</div>
          : <button className="un-plan-add" onClick={e => { e.stopPropagation(); onEdit(); }}>No plans yet. Add an itinerary</button>}
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
  const [link, setLink] = useState(isWeb(d?.photo) ? d!.photo! : "");
  const [linking, setLinking] = useState(false);
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
      const url = link.trim();
      if (photo) ref = await dash.store.uploadPhoto(await shrinkPhoto(photo, 1600));
      else if (!dropPhoto && url && url !== d?.photo) ref = await fromWeb(url);
      if (d?.photo && d.photo !== ref && !isWeb(d.photo)) dash.store.removePhoto(d.photo).catch(() => undefined);
      const data: UpNextData = {
        place: v.place.trim() || "Somewhere", sub: v.sub.trim() || undefined, color, photo: ref, itinerary: v.itinerary.trim() || undefined,
        ...(dated ? { start: v.start, end: v.end || undefined } : { when: v.when.trim() || undefined }),
      };
      if (trip) await dash.patch(trip, { ...data, ...(dated ? { when: undefined } : { start: undefined, end: undefined }) });
      else await dash.add("upnext", data);
      onDone();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't save that trip.");
    } finally { setBusy(false); }
  };

  /** Keep a copy of a web photo when the site allows it, so it can't vanish; otherwise keep the link. */
  const fromWeb = async (url: string) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      if (!res.ok || !blob.type.startsWith("image/")) throw new Error();
      return await dash.store.uploadPhoto(await shrinkPhoto(new File([blob], "photo", { type: blob.type }), 1600));
    } catch { return url; }
  };
  const pick = (f: File | null | undefined) => { if (f) { setPhoto(f); setDropPhoto(false); setLink(""); setLinking(false); } };
  const hasPhoto = !!photo || !!link.trim() || (!!d?.photo && !isWeb(d.photo) && !dropPhoto);

  return (
    <form className="add un-form" onSubmit={save} onPaste={e => pick([...e.clipboardData.files].find(f => f.type.startsWith("image/")))}>
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
      <textarea className="grow un-itin" name="itinerary" rows={4} defaultValue={d?.itinerary} aria-label="Itinerary"
        placeholder={"Itinerary (optional). It shows when you hover the card.\nDay 1: land at JFK, dinner in the West Village\nDay 2: the Met, Central Park"} />
      <div className="un-photo-row">
        <button type="button" className="btn sm" onClick={() => file.current?.click()}>{photo ? photo.name : hasPhoto ? "Change photo" : "Upload a photo"}</button>
        {!photo && <button type="button" className={"btn sm" + (linking || link ? " on" : "")} onClick={() => setLinking(l => !l)}>Photo from a link</button>}
        {hasPhoto && <button type="button" className="btn sm" onClick={() => { setPhoto(null); setLink(""); setLinking(false); setDropPhoto(true); }}>Use the color instead</button>}
        <input ref={file} type="file" accept="image/*" hidden aria-label="Photo" onChange={e => pick(e.target.files?.[0])} />
        {(linking || link) && !photo && (
          <input className="grow" type="url" value={link} onChange={e => { setLink(e.target.value); setDropPhoto(false); }} placeholder="Paste an image link from the web" aria-label="Photo link" />
        )}
      </div>
      {!hasPhoto && <Swatches value={color} onChange={setColor} />}
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
        <div className={"un-tiles n" + Math.min(shown.length, 4)}>
          {shown.map(t => <Tile key={t.id} trip={t} dash={dash} size={shown.length} onEdit={() => { setAdding(false); setEditing(t.id); }} />)}
        </div>
      )}
    </section>
  );
}
