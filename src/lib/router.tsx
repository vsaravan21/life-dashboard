import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/** Every page in the app. `panel` is the id of the section's card on the home page. */
export const PAGES = [
  { path: "/calendar", panel: "p-events", label: "Calendar", cover: "c-events" },
  { path: "/todo", panel: "p-todos", label: "To-do", cover: "c-todos" },
  { path: "/finance", panel: "p-money", label: "Finance", cover: "c-money" },
  { path: "/goals", panel: "p-goals", label: "Goals", cover: "c-goals" },
  { path: "/looking-back", panel: "p-lookback", label: "Looking Back", cover: "c-journal" },
  { path: "/travel", panel: "p-trips", label: "Travel", cover: "c-trips" },
  { path: "/reading", panel: "p-books", label: "Reading", cover: "c-books" },
  { path: "/achievements", panel: "p-wins", label: "Achievements", cover: "c-wins" },
  { path: "/journal", panel: "p-journal", label: "Photo journal", cover: "c-journal" },
  { path: "/notes", panel: "p-notes", label: "Notes", cover: "c-notes" },
] as const;

export type PagePath = "/" | (typeof PAGES)[number]["path"];

export const pageForPanel = (panel: string) => PAGES.find(p => p.panel === panel);

const current = (): PagePath => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return (PAGES.some(p => p.path === path) ? path : "/") as PagePath;
};

export function navigate(path: PagePath) {
  if (path !== current()) window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

/** The page named by the address bar; unknown addresses show the home page. */
export function useRoute(): PagePath {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onPop = () => setPath(current());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

/** An in-app link: a real <a> (so it can be opened in a new tab) that navigates without reloading. */
export function Link({ to, className, children, ...rest }: { to: PagePath; className?: string; children: ReactNode; "aria-label"?: string; title?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>;
}
