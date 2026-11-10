import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Reorder a list by dragging a handle. Items swap places live as the pointer passes their middle,
 * along whichever way they're laid out (a row or a column), and slide into their new spots.
 * Arrow keys on a focused handle move it one place.
 */
export function useDragOrder<T extends string>(order: T[], setOrder: (next: T[]) => void) {
  const els = useRef(new Map<T, HTMLElement>());
  const latest = useRef(order);
  latest.current = order;
  const before = useRef<Map<T, DOMRect> | null>(null);
  const [dragging, setDragging] = useState<T | null>(null);

  const commit = (next: T[]) => {
    if (next.join() === latest.current.join()) return;
    before.current = new Map([...els.current].map(([id, el]) => [id, el.getBoundingClientRect()]));
    latest.current = next;
    setOrder(next);
  };

  // Slide each item from where it was to where it is now.
  useLayoutEffect(() => {
    const old = before.current;
    before.current = null;
    if (!old) return;
    for (const [id, el] of els.current) {
      const a = old.get(id);
      if (!a) continue;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }, [order]);

  const moveTo = (id: T, x: number, y: number) => {
    const others = latest.current.filter(o => o !== id);
    const rects = others.map(o => els.current.get(o)!.getBoundingClientRect());
    const sideways = rects.length > 0 && rects.every(r => Math.abs(r.top - rects[0].top) < 4);
    let idx = 0;
    for (const r of rects) if (sideways ? x > r.left + r.width / 2 : y > r.top + r.height / 2) idx++;
    const next = [...others];
    next.splice(idx, 0, id);
    commit(next);
  };

  const item = (id: T) => ({
    ref: (el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); },
    "data-dragging": dragging === id || undefined,
  });

  const handle = (id: T) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(id);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (dragging !== id) return;
      moveTo(id, e.clientX, e.clientY);
      // Scroll the page when dragging near the top or bottom edge.
      if (e.clientY < 70) window.scrollBy(0, -14);
      else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    },
    onPointerUp() { setDragging(null); },
    onPointerCancel() { setDragging(null); },
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const step = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      const list = [...latest.current];
      const i = list.indexOf(id), j = i + step;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      commit(list);
    },
  });

  return { item, handle, dragging };
}

/** Keep a saved order only if it holds exactly the expected ids; otherwise fall back. */
export function validOrder<T extends string>(saved: unknown, ids: readonly T[]): T[] {
  return Array.isArray(saved) && saved.length === ids.length && ids.every(id => saved.includes(id)) ? (saved as T[]) : [...ids];
}
