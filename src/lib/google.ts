/**
 * Read-only Google Calendar access from the browser, using Google Identity
 * Services. No server is involved: the user grants a short-lived access token
 * (about an hour) and the app reads their calendars with it directly.
 */

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";
const CONNECTED_KEY = "life-dashboard:google-connected";

export interface GoogleEvent {
  id: string;
  title: string;
  /** Local day, "YYYY-MM-DD". */
  date: string;
  /** "HH:MM", or "" for all-day events. */
  time: string;
  calendar: string;
  color?: string;
  link?: string;
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
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

let token: { value: string; expires: number } | null = null;

export const wasConnected = () => {
  try { return localStorage.getItem(CONNECTED_KEY) === "1"; } catch { return false; }
};
const remember = (on: boolean) => {
  try { on ? localStorage.setItem(CONNECTED_KEY, "1") : localStorage.removeItem(CONNECTED_KEY); } catch { /* storage blocked */ }
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
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 };
        remember(true);
        resolve();
      },
      error_callback: e => reject(new Error(e.type === "popup_closed" ? "The Google window was closed before finishing." : "Google sign-in didn't finish.")),
    });
    client.requestAccessToken({ prompt: wasConnected() ? "" : "consent" });
  });
}

export const hasToken = () => !!token && token.expires > Date.now();

export function disconnect() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.value);
  token = null;
  remember(false);
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasToken()) throw new Error("expired");
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token!.value}` } });
  if (res.status === 401) { token = null; throw new Error("expired"); }
  if (!res.ok) throw new Error(await explain(res));
  return res.json() as Promise<T>;
}

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
    return "Google didn't grant calendar access. Disconnect, connect again, and tick the calendar permission.";
  return `Google Calendar returned an error (${res.status}${reason ? `: ${reason}` : ""}).`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Convert one API event into the dashboard's shape, in the viewer's time zone. */
export function toGoogleEvent(e: ApiEvent, calendar: string, color?: string): GoogleEvent | null {
  if (e.status === "cancelled") return null;
  if (e.start?.date) return { id: e.id, title: e.summary || "(No title)", date: e.start.date, time: "", calendar, color, link: e.htmlLink };
  if (!e.start?.dateTime) return null;
  const d = new Date(e.start.dateTime);
  return {
    id: e.id, title: e.summary || "(No title)", calendar, color, link: e.htmlLink,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export interface ApiEvent {
  id: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
}
interface ApiCalendar { id: string; summary: string; backgroundColor?: string; selected?: boolean; hidden?: boolean }

/** Events from every calendar shown in the user's Google Calendar, between two local days ("YYYY-MM-DD", end exclusive). */
export async function fetchEvents(from: string, to: string): Promise<GoogleEvent[]> {
  const [fy, fm, fd] = from.split("-").map(Number), [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd), end = new Date(ty, tm - 1, td);
  const { items: cals } = await get<{ items: ApiCalendar[] }>("/users/me/calendarList", { minAccessRole: "reader" });
  const shown = cals.filter(c => c.selected !== false && !c.hidden);
  const lists = await Promise.all(shown.map(async c => {
    const { items } = await get<{ items: ApiEvent[] }>(`/calendars/${encodeURIComponent(c.id)}/events`, {
      timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "1000",
    });
    return items.map(e => toGoogleEvent(e, c.summary, c.backgroundColor)).filter((e): e is GoogleEvent => !!e);
  }));
  return lists.flat();
}
