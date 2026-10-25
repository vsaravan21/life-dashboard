import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  DAY_CODES, LOCAL, REMINDER_CHOICES, applyRecurrence, buildEventBody, draftFromGoogle, draftFromLocal, guestList,
  minutesBetween, newDraft, problem, reminderLabel, seriesDraft, shift, toLocal, type Draft, type Repeat,
} from "../lib/eventDraft";
import { iso, parse } from "../lib/dates";
import { EVENT_COLORS, deleteEvent, getEvent, insertEvent, patchEvent, type ApiEvent, type GoogleEvent } from "../lib/google";
import type { Entry } from "../lib/types";
import type { Dashboard } from "../lib/useDashboard";
import type { GoogleCalendar } from "../lib/useGoogleCalendar";

export type EditTarget =
  | { kind: "new"; date: string }
  | { kind: "local"; entry: Entry<"events"> }
  | { kind: "google"; event: GoogleEvent };

const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

const dayName = (code: string, style: "long" | "short") =>
  new Date(2026, 0, 4 + DAY_CODES.indexOf(code as (typeof DAY_CODES)[number])).toLocaleDateString(undefined, { weekday: style });

function repeatLabels(date: string, days: string[]): Record<Exclude<Repeat, "custom">, string> {
  const d = parse(date);
  const on = DAY_CODES.filter(c => days.includes(c));
  return {
    none: "Does not repeat",
    daily: "Daily",
    weekly: on.length > 1 ? `Weekly on ${on.map(c => dayName(c, "short")).join(", ")}` : `Weekly on ${d.toLocaleDateString(undefined, { weekday: "long" })}`,
    weekdays: "Every weekday (Mon–Fri)",
    monthly: `Monthly on the ${ordinal(d.getDate())}`,
    yearly: `Yearly on ${d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`,
  };
}

const unit = (r: Repeat, n: number) => {
  const w = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[r as "daily"] ?? "";
  return n === 1 ? w : `${w}s`;
};

function duration(d: Draft) {
  if (d.allDay) {
    const n = Math.round((parse(d.endDate).getTime() - parse(d.date).getTime()) / 86_400_000) + 1;
    return n === 1 ? "" : `${n} days`;
  }
  const m = minutesBetween({ date: d.date, time: d.time }, { date: d.endDate, time: d.endTime });
  if (m <= 0) return "";
  const h = Math.floor(m / 60), r = m % 60;
  return [h && `${h} hr`, r && `${r} min`].filter(Boolean).join(" ");
}

const Row = ({ icon, children, label }: { icon: ReactNode; children: ReactNode; label: string }) => (
  <div className="ev-row">
    <span className="ev-icon" title={label} aria-hidden="true">{icon}</span>
    <div className="ev-field">{children}</div>
  </div>
);

const I = {
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  repeat: <svg viewBox="0 0 24 24"><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" /></svg>,
  cal: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  pin: <svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>,
  people: <svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14a5.5 5.5 0 0 1 3 5" /></svg>,
  video: <svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="m15.5 10.5 5.5-3v9l-5.5-3" /></svg>,
  bell: <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5h4" /></svg>,
  text: <svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h16M4 16h10" /></svg>,
  color: <svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6h2.1a4 4 0 0 0 4-4C20.5 6.9 16.7 3.5 12 3.5Z" /><circle cx="7.8" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="7.8" r="1" /></svg>,
  lock: <svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>,
};

/** Full event editor in a dialog: creates, edits and deletes dashboard and Google Calendar events. */
export function EventEditor({ target, dash, g, onClose }: { target: EditTarget; dash: Dashboard; g: GoogleCalendar; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const writable = g.canWrite ? g.calendars.filter(c => c.writable) : [];
  const defaultCal = (writable.find(c => c.primary) ?? writable[0])?.id ?? LOCAL;

  const [original] = useState<Draft>(() =>
    target.kind === "new" ? newDraft(target.date, defaultCal)
      : target.kind === "local" ? draftFromLocal(target.entry.data)
        : draftFromGoogle(target.event));
  const [d, setD] = useState<Draft>(original);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ev = target.kind === "google" ? target.event : null;
  const recurring = !!ev?.recurringEventId;
  const [scope, setScope] = useState<"this" | "all">("this");
  const [series, setSeries] = useState<ApiEvent | null>(null);
  const readOnly = !!ev && !ev.canEdit;
  const needsPermission = !!ev && ev.canEdit && !g.canWrite;
  const google = d.calendarId !== LOCAL;
  const showRepeat = google && (!recurring || scope === "all");

  useEffect(() => {
    const dlg = ref.current!;
    if (!dlg.open) dlg.showModal();
    return () => dlg.close();
  }, []);

  // Editing a whole series shows its repeat rule, which only the series itself carries.
  useEffect(() => {
    if (!ev?.recurringEventId || scope !== "all" || series) return;
    getEvent(ev.calendarId, ev.recurringEventId).then(s => {
      setSeries(s);
      const first = s.start?.date ?? (s.start?.dateTime ? iso(new Date(s.start.dateTime)) : ev.date);
      setD(cur => applyRecurrence(cur, s.recurrence, first));
    }).catch(e => setError(e instanceof Error && e.message !== "expired" ? e.message : "Couldn't load the repeating event. Tap Sync and try again."));
  }, [ev, scope, series]);

  const set = (patch: Partial<Draft>) => { setError(null); setD(cur => ({ ...cur, ...patch })); };

  // Moving the start keeps the event's length, the way Google Calendar does.
  const setStart = (date: string, time: string) => setD(cur => {
    setError(null);
    if (cur.allDay) {
      const span = Math.round((parse(cur.endDate).getTime() - parse(cur.date).getTime()) / 86_400_000);
      const end = shift(date, "00:00", span * 1440);
      return { ...cur, date, endDate: end.date };
    }
    const len = Math.max(0, minutesBetween({ date: cur.date, time: cur.time }, { date: cur.endDate, time: cur.endTime }));
    const end = shift(date, time, len);
    return { ...cur, date, time, endDate: end.date, endTime: end.time };
  });

  const finish = async () => { if (google || ev) await g.reload(); onClose(); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const issue = problem(d);
    if (issue) return setError(issue);
    setBusy(true);
    setError(null);
    try {
      if (!google) {
        if (target.kind === "local") await dash.patch(target.entry, toLocal(d));
        else await dash.add("events", toLocal(d));
        return onClose();
      }
      const notify = guestList(d.guests).length > 0;
      if (ev) {
        if (recurring && scope === "all") {
          if (!series) return setError("Still loading the repeating event…");
          await patchEvent(ev.calendarId, ev.recurringEventId!, buildEventBody(seriesDraft(d, original, series), { series: true, hadMeet: !!ev.meetLink }), notify);
        } else {
          await patchEvent(ev.calendarId, ev.id, buildEventBody(d, { series: !recurring, hadMeet: !!ev.meetLink }), notify);
        }
      } else {
        await insertEvent(d.calendarId, buildEventBody(d, { series: true, hadMeet: false }), notify);
        if (target.kind === "local") await dash.remove(target.entry); // moved into Google
      }
      await finish();
    } catch (err) {
      setError(err instanceof Error && err.message === "expired"
        ? "Your Google session ran out. Tap Sync Google Calendar, then save again."
        : err instanceof Error ? err.message : "Couldn't save the event.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      if (target.kind === "local") { await dash.remove(target.entry); return onClose(); }
      if (ev) {
        await deleteEvent(ev.calendarId, recurring && scope === "all" ? ev.recurringEventId! : ev.id, (ev.attendees?.length ?? 0) > 0);
        await finish();
      }
    } catch (err) {
      setError(err instanceof Error && err.message !== "expired" ? err.message : "Couldn't delete the event. Tap Sync and try again.");
      setBusy(false);
    }
  };

  const labels = repeatLabels(d.date, d.days);
  const len = duration(d);
  const calChoices = ev
    ? [{ id: ev.calendarId, summary: ev.calendar }]
    : [...writable.map(c => ({ id: c.id, summary: c.summary })), { id: LOCAL, summary: "Dashboard only (not in Google)" }];
  const title = target.kind === "new" ? "New event" : readOnly ? "Event" : "Edit event";

  return (
    <dialog ref={ref} className="glass ev-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <form className="ev-form" onSubmit={save}>
        <div className="ev-head">
          <span className="label">{title}</span>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <input className="ev-title" value={d.title} placeholder="Add title" aria-label="Title" autoFocus={!ev}
          disabled={readOnly} onChange={e => set({ title: e.target.value })} />

        {needsPermission && (
          <div className="notice ev-notice">
            <span>To change Google events here, let the dashboard edit your calendar.</span>
            <button type="button" className="btn sm primary" onClick={g.connect}>Allow editing</button>
          </div>
        )}
        {readOnly && <p className="sub">You were invited to this event, so only its organizer can change it.</p>}

        {recurring && !readOnly && (
          <div className="seg" role="radiogroup" aria-label="Which events to change">
            {(["this", "all"] as const).map(s => (
              <button type="button" key={s} role="radio" aria-checked={scope === s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>
                {s === "this" ? "This event" : "All events in the series"}
              </button>
            ))}
          </div>
        )}

        <fieldset className="ev-body" disabled={readOnly || busy}>
          <Row icon={I.clock} label="When">
            <div className="ev-when">
              <span className="ev-lbl">Starts</span>
              <span className="ev-pair">
                <input type="date" value={d.date} required aria-label="Start date" onChange={e => e.target.value && setStart(e.target.value, d.time)} />
                {!d.allDay && <input type="time" value={d.time} required aria-label="Start time" onChange={e => e.target.value && setStart(d.date, e.target.value)} />}
              </span>
              <span className="ev-lbl">Ends</span>
              <span className="ev-pair">
                <input type="date" value={d.endDate} min={d.date} required aria-label="End date" onChange={e => e.target.value && set({ endDate: e.target.value })} />
                {!d.allDay && <input type="time" value={d.endTime} required aria-label="End time" onChange={e => e.target.value && set({ endTime: e.target.value })} />}
              </span>
            </div>
            <div className="ev-inline">
              <label className="ev-check"><input type="checkbox" checked={d.allDay} onChange={e => set({ allDay: e.target.checked })} /> All day</label>
              {len && <span className="meta">{len}</span>}
              <span className="meta">{Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}</span>
            </div>
          </Row>

          {showRepeat && (
            <Row icon={I.repeat} label="Repeat">
              <select value={d.repeat} aria-label="Repeat" onChange={e => set({ repeat: e.target.value as Repeat })}>
                {Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                {d.customRule && <option value="custom">Custom (as set in Google)</option>}
              </select>
              {d.repeat !== "none" && d.repeat !== "custom" && (
                <div className="ev-repeat">
                  {d.repeat !== "weekdays" && (
                    <label className="ev-inline">Every
                      <input type="number" min={1} max={99} value={d.interval} aria-label="Repeat every" className="num"
                        onChange={e => set({ interval: Math.max(1, Number(e.target.value) || 1) })} />
                      {unit(d.repeat, d.interval)}
                    </label>
                  )}
                  {d.repeat === "weekly" && (
                    <div className="ev-days" role="group" aria-label="Repeat on">
                      {DAY_CODES.map(c => {
                        const on = d.days.includes(c);
                        const name = dayName(c, "long");
                        return (
                          <button type="button" key={c} aria-pressed={on} aria-label={name} className={on ? "on" : ""}
                            onClick={() => set({ days: on ? d.days.filter(x => x !== c) : [...d.days, c] })}>{name[0]}</button>
                        );
                      })}
                    </div>
                  )}
                  <div className="ev-inline">
                    <span>Ends</span>
                    <select value={d.ends} aria-label="Repeat ends" onChange={e => set({ ends: e.target.value as Draft["ends"] })}>
                      <option value="never">Never</option>
                      <option value="on">On date</option>
                      <option value="after">After</option>
                    </select>
                    {d.ends === "on" && <input type="date" value={d.until} min={d.date} aria-label="Last day" onChange={e => set({ until: e.target.value })} />}
                    {d.ends === "after" && <><input type="number" className="num" min={1} max={730} value={d.count} aria-label="Occurrences"
                      onChange={e => set({ count: Math.max(1, Number(e.target.value) || 1) })} /> times</>}
                  </div>
                </div>
              )}
            </Row>
          )}
          {recurring && scope === "this" && <p className="sub ev-hint">Changes apply to this one event. Pick All events to change the repeat.</p>}

          <Row icon={I.cal} label="Calendar">
            <select value={d.calendarId} aria-label="Calendar" disabled={!!ev} onChange={e => set({ calendarId: e.target.value })}>
              {calChoices.map(c => <option key={c.id} value={c.id}>{c.summary}</option>)}
            </select>
            {!google && (g.status === "on"
              ? !g.canWrite && <p className="sub">To save to Google, <button type="button" className="linkish" onClick={g.connect}>let the dashboard edit your calendar</button>.</p>
              : g.status !== "unavailable" && <p className="sub">Connect Google Calendar to save events there, with repeats, guests and reminders.</p>)}
          </Row>

          <Row icon={I.pin} label="Location">
            <input value={d.location} placeholder="Add location" aria-label="Location" onChange={e => set({ location: e.target.value })} />
          </Row>

          {google && (
            <>
              <Row icon={I.people} label="Guests">
                <input value={d.guests} placeholder="Add guests by email" aria-label="Guests" inputMode="email"
                  onChange={e => set({ guests: e.target.value })} />
                {guestList(d.guests).length > 0 && <p className="sub">Guests get an email from Google Calendar when you save.</p>}
              </Row>
              <Row icon={I.video} label="Video call">
                {ev?.meetLink
                  ? <a className="btn sm" href={ev.meetLink} target="_blank" rel="noreferrer">Join Google Meet</a>
                  : <label className="ev-check"><input type="checkbox" checked={d.meet} onChange={e => set({ meet: e.target.checked })} /> Add a Google Meet link</label>}
              </Row>
              <Row icon={I.bell} label="Notifications">
                <label className="ev-check"><input type="checkbox" checked={d.reminders === "default"}
                  onChange={e => set({ reminders: e.target.checked ? "default" : [d.allDay ? 1440 : 30] })} /> Calendar's default notifications</label>
                {d.reminders !== "default" && (
                  <div className="ev-reminders">
                    {d.reminders.map((m, i) => (
                      <span key={i} className="ev-inline">
                        <select value={m} aria-label="Notify" onChange={e => set({ reminders: (d.reminders as number[]).map((x, j) => j === i ? Number(e.target.value) : x) })}>
                          {[...new Set([...REMINDER_CHOICES, m])].sort((a, b) => a - b).map(c => <option key={c} value={c}>{reminderLabel(c)}</option>)}
                        </select>
                        <button type="button" className="x" aria-label="Remove notification" onClick={() => set({ reminders: (d.reminders as number[]).filter((_, j) => j !== i) })}>×</button>
                      </span>
                    ))}
                    {d.reminders.length < 5 && <button type="button" className="btn sm" onClick={() => set({ reminders: [...(d.reminders as number[]), 10] })}>+ Add notification</button>}
                    {d.reminders.length === 0 && <span className="meta">No notifications</span>}
                  </div>
                )}
              </Row>
              <Row icon={I.color} label="Color">
                <div className="ev-colors" role="radiogroup" aria-label="Event color">
                  <button type="button" role="radio" aria-checked={!d.colorId} title="Calendar color" aria-label="Calendar color"
                    className={"sw" + (!d.colorId ? " on" : "")} style={{ background: g.calendars.find(c => c.id === d.calendarId)?.color || "var(--accent)" }}
                    onClick={() => set({ colorId: "" })} />
                  {Object.entries(EVENT_COLORS).map(([id, c]) => (
                    <button type="button" key={id} role="radio" aria-checked={d.colorId === id} title={c.name} aria-label={c.name}
                      className={"sw" + (d.colorId === id ? " on" : "")} style={{ background: c.hex }} onClick={() => set({ colorId: id })} />
                  ))}
                </div>
              </Row>
              <Row icon={I.lock} label="Availability and visibility">
                <div className="ev-inline">
                  <select value={d.busy ? "busy" : "free"} aria-label="Show as" onChange={e => set({ busy: e.target.value === "busy" })}>
                    <option value="busy">Busy</option>
                    <option value="free">Free</option>
                  </select>
                  <select value={d.visibility} aria-label="Visibility" onChange={e => set({ visibility: e.target.value as Draft["visibility"] })}>
                    <option value="default">Default visibility</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </Row>
            </>
          )}

          <Row icon={I.text} label="Description">
            <textarea value={d.description} placeholder="Add description" aria-label="Description" rows={3}
              onChange={e => set({ description: e.target.value })} />
          </Row>
        </fieldset>

        {error && <p className="err" role="alert">{error}</p>}

        <div className="ev-foot">
          {target.kind !== "new" && !readOnly && !needsPermission && (
            <button type="button" className={"btn" + (confirmDelete ? " danger" : "")} onClick={remove} disabled={busy}>
              {confirmDelete ? (recurring && scope === "all" ? "Delete all events?" : "Delete this event?") : "Delete"}
            </button>
          )}
          {ev?.link && <a className="btn" href={ev.link} target="_blank" rel="noreferrer">Open in Google</a>}
          <span className="grow1" />
          <button type="button" className="btn" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button className="btn primary" disabled={busy || needsPermission}>{busy ? "Saving…" : "Save"}</button>}
        </div>
      </form>
    </dialog>
  );
}
