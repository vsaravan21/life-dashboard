import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { shrinkPhoto } from "../lib/image";
import { isVideoFile, isVideoRef, MAX_VIDEO_MB } from "../lib/media";
import type { Dashboard } from "../lib/useDashboard";

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

/** A photo's note: hidden until you hover the photo, then it rises from the bottom. Click it to write or change it. */
function PhotoNote({ text, onSave }: { text: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const done = () => { setEditing(false); if (draft.trim() !== text) onSave(draft.trim()); };
  return (
    <div className={"tr-cap" + (text ? " has" : "") + (editing ? " editing" : "")}>
      {editing ? (
        <textarea className="tr-cap-input" value={draft} autoFocus rows={2} placeholder="A note about this photo" aria-label="Photo note"
          onChange={e => setDraft(e.target.value)} onBlur={done}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { setDraft(text); setEditing(false); } }} />
      ) : (
        <button className="tr-cap-text" onClick={() => setEditing(true)} title={text ? "Edit note" : undefined}>{text || "+ Add a note"}</button>
      )}
    </div>
  );
}

function Slide({ dash, photo, alt, lift, note, onNote }: { dash: Dashboard; photo: string; alt: string; lift?: number; note: string; onNote: (t: string) => void }) {
  const src = useMediaUrl(dash, photo);
  return (
    <div className={"tr-slide" + (lift !== undefined ? " lifted" : "")} style={lift !== undefined ? { transform: `translateX(${lift}px) scale(.93)` } : undefined}>
      {!src ? <span className="sub">Loading…</span>
        : isVideoRef(photo) ? <video src={src} controls playsInline preload="metadata" aria-label={alt} />
        : <img src={src} alt={alt} loading="lazy" draggable={false} />}
      {src && <PhotoNote text={note} onSave={onNote} />}
    </div>
  );
}

/**
 * Photos and videos as swipeable slides, with arrows, dots and a way to add more. Drag a photo sideways to move it.
 * Each photo can carry a short note (keyed by its ref) that shows when you hover it.
 */
export function Slides({ photos: saved, setPhotos, notes, setNote, label, dash, notify }: {
  photos: string[] | undefined; setPhotos: (photos: string[]) => Promise<void>;
  notes: Record<string, string> | undefined; setNote: (ref: string, text: string) => void;
  label: string; dash: Dashboard; notify: (m: string) => void;
}) {
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
    // The note at the bottom is for reading and typing, not dragging.
    if ((e.target as HTMLElement).closest(".tr-cap")) return;
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
            lift={lift?.ref === p ? lift.dx : undefined} note={notes?.[p] ?? ""} onNote={t => setNote(p, t)} />
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


/** A card's own note, kept out of sight until you hover the card's cover; it then drops down over the top of the photos. */
export function CoverNote({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <div className={"tl-head-wrap" + (note ? " has-note" : "")}>
      {children}
      {note && <div className="tl-note-pop" role="note">{note}</div>}
    </div>
  );
}

/** The note icon beside a card's dates, so you know there's something to hover for. */
export const NoteMark = () => (
  <svg className="tl-note-mark" viewBox="0 0 24 24" width="13" height="13" aria-label="Has a note" role="img" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5.5h14v10H10l-4 3.5v-3.5H5Z" /><path d="M9 9.5h6M9 12.5h4" />
  </svg>
);

/** Drop notes for photos that are gone, so the notes map only holds photos still on the card. */
export const keepNotes = (notes: Record<string, string> | undefined, photos: string[]) =>
  Object.fromEntries(Object.entries(notes ?? {}).filter(([ref, t]) => t && photos.includes(ref)));

/** A card's note, edited in its options menu and saved when you leave the box. */
export function NoteField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return <textarea className="tl-note-input" rows={3} value={text} placeholder={placeholder} aria-label="Note"
    onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())} />;
}
