/**
 * Google Calendar access from the browser, using Google Identity Services. No
 * server is involved: the user grants a short-lived access token (about an
 * hour) and the app reads and edits their calendars with it directly.
 */

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

const WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const SCOPE = `https://www.googleapis.com/auth/calendar.readonly ${WRITE_SCOPE}`;
const API = "https://www.googleapis.com/calendar/v3";
const CONNECTED_KEY = "life-dashboard:google-connected";
/** Bumped when SCOPE grows, so the next connect asks Google for the new permission. */
const SCOPE_VERSION = "2";

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  color?: string;
  primary: boolean;
  /** The user can add and change events on it. */
  writable: boolean;
}

export interface GoogleEvent {
  id: string;
  calendarId: string;
  title: string;
  /** Local day, "YYYY-MM-DD". */
  date: string;
  /** "HH:MM", or "" for all-day events. */
  time: string;
  /** Last local day the event covers (inclusive), and its end time ("" for all-day). */
  endDate: string;
  endTime: string;
  allDay: boolean;
  calendar: string;
  color?: string;
  colorId?: string;
  link?: string;
  location?: string;
  description?: string;
  /** Set on one occurrence of a repeating event: the id of the series. */
  recurringEventId?: string;
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  transparency?: "opaque" | "transparent";
  visibility?: string;
  attendees?: string[];
  meetLink?: string;
  canEdit: boolean;
}

/** Google's fixed event colors, by colorId. */
export const EVENT_COLORS: Record<string, { name: string; hex: string }> = {
  "1": { name: "Lavender", hex: "#7986cb" }, "2": { name: "Sage", hex: "#33b679" }, "3": { name: "Grape", hex: "#8e24aa" },
  "4": { name: "Flamingo", hex: "#e67c73" }, "5": { name: "Banana", hex: "#f6bf26" }, "6": { name: "Tangerine", hex: "#f4511e" },
  "7": { name: "Peacock", hex: "#039be5" }, "8": { name: "Graphite", hex: "#616161" }, "9": { name: "Blueberry", hex: "#3f51b5" },
  "10": { name: "Basil", hex: "#0b8043" }, "11": { name: "Tomato", hex: "#d50000" },
};

interface TokenResponse { access_token?: string; expires_in?: number; scope?: string; error?: string }
interface TokenClient { requestAccessToken(opts?: { prompt?: string }): void }
interface GoogleAccounts {
  oauth2: {
    initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): TokenClient;
    revoke(token: string, done?: () => void): void;
  };
}
declare global { interface Window { google?: { accounts: GoogleAccounts } } }

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("Couldn't reach Google. Check your connection and try again.")); };
    document.head.append(s);
  });
  return scriptPromise;
}

let token: { value: string; expires: number; canWrite: boolean } | null = null;

const stored = () => {
  try { return localStorage.getItem(CONNECTED_KEY); } catch { return null; }
};
export const wasConnected = () => !!stored();
const remember = (on: boolean) => {
  try { on ? localStorage.setItem(CONNECTED_KEY, SCOPE_VERSION) : localStorage.removeItem(CONNECTED_KEY); } catch { /* storage blocked */ }
};

/** Ask Google for an access token. Must run from a click, since it may open a popup. */
export async function connect(): Promise<void> {
  if (!googleClientId) throw new Error("Google Calendar isn't set up yet: add VITE_GOOGLE_CLIENT_ID (see README).");
  await loadScript();
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      callback: r => {
        if (!r.access_token) return reject(new Error(r.error === "access_denied" ? "Google Calendar access wasn't allowed." : "Google sign-in didn't finish."));
        token = {
          value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000,
          canWrite: (r.scope ?? SCOPE).split(" ").includes(WRITE_SCOPE),
        };
        remember(true);
        resolve();
      },
      error_callback: e => reject(new Error(e.type === "popup_closed" ? "The Google window was closed before finishing." : "Google sign-in didn't finish.")),
    });
    client.requestAccessToken({ prompt: stored() === SCOPE_VERSION ? "" : "consent" });
  });
}

export const hasToken = () => !!token && token.expires > Date.now();
/** Whether the user let the app change events (they can untick that box on Google's screen). */
export const canWrite = () => hasToken() && token!.canWrite;

export function disconnect() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.value);
  token = null;
  remember(false);
}

async function call<T>(method: string, path: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  if (!hasToken()) throw new Error("expired");
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    method,
    headers: { Authorization: `Bearer ${token!.value}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { token = null; throw new Error("expired"); }
  if (!res.ok && !(method === "DELETE" && res.status === 410)) throw new Error(await explain(res));
  return (res.status === 204 || method === "DELETE" ? undefined : res.json()) as Promise<T>;
}
const get = <T,>(path: string, params?: Record<string, string>) => call<T>("GET", path, params);

/** Turn a Calendar API error into a message that says what to fix. */
async function explain(res: Response): Promise<string> {
  let reason = "";
  try {
    const body = await res.json() as { error?: { errors?: { reason?: string }[]; status?: string } };
    reason = body.error?.errors?.[0]?.reason || body.error?.status || "";
  } catch { /* not JSON */ }
  if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED")
    return "The Google Calendar API is turned off for this Google Cloud project. Enable it, then tap Sync.";
  if (reason === "insufficientPermissions" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || reason === "PERMISSION_DENIED")
    return "Google didn't grant calendar access. Disconnect, connect again, and tick both calendar permissions.";
  if (reason === "forbidden" || reason === "requiredAccessLevel")
    return "You can't change events on that calendar.";
  return `Google Calendar returned an error (${res.status}${reason ? `: ${reason}` : ""}).`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayBefore = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return localDay(new Date(y, m - 1, d - 1));
};

/** Convert one API event into the dashboard's shape, in the viewer's time zone. */
export function toGoogleEvent(e: ApiEvent, cal: string | Pick<GoogleCalendarInfo, "id" | "summary" | "color" | "writable">, color?: string): GoogleEvent | null {
  const c = typeof cal === "string" ? { id: "", summary: cal, color, writable: false } : cal;
  if (e.status === "cancelled") return null;
  const base = {
    id: e.id, calendarId: c.id, title: e.summary || "(No title)", calendar: c.summary, link: e.htmlLink,
    color: (e.colorId && EVENT_COLORS[e.colorId]?.hex) || c.color, colorId: e.colorId,
    location: e.location, description: e.description, recurringEventId: e.recurringEventId,
    reminders: e.reminders, transparency: e.transparency, visibility: e.visibility,
    attendees: e.attendees?.filter(a => !a.self && !a.resource).map(a => a.email),
    meetLink: e.hangoutLink,
    // Only the organizer's copy can be edited freely; others' invites are read-only here.
    canEdit: c.writable && (e.organizer?.self !== false || e.guestsCanModify === true),
  };
  if (e.start?.date) {
    const endDate = e.end?.date ? dayBefore(e.end.date) : e.start.date;
    return { ...base, allDay: true, date: e.start.date, time: "", endDate: endDate < e.start.date ? e.start.date : endDate, endTime: "" };
  }
  if (!e.start?.dateTime) return null;
  const s = new Date(e.start.dateTime), en = e.end?.dateTime ? new Date(e.end.dateTime) : s;
  return { ...base, allDay: false, date: localDay(s), time: localTime(s), endDate: localDay(en), endTime: localTime(en) };
}

export interface ApiEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  colorId?: string;
  recurringEventId?: string;
  recurrence?: string[];
  transparency?: "opaque" | "transparent";
  visibility?: string;
  guestsCanModify?: boolean;
  organizer?: { self?: boolean };
  attendees?: { email: string; self?: boolean; resource?: boolean }[];
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}
interface ApiCalendar { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; selected?: boolean; hidden?: boolean; primary?: boolean; accessRole?: string }

/** Every calendar shown in the user's Google Calendar. */
export async function fetchCalendars(): Promise<GoogleCalendarInfo[]> {
  const { items } = await get<{ items: ApiCalendar[] }>("/users/me/calendarList", { minAccessRole: "reader" });
  return items.filter(c => c.selected !== false && !c.hidden).map(c => ({
    id: c.id, summary: c.summaryOverride || c.summary, color: c.backgroundColor, primary: !!c.primary,
    writable: c.accessRole === "owner" || c.accessRole === "writer",
  }));
}

/** Events from the given calendars, between two local days ("YYYY-MM-DD", end exclusive). */
export async function fetchEvents(from: string, to: string, calendars?: GoogleCalendarInfo[]): Promise<GoogleEvent[]> {
  const [fy, fm, fd] = from.split("-").map(Number), [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd), end = new Date(ty, tm - 1, td);
  const cals = calendars ?? await fetchCalendars();
  const lists = await Promise.all(cals.map(async c => {
    const { items } = await get<{ items: ApiEvent[] }>(`/calendars/${encodeURIComponent(c.id)}/events`, {
      timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "1000",
    });
    return items.map(e => toGoogleEvent(e, c)).filter((e): e is GoogleEvent => !!e);
  }));
  return lists.flat();
}

const eventPath = (calendarId: string, id?: string) =>
  `/calendars/${encodeURIComponent(calendarId)}/events${id ? `/${encodeURIComponent(id)}` : ""}`;

/** One event as Google stores it (used to read a repeating event's series). */
export const getEvent = (calendarId: string, id: string) => get<ApiEvent>(eventPath(calendarId, id));

/** Fields the dashboard sends when saving; see buildEventBody in eventDraft.ts. */
type When = { date?: string | null; dateTime?: string | null; timeZone?: string | null };
/** null clears a field when patching. */
export type EventBody = Partial<Omit<ApiEvent, "id" | "attendees" | "start" | "end" | "colorId">> & {
  start?: When;
  end?: When;
  colorId?: string | null;
  attendees?: { email: string }[];
  conferenceData?: { createRequest: { requestId: string; conferenceSolutionKey: { type: string } } };
};

const writeParams = (body: EventBody, notifyGuests: boolean) => ({
  sendUpdates: notifyGuests ? "all" : "none",
  ...(body.conferenceData ? { conferenceDataVersion: "1" } : {}),
});

export const insertEvent = (calendarId: string, body: EventBody, notifyGuests = false) =>
  call<ApiEvent>("POST", eventPath(calendarId), writeParams(body, notifyGuests), body);

export const patchEvent = (calendarId: string, id: string, body: EventBody, notifyGuests = false) =>
  call<ApiEvent>("PATCH", eventPath(calendarId, id), writeParams(body, notifyGuests), body);

export const deleteEvent = (calendarId: string, id: string, notifyGuests = false) =>
  call<void>("DELETE", eventPath(calendarId, id), { sendUpdates: notifyGuests ? "all" : "none" });
