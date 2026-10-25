import { useCallback, useEffect, useRef, useState } from "react";
import { connect, disconnect, fetchEvents, googleClientId, hasToken, wasConnected, type GoogleEvent } from "./google";

export type GoogleStatus =
  | "unavailable" // no client ID configured
  | "off"         // never connected on this device
  | "paused"      // connected before, but the hour-long token has run out: needs one click
  | "loading"
  | "on";

export interface GoogleCalendar {
  status: GoogleStatus;
  events: GoogleEvent[];
  error: string | null;
  connect(): Promise<void>;
  disconnect(): void;
}

const REFRESH_MS = 10 * 60_000;

const initialStatus = (): GoogleStatus =>
  !googleClientId ? "unavailable" : hasToken() ? "on" : wasConnected() ? "paused" : "off";

/** Google Calendar events between two local days ("YYYY-MM-DD", end exclusive), reloaded when the range changes. */
export function useGoogleCalendar(from: string, to: string): GoogleCalendar {
  const [status, setStatus] = useState<GoogleStatus>(initialStatus);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const range = useRef({ from, to });
  range.current = { from, to };

  const load = useCallback(async () => {
    const { from, to } = range.current;
    try {
      const evs = await fetchEvents(from, to);
      if (range.current.from !== from || range.current.to !== to) return; // a newer range is loading
      setEvents(evs);
      setStatus("on");
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.message === "expired") setStatus("paused");
      else { setError(e instanceof Error ? e.message : "Couldn't load Google Calendar."); setStatus(hasToken() ? "on" : "paused"); }
    }
  }, []);

  const doConnect = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      await connect();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in didn't finish.");
      setStatus(wasConnected() ? "paused" : "off");
    }
  }, [load]);

  const doDisconnect = useCallback(() => {
    disconnect();
    setEvents([]);
    setError(null);
    setStatus("off");
  }, []);

  // Load whenever connected and the range changes; refresh while the page is open.
  useEffect(() => {
    if (status !== "on") return;
    load();
  }, [status, from, to, load]);

  useEffect(() => {
    if (status !== "on") return;
    const id = window.setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [status, load]);

  return { status, events, error, connect: doConnect, disconnect: doDisconnect };
}
