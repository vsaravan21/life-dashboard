import { useState, type ReactNode } from "react";
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
const ROW_NAMES: Record<Row, string> = { upnext: "Up next", trio: "Calendar, To-do and Looking Back", journal: "Photo journal" };
const CARD_NAMES: Record<Card, string> = { calendar: "Calendar", todos: "To-do", lookback: "Looking Back" };

/** The order you arranged, kept in this browser. */
function loadLayout(): { rows: Row[]; cards: Card[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { rows: validOrder(saved.rows, ROWS), cards: validOrder(saved.cards, CARDS) };
  } catch { return { rows: [...ROWS], cards: [...CARDS] }; }
}

const Grip = ({ label, className, ...rest }: { label: string; className: string } & Record<string, unknown>) => (
  <button type="button" className={"grip " + className} aria-label={label} title="Drag to move" {...rest}>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
      {[9, 15].flatMap(y => [6, 12, 18].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />))}
    </svg>
  </button>
);

/** The home page: sections you can drag up and down, and a row of three cards you can shuffle. */
export function Home({ dash, notify }: { dash: Dashboard; notify: (m: string) => void }) {
  const [layout, setLayout] = useState(loadLayout);
  const save = (next: typeof layout) => {
    setLayout(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* still works for this visit */ }
  };
  const rows = useDragOrder(layout.rows, r => save({ ...layout, rows: r }));
  const cards = useDragOrder(layout.cards, c => save({ ...layout, cards: c }));

  const card: Record<Card, ReactNode> = {
    calendar: <Calendar dash={dash} />,
    todos: <Todos dash={dash} />,
    lookback: <LookingBack dash={dash} />,
  };
  const row: Record<Row, ReactNode> = {
    upnext: <UpNext dash={dash} notify={notify} />,
    journal: <Journal dash={dash} notify={notify} />,
    trio: (
      <div className="home-trio">
        {layout.cards.map(c => (
          <div key={c} className="home-card" {...cards.item(c)}>
            <Grip className="card-grip" label={`Move ${CARD_NAMES[c]} left or right`} {...cards.handle(c)} />
            {card[c]}
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div className="home-rows">
      {layout.rows.map(r => (
        <div key={r} className="home-row" {...rows.item(r)}>
          <Grip className="row-grip" label={`Move ${ROW_NAMES[r]} up or down`} {...rows.handle(r)} />
          {row[r]}
        </div>
      ))}
    </div>
  );
}
