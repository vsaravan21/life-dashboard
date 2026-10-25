/**
 * The event editor's form state, and how it maps to and from Google Calendar
 * events and the dashboard's own events. Kept free of React so it can be tested.
 */
import { addDays, daysBetween, iso, parse } from "./dates";
import type { ApiEvent, EventBody, GoogleEvent } from "./google";
import type { EventData } from "./types";

/** The calendar choice that keeps an event in the dashboard only. */
export const LOCAL = "local";

export type Repeat = "none" | "daily" | "weekly" | "weekdays" | "monthly" | "yearly" | "custom";
export const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR"];

export interface Draft {
  title: string;
  allDay: boolean;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  calendarId: string;
  location: string;
  description: string;
  repeat: Repeat;
  interval: number;
  /** Weekdays for a weekly repeat, as RRULE codes. */
  days: string[];
  ends: "never" | "on" | "after";
  until: string;
  count: number;
  /** An RRULE this editor can't show, kept as it is. */
  customRule: string;
  /** EXDATE/RDATE lines of a series, kept as they are. */
  otherRecurrence: string[];
  /** Minutes before the start, or the calendar's default reminders. */
  reminders: "default" | number[];
  colorId: string;
  busy: boolean;
  visibility: "default" | "public" | "private";
  guests: string;
  meet: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A local day and "HH:MM" moved by some minutes. */
export function shift(date: string, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = parse(date);
  d.setHours(h, m + minutes, 0, 0);
  return { date: iso(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Minutes from one local day and time to another. */
export function minutesBetween(a: { date: string; time: string }, b: { date: string; time: string }) {
  const [ah, am] = (a.time || "00:00").split(":").map(Number), [bh, bm] = (b.time || "00:00").split(":").map(Number);
  return daysBetween(a.date, b.date) * 1440 + (bh * 60 + bm) - (ah * 60 + am);
}

const blank = (date: string): Omit<Draft, "title" | "allDay" | "date" | "time" | "endDate" | "endTime" | "calendarId"> => ({
  location: "", description: "", repeat: "none", interval: 1, days: [DAY_CODES[parse(date).getDay()]],
  ends: "never", until: iso(addDays(parse(date), 90)), count: 10, customRule: "", otherRecurrence: [],
  reminders: "default", colorId: "", busy: true, visibility: "default", guests: "", meet: false,
});

/** A new one-hour event on a day: at the next full hour today, or 9:00 on other days. */
export function newDraft(date: string, calendarId: string, now = new Date()): Draft {
  const time = date === iso(now) ? `${pad(Math.min(now.getHours() + 1, 23))}:00` : "09:00";
  const end = shift(date, time, 60);
  return { ...blank(date), title: "", allDay: false, date, time, endDate: end.date, endTime: end.time, calendarId };
}

export function draftFromLocal(e: EventData): Draft {
  const allDay = e.allDay ?? !e.time;
  const time = e.time || "09:00";
  const end = e.endTime ? { date: e.endDate || e.date, time: e.endTime } : shift(e.date, time, 60);
  return {
    ...blank(e.date), title: e.title, allDay, date: e.date, time, calendarId: LOCAL,
    endDate: e.endDate || (allDay ? e.date : end.date), endTime: end.time,
    location: e.location || "", description: e.description || "",
  };
}

export function draftFromGoogle(e: GoogleEvent): Draft {
  const time = e.time || "09:00";
  const end = e.endTime ? { date: e.endDate, time: e.endTime } : shift(e.date, time, 60);
  return {
    ...blank(e.date), title: e.title === "(No title)" ? "" : e.title, allDay: e.allDay, date: e.date, time,
    endDate: e.allDay ? e.endDate : end.date, endTime: end.time, calendarId: e.calendarId,
    location: e.location || "", description: e.description || "",
    reminders: !e.reminders || e.reminders.useDefault ? "default" : (e.reminders.overrides ?? []).map(r => r.minutes),
    colorId: e.colorId || "", busy: e.transparency !== "transparent",
    visibility: e.visibility === "public" || e.visibility === "private" ? e.visibility : "default",
    guests: (e.attendees ?? []).join(", "), meet: !!e.meetLink,
  };
}

/** Read a series' recurrence lines into the draft's repeat fields. */
export function applyRecurrence(d: Draft, recurrence: string[] | undefined, seriesStart: string): Draft {
  const rule = recurrence?.find(l => l.startsWith("RRULE:"));
  const other = (recurrence ?? []).filter(l => !l.startsWith("RRULE:"));
  if (!rule) return { ...d, repeat: "none", otherRecurrence: other };
  const parts = Object.fromEntries(rule.slice(6).split(";").map(p => p.split("=") as [string, string]));
  const { FREQ, INTERVAL, BYDAY, BYMONTHDAY, UNTIL, COUNT, WKST, ...rest } = parts;
  void WKST;
  const startDay = DAY_CODES[parse(seriesStart).getDay()];
  const days = BYDAY ? BYDAY.split(",") : [startDay];
  const plainDays = days.every(x => (DAY_CODES as readonly string[]).includes(x));
  let repeat: Repeat = "custom";
  if (Object.keys(rest).length === 0) {
    if (FREQ === "DAILY" && !BYDAY && !BYMONTHDAY) repeat = "daily";
    else if (FREQ === "WEEKLY" && plainDays && !BYMONTHDAY)
      repeat = (INTERVAL ?? "1") === "1" && days.length === 5 && WEEKDAYS.every(x => days.includes(x)) ? "weekdays" : "weekly";
    else if (FREQ === "MONTHLY" && !BYDAY && (!BYMONTHDAY || Number(BYMONTHDAY) === parse(seriesStart).getDate())) repeat = "monthly";
    else if (FREQ === "YEARLY" && !BYDAY && !BYMONTHDAY) repeat = "yearly";
  }
  return {
    ...d, repeat, otherRecurrence: other,
    customRule: repeat === "custom" ? rule : "",
    interval: Math.max(1, Number(INTERVAL) || 1),
    days: repeat === "weekly" ? days : d.days,
    ends: UNTIL ? "on" : COUNT ? "after" : "never",
    until: UNTIL ? untilDay(UNTIL) : d.until,
    count: COUNT ? Number(COUNT) : d.count,
  };
}

/** An RRULE UNTIL value ("20261231" or "20261231T075959Z") as a local day. */
function untilDay(v: string) {
  const y = +v.slice(0, 4), m = +v.slice(4, 6), day = +v.slice(6, 8);
  if (!v.includes("T")) return `${y}-${pad(m)}-${pad(day)}`;
  return iso(new Date(Date.UTC(y, m - 1, day, +v.slice(9, 11), +v.slice(11, 13), +v.slice(13, 15))));
}

export function buildRecurrence(d: Draft): string[] {
  if (d.repeat === "none") return [];
  if (d.repeat === "custom") return [d.customRule, ...d.otherRecurrence].filter(Boolean);
  const parts: string[] = [];
  const freq = { daily: "DAILY", weekly: "WEEKLY", weekdays: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" }[d.repeat];
  parts.push(`FREQ=${freq}`);
  if (d.repeat !== "weekdays" && d.interval > 1) parts.push(`INTERVAL=${d.interval}`);
  if (d.repeat === "weekly") {
    const days = d.days.length ? d.days : [DAY_CODES[parse(d.date).getDay()]];
    parts.push(`BYDAY=${DAY_CODES.filter(c => days.includes(c)).join(",")}`);
  }
  if (d.repeat === "weekdays") parts.push(`BYDAY=${WEEKDAYS.join(",")}`);
  if (d.ends === "on" && d.until) {
    if (d.allDay) parts.push(`UNTIL=${d.until.replace(/-/g, "")}`);
    else {
      const endOfDay = parse(d.until);
      endOfDay.setHours(23, 59, 59);
      parts.push(`UNTIL=${endOfDay.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`);
    }
  }
  if (d.ends === "after") parts.push(`COUNT=${Math.max(1, d.count)}`);
  return [`RRULE:${parts.join(";")}`, ...d.otherRecurrence];
}

/** What's wrong with the draft, if anything. */
export function problem(d: Draft): string | null {
  if (!d.date || !d.endDate) return "Pick a start and end date.";
  if (d.allDay ? d.endDate < d.date : minutesBetween({ date: d.date, time: d.time }, { date: d.endDate, time: d.endTime }) < 0)
    return "The event ends before it starts.";
  if (d.repeat === "weekly" && d.days.length === 0) return "Pick at least one day for it to repeat on.";
  if (d.repeat !== "none" && d.ends === "on" && d.until < d.date) return "The repeat ends before the event starts.";
  const bad = guestList(d.guests).find(g => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g));
  if (bad) return `“${bad}” doesn't look like an email address.`;
  return null;
}

export const guestList = (s: string) => s.split(/[\s,;]+/).map(g => g.trim()).filter(Boolean);

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The Google Calendar body for a draft. `series` includes the repeat rule (new
 * events and whole series); a single occurrence of a series leaves it out.
 */
export function buildEventBody(d: Draft, opts: { series: boolean; hadMeet: boolean; requestId?: string }): EventBody {
  const tz = timeZone();
  const body: EventBody = {
    summary: d.title.trim() || "(No title)",
    location: d.location.trim(),
    description: d.description,
    start: d.allDay ? { date: d.date, dateTime: null, timeZone: null } : { date: null, dateTime: `${d.date}T${d.time}:00`, timeZone: tz },
    end: d.allDay ? { date: iso(addDays(parse(d.endDate), 1)), dateTime: null, timeZone: null } : { date: null, dateTime: `${d.endDate}T${d.endTime}:00`, timeZone: tz },
    colorId: d.colorId || null,
    transparency: d.busy ? "opaque" : "transparent",
    visibility: d.visibility,
    reminders: d.reminders === "default"
      ? { useDefault: true }
      : { useDefault: false, overrides: [...new Set(d.reminders)].sort((a, b) => a - b).slice(0, 5).map(minutes => ({ method: "popup", minutes })) },
    attendees: guestList(d.guests).map(email => ({ email })),
  };
  if (opts.series) body.recurrence = buildRecurrence(d);
  if (d.meet && !opts.hadMeet)
    body.conferenceData = { createRequest: { requestId: opts.requestId ?? crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  return body;
}

/**
 * Apply an edit made on one occurrence to the whole series: the series keeps
 * its own first day, moved by however many days the occurrence was moved.
 */
export function seriesDraft(edited: Draft, original: Draft, series: ApiEvent): Draft {
  const first = series.start?.date ?? (series.start?.dateTime ? iso(new Date(series.start.dateTime)) : edited.date);
  const start = iso(addDays(parse(first), daysBetween(original.date, edited.date)));
  const end = iso(addDays(parse(start), daysBetween(edited.date, edited.endDate)));
  return { ...edited, date: start, endDate: end };
}

/** The dashboard-only version of a draft. */
export const toLocal = (d: Draft): EventData => ({
  title: d.title.trim() || "(No title)", date: d.date, time: d.allDay ? "" : d.time,
  allDay: d.allDay, endDate: d.endDate, endTime: d.allDay ? "" : d.endTime,
  location: d.location.trim() || undefined, description: d.description || undefined,
});

/** "9:30 – 10:45", "All day", or a span over several days, for lists. */
export function timeRange(e: { date: string; time?: string; endDate?: string; endTime?: string; allDay?: boolean }) {
  const allDay = e.allDay ?? !e.time;
  const multi = !!e.endDate && e.endDate !== e.date;
  const day = (s: string) => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (allDay) return multi ? `All day · until ${day(e.endDate!)}` : "All day";
  if (!e.endTime) return e.time!;
  return multi ? `${e.time} – ${day(e.endDate!)} ${e.endTime}` : `${e.time} – ${e.endTime}`;
}

export const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
export function reminderLabel(m: number) {
  if (m === 0) return "At start";
  if (m % 10080 === 0) return `${m / 10080} week${m === 10080 ? "" : "s"} before`;
  if (m % 1440 === 0) return `${m / 1440} day${m === 1440 ? "" : "s"} before`;
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? "" : "s"} before`;
  return `${m} minutes before`;
}
