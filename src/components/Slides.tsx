import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { shrinkPhoto } from "../lib/image";
import { isVideoFile, isVideoRef, MAX_VIDEO_MB } from "../lib/media";
import type { Dashboard } from "../lib/useDashboard";
import { useStoredUrl } from "../lib/useStoredUrl";

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

/** How a photo sits in its frame: moved by x and y (percent of the frame) and zoomed by z, where 1 fills the frame. */
export interface Framing { x: number; y: number; z: number }
const MAX_Z = 4;
/** Zoom out at least far enough to see the whole photo (1 / cover), and never below a quarter. */
export const minZoom = (cover: number) => Math.max(0.25, Math.min(0.5, 1 / cover));
const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Keep the zoom in range and the photo from sliding entirely out of its frame. */
export function clampFrame(f: Framing, min = 0.5): Framing {
  const z = clampNum(f.z, min, MAX_Z), reach = 50 * z + 40;
  return { z: Math.round(z * 100) / 100, x: clampNum(f.x, -reach, reach), y: clampNum(f.y, -reach, reach) };
}
/**
 * The photo is laid out whole inside its frame (contain), then scaled up by `cover` so it fills the frame like before.
 * Zooming out below 1 therefore reveals the parts that were cut off, instead of shrinking a cropped picture.
 */
export const frameStyle = (f: Framing | undefined, cover: number) => {
  const { x, y, z } = f ?? { x: 0, y: 0, z: 1 };
  return { transform: `translate(${x}%, ${y}%) scale(${+(z * cover).toFixed(4)})` };
};
/** How much a contained photo must grow to fill the frame: 1 when the shapes match, more the more they differ. */
export function coverScale(frameW: number, frameH: number, imgW: number, imgH: number) {
  if (!frameW || !frameH || !imgW || !imgH) return 1;
  const sx = frameW / imgW, sy = frameH / imgH;
  return Math.max(sx, sy) / Math.min(sx, sy);
}
const isDefault = (f: Framing) => f.z === 1 && Math.abs(f.x) < 0.5 && Math.abs(f.y) < 0.5;

/**
 * Reframing one photo: drag to move it, pinch or scroll to zoom, or use the slider.
 * Changes show live and are saved with Done.
 */
function Adjuster({ f, cover, onChange, onDone, onCancel }: { f: Framing; cover: number; onChange: (f: Framing) => void; onDone: (f: Framing | null) => void; onCancel: () => void }) {
  const min = minZoom(cover);
  const box = useRef<HTMLDivElement>(null);
  const live = useRef(f);
  live.current = f;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const set = (next: Framing) => { live.current = clampFrame(next, min); onChange(live.current); };

  useEffect(() => {
    const el = box.current!;
    // Scrolling zooms here instead of moving the page.
    const wheel = (e: WheelEvent) => { e.preventDefault(); const c = live.current; set({ ...c, z: c.z * Math.exp(-e.deltaY / 400) }); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const down = (e: ReactPointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const move = (e: ReactPointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const rect = box.current!.getBoundingClientRect(), c = live.current;
    if (pts.current.size === 1) {
      set({ ...c, x: c.x + ((e.clientX - prev.x) / rect.width) * 100, y: c.y + ((e.clientY - prev.y) / rect.height) * 100 });
    } else {
      // Two fingers: zoom by how much the gap between them changed.
      const other = [...pts.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (before > 0) set({ ...c, z: c.z * (after / before) });
      }
    }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: ReactPointerEvent) => pts.current.delete(e.pointerId);

  return (
    <>
      <div ref={box} className="tr-adjust" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={e => { if (e.key === "Escape") onCancel(); }} tabIndex={-1}>
        <span className="tr-adjust-hint">Drag to move · pinch or scroll to zoom</span>
      </div>
      <div className="tr-adjust-bar" onPointerDown={e => e.stopPropagation()}>
        <span aria-hidden="true">−</span>
        <input type="range" min={min} max={MAX_Z} step={0.01} value={f.z} aria-label="Zoom" onChange={e => set({ ...f, z: Number(e.target.value) })} />
        <span aria-hidden="true">+</span>
        {cover > 1.01 && <button className="tr-adjust-btn" onClick={() => set({ x: 0, y: 0, z: 1 / cover })} title="Show the whole photo">Fit</button>}
        <button className="tr-adjust-btn" onClick={() => set({ x: 0, y: 0, z: 1 })}>Reset</button>
        <button className="tr-adjust-btn done" onClick={() => onDone(isDefault(f) ? null : f)}>Done</button>
      </div>
    </>
  );
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

function Slide({ dash, photo, alt, lift, note, onNote, near, frame, adjusting, onFrame, onStopAdjust }: {
  dash: Dashboard; photo: string; alt: string; lift?: number; note: string; onNote: (t: string) => void; near: boolean;
  frame?: Framing; adjusting: boolean; onFrame: (f: Framing | null) => void; onStopAdjust: () => void;
}) {
  const { src, onError, failed, attempt } = useStoredUrl(dash.store, photo);
  // While adjusting, the photo follows this draft; it's saved only with Done.
  const [draft, setDraft] = useState<Framing>(frame ?? { x: 0, y: 0, z: 1 });
  // Known once the photo loads; until then it shows cropped to fill, as it always has.
  const [cover, setCover] = useState<number | null>(null);
  useEffect(() => { if (adjusting) setDraft(frame ?? { x: 0, y: 0, z: 1 }); }, [adjusting]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={"tr-slide" + (lift !== undefined ? " lifted" : "") + (adjusting ? " adjusting" : "")} style={lift !== undefined ? { transform: `translateX(${lift}px) scale(.93)` } : undefined}>
      {failed ? <span className="sub">Couldn't load this one</span>
        : !src ? <span className="tr-loading" aria-label="Loading" />
        : isVideoRef(photo) ? <video key={attempt} src={src} controls playsInline preload="metadata" aria-label={alt} onError={onError} />
        // The photo on screen and its neighbors load right away; the rest wait until you get close.
        : <img key={attempt} src={src} alt={alt} loading={near ? "eager" : "lazy"} decoding="async" draggable={false} onError={onError}
            className={cover ? "framed" : undefined} style={cover ? frameStyle(adjusting ? draft : frame, cover) : undefined}
            onLoad={e => { const im = e.currentTarget; setCover(coverScale(im.clientWidth, im.clientHeight, im.naturalWidth, im.naturalHeight)); }} />}
      {src && !failed && !adjusting && <PhotoNote text={note} onSave={onNote} />}
      {adjusting && <Adjuster f={draft} cover={cover ?? 1} onChange={setDraft} onDone={f => { onFrame(f); onStopAdjust(); }} onCancel={onStopAdjust} />}
    </div>
  );
}

/**
 * Photos and videos as swipeable slides, with arrows, dots and a way to add more. Drag a photo sideways to move it.
 * Each photo can carry a short note (keyed by its ref) that shows when you hover it, and its own framing
 * (zoom and position inside the frame), set with the Adjust button.
 */
export function Slides({ photos: saved, setPhotos, notes, setNote, framing, setFraming, label, dash, notify }: {
  photos: string[] | undefined; setPhotos: (photos: string[]) => Promise<void>;
  notes: Record<string, string> | undefined; setNote: (ref: string, text: string) => void;
  framing: Record<string, Framing> | undefined; setFraming: (ref: string, f: Framing | null) => void;
  label: string; dash: Dashboard; notify: (m: string) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const photos = draft ?? saved ?? [];
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(0);
  const [lift, setLift] = useState<{ ref: string; dx: number } | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
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
    if (!el || photos.length < 2 || !slide || e.button !== 0 || adjusting) return;
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
      <div className={"tr-track" + (lift ? " lifting" : "") + (adjusting ? " adjusting" : "")} ref={track} onScroll={onScroll} onPointerDown={onPointerDown} onKeyDown={onKeyDown} tabIndex={0}
        aria-label={photos.length > 1 ? "Drag a photo sideways to move it, or press Shift and an arrow key" : undefined}>
        {photos.map((p, n) => (
          <Slide key={p} dash={dash} photo={p} alt={`${label}, ${isVideoRef(p) ? "video" : "photo"} ${n + 1} of ${photos.length}`}
            lift={lift?.ref === p ? lift.dx : undefined} note={notes?.[p] ?? ""} onNote={t => setNote(p, t)} near={Math.abs(n - i) <= 1}
            frame={framing?.[p]} adjusting={adjusting === p} onFrame={f => setFraming(p, f)} onStopAdjust={() => setAdjusting(null)} />
        ))}
      </div>
      {lift && <span className="tr-moving" aria-live="polite">Moving to {i + 1} of {photos.length}</span>}
      {photos.length > 1 && !adjusting && <>
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
          {photos[i] && !isVideoRef(photos[i]) && (
            <button className={"tr-act" + (adjusting ? " on" : "")} aria-pressed={!!adjusting} onClick={() => setAdjusting(a => (a ? null : photos[i]))} aria-label="Adjust this photo" title="Zoom and move">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2.5V18h15.5" /><path d="M2.5 6H18v15.5" /></svg>
            </button>
          )}
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
/** The same for framing: keep only photos still on the card, and drop any reset back to plain. */
export const keepFraming = (framing: Record<string, Framing> | undefined, photos: string[]) =>
  Object.fromEntries(Object.entries(framing ?? {}).filter(([ref, f]) => f && photos.includes(ref)));

/** A card's note, edited in its options menu and saved when you leave the box. */
export function NoteField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return <textarea className="tl-note-input" rows={3} value={text} placeholder={placeholder} aria-label="Note"
    onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== value && onSave(text.trim())} />;
}
