import type { ReactNode } from "react";
import { Link, PAGES, type PagePath } from "../lib/router";

/** The frame of a section's own page: a wide cover with the title, then the page's content. */
export function PageShell({ path, actions, children }: { path: PagePath; actions?: ReactNode; children: ReactNode }) {
  const page = PAGES.find(p => p.path === path)!;
  return (
    <div className="page">
      <header className={`glass page-head`}>
        <div className={`cover page-cover ${page.cover}`}>
          <div className="page-title">
            <Link to="/" className="back">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
              Home
            </Link>
            <h1>{page.label}</h1>
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function EmptyPage({ path }: { path: PagePath }) {
  const page = PAGES.find(p => p.path === path)!;
  return (
    <PageShell path={path}>
      <section className="glass page-empty">
        <img className="mascot lg" src="/mascot.svg" alt="" />
        <h2>{page.label} gets its own page soon</h2>
        <p className="sub">This page is a blank canvas for now. Everything you've added still shows on the {page.label} card on the home page.</p>
        <Link to="/" className="btn primary">Back to home</Link>
      </section>
    </PageShell>
  );
}
