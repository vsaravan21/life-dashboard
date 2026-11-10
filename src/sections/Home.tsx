import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Dashboard } from "../lib/useDashboard";
import { useDragOrder, validOrder } from "../lib/useDragOrder";
import { Calendar } from "./Calendar";
import { Journal } from "./Journal";
import { LookingBack } from "./LookingBack";
import { Todos } from "./Todos";
import { UpNext } from "./UpNext";

const ROWS = ["upnext", "trio", "journal"] as const;
const CARDS = ["calendar", "todos", "lookback"] as const;
type Row = (typeof ROWS)[number];
type Card = (typeof CARDS)[number];
const KEY = "life-dashboard:home-layout";

/** The order you arranged, kept in this browser. */
function loadLayout(): { rows: Row[]; cards: Card[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { rows: validOrder(saved.rows, ROWS), cards: validOrder(saved.cards, CARDS) };
  } catch { return { rows: [...ROWS], cards: [...CARDS] }; }
}

const HOLD = 320;
/** Places where pressing should type or pick, not pick up the card. */
const NO_DRAG = "input, textarea, select, [contenteditable], .tl-adjust";

/** The home page: sections you can drag up and down, and a row of three cards you can shuffle. */
export function Home({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const [layout, setLayout] = useState(loadLayout);
  const save = (change: (l: typeof layout) => typeof layout) => setLayout(l => {
    const next = change(l);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* still works for this visit */ }
    return next;
  });
  const rows = useDragOrder(layout.rows, r => save(l => ({ ...l, rows: r })));
  const cards = useDragOrder(layout.cards, c => save(l => ({ ...l, cards: c })));
  const trio = useRef<HTMLDivElement>(null);
  const [holding, setHolding] = useState<string | null>(null);

  /**
   * Press and hold a section (or one of the three cards) to pick it up, then drag. Moving before the
   * hold ends is a normal scroll or text selection. A card dragged well above or below its row takes
   * the whole row with it.
   */
  const press = (e: PointerEvent<HTMLElement>, row: Row, card?: Card) => {
    if (e.button !== 0 || (e.target as Element).closest(NO_DRAG)) return;
    const x0 = e.clientX, y0 = e.clientY, id = e.pointerId;
    let armed: "row" | "card" | null = null;
    setHolding(card ?? row);
    const timer = window.setTimeout(() => {
      armed = card ? "card" : "row";
      setHolding(null);
      if (card) cards.setDragging(card); else rows.setDragging(row);
      navigator.vibrate?.(10);
    }, HOLD);
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (!armed) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) end(); return; }
      ev.preventDefault();
      if (armed === "card" && card) {
        const r = trio.current!.getBoundingClientRect();
        if (ev.clientY < r.top - 50 || ev.clientY > r.bottom + 50) {
          armed = "row";
          cards.setDragging(null);
          rows.setDragging("trio");
        } else cards.moveTo(card, ev.clientX, ev.clientY);
      }
      if (armed === "row") rows.moveTo(card ? "trio" : row, ev.clientX, ev.clientY);
      // Scroll the page when dragging near the top or bottom edge.
      if (ev.clientY < 70) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    };
    // Once picked up, stop the page from scrolling under a finger.
    const noScroll = (ev: TouchEvent) => { if (armed) ev.preventDefault(); };
    const noMenu = (ev: Event) => ev.preventDefault();
    const end = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", noScroll);
      window.removeEventListener("contextmenu", noMenu);
      setHolding(null);
      if (!armed) return;
      rows.setDragging(null);
      cards.setDragging(null);
      // The release shouldn't also count as a click on whatever was under it.
      const eat = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener("click", eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", eat, { capture: true }), 50);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", noScroll, { passive: false });
    window.addEventListener("contextmenu", noMenu);
  };

  const card: Record<Card, ReactNode> = {
    calendar: <Calendar dash={dash} />,
    todos: <Todos dash={dash} />,
    lookback: <LookingBack dash={dash} />,
  };
  const row: Record<Row, ReactNode> = {
    upnext: <UpNext dash={dash} notify={notify} />,
    journal: <Journal dash={dash} notify={notify} />,
    trio: (
      <div className="home-trio" ref={trio}>
        {layout.cards.map(c => (
          <div key={c} className="home-card" {...cards.item(c)} data-holding={holding === c || undefined}
            onPointerDown={e => { e.stopPropagation(); press(e, "trio", c); }}>
            {card[c]}
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div className="home-rows" onDragStart={e => e.preventDefault()}>
      {layout.rows.map(r => (
        <div key={r} className="home-row" {...rows.item(r)} data-holding={holding === r || undefined}
          onPointerDown={e => press(e, r)}>
          {row[r]}
        </div>
      ))}
    </div>
  );
}
