import { useEffect, useState, type ReactNode } from "react";

const SECTIONS: { id: string; label: string; icon: ReactNode }[] = [
  { id: "top", label: "Overview", icon: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></> },
  { id: "p-events", label: "Calendar", icon: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: "p-todos", label: "To-do", icon: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12.2 2.4 2.3 4.6-4.8" /></> },
  { id: "p-money", label: "Finance", icon: <><rect x="3.5" y="6" width="17" height="13" rx="3" /><path d="M3.5 10h17M15.5 14.5h2" /></> },
  { id: "p-goals", label: "Goals", icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></> },
  { id: "p-trips", label: "Travel", icon: <><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></> },
  { id: "p-books", label: "Reading", icon: <><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5Z" /><path d="M12 6v13" /></> },
  { id: "p-wins", label: "Achievements", icon: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8Z" /> },
  { id: "p-journal", label: "Photo journal", icon: <><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></> },
  { id: "p-notes", label: "Notes", icon: <><path d="M6 3.5h8.5L19 8v12.5H6Z" /><path d="M14 3.5V8h5M9 12h7M9 15.5h7M9 19h4" /></> },
];

/** Highlights the section nearest the top of the screen. */
function useActiveSection() {
  const [active, setActive] = useState("top");
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 80) return setActive("top");
      let best = "top", bestTop = -Infinity;
      for (const s of SECTIONS.slice(1)) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.35 && top > bestTop) { bestTop = top; best = s.id; }
      }
      setActive(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return active;
}

export function Nav({ onSignOut }: { onSignOut?: () => void }) {
  const active = useActiveSection();
  const go = (id: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <aside className="side glass">
      <div className="brand"><div className="orb" /><b>My Life</b></div>
      <div className="label">Sections</div>
      <nav className="sections" aria-label="Sections">
        {SECTIONS.map(s => (
          <button key={s.id} className={active === s.id ? "on" : ""} onClick={() => go(s.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg><span>{s.label}</span>
          </button>
        ))}
      </nav>
      {onSignOut && <button className="btn sm signout" onClick={onSignOut}>Sign out</button>}
    </aside>
  );
}
