import type { ReactNode } from "react";
import { Link, type PagePath } from "../lib/router";

const SECTIONS: { path: PagePath; label: string; icon: ReactNode }[] = [
  { path: "/", label: "Overview", icon: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></> },
  { path: "/calendar", label: "Calendar", icon: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { path: "/todo", label: "To-do", icon: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12.2 2.4 2.3 4.6-4.8" /></> },
  { path: "/finance", label: "Finance", icon: <><rect x="3.5" y="6" width="17" height="13" rx="3" /><path d="M3.5 10h17M15.5 14.5h2" /></> },
  { path: "/goals", label: "Goals", icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></> },
  { path: "/looking-back", label: "Looking Back", icon: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9M12 8v4.2l2.8 1.8" /></> },
  { path: "/travel", label: "Travel", icon: <><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></> },
  { path: "/reading", label: "Reading", icon: <><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5Z" /><path d="M12 6v13" /></> },
  { path: "/journal", label: "Photo journal", icon: <><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></> },
  { path: "/notes", label: "Notes", icon: <><path d="M6 3.5h8.5L19 8v12.5H6Z" /><path d="M14 3.5V8h5M9 12h7M9 15.5h7M9 19h4" /></> },
];

export function Nav({ route, onSignOut }: { route: PagePath; onSignOut?: () => void }) {
  return (
    <aside className="side glass">
      <Link to="/" className="brand"><img className="mascot" src="/mascot.svg" alt="" /><b>My Life</b></Link>
      <div className="label">Sections</div>
      <nav className="sections" aria-label="Sections">
        {SECTIONS.map(s => (
          <Link key={s.path} to={s.path} className={route === s.path ? "on" : ""} aria-label={s.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg><span>{s.label}</span>
          </Link>
        ))}
      </nav>
      {onSignOut && <button className="btn sm signout" onClick={onSignOut}>Sign out</button>}
    </aside>
  );
}
