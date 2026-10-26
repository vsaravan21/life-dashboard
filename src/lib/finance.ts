/**
 * The browser side of Finance: its own sign-in (separate from the rest of the
 * dashboard, which stays open) and calls to the server in api/finance.ts.
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sign-in for Finance only. It keeps its session under its own key so it never mixes with other sign-ins. */
export const financeAuth: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, { auth: { storageKey: "life-dashboard:finance-auth", detectSessionInUrl: true } })
  : null;

/** The Finance session: undefined while checking, null when signed out. */
export function useFinanceSession() {
  const [session, setSession] = useState<Session | null | undefined>(financeAuth ? undefined : null);
  useEffect(() => {
    if (!financeAuth) return;
    financeAuth.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = financeAuth.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function sendSignInLink(email: string) {
  const { error } = await financeAuth!.auth.signInWithOtp({
    email, options: { emailRedirectTo: `${window.location.origin}/finance` },
  });
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await financeAuth!.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === "Invalid login credentials"
    ? "That email and password don't match. If you haven't set a password yet, use the email link once, then tap Set password."
    : error.message);
}

/** Set or change the password for the signed-in Finance user. */
export async function setFinancePassword(password: string) {
  const { error } = await financeAuth!.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export const signOutOfFinance = () => financeAuth?.auth.signOut();

export interface Account {
  id: string; name: string; officialName: string | null; mask: string | null; type: string; subtype: string | null;
  current: number | null; available: number | null; currency: string;
}
export interface Bank {
  id: string; institution: string; connectedAt: string; accounts: Account[];
  problem: { reconnect: boolean; message: string } | null;
}
export interface Transaction {
  id: string; date: string; name: string; amount: number; currency: string; pending: boolean;
  category: string | null; account: string; institution: string;
}

export class FinanceError extends Error {
  constructor(message: string, public code: string | null) { super(message); }
}

/** Call the Finance server as the signed-in user. */
export async function financeApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await financeAuth!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FinanceError("Sign in to see Finance.", "signed_out");
  const res = await fetch("/api/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...body }),
  });
  const out = await res.json().catch(() => ({ error: `The Finance server didn't answer (${res.status}).` }));
  if (!res.ok) throw new FinanceError(out.error || "Something went wrong.", out.code ?? null);
  return out as T;
}

/** Credit cards and loans count against net worth. */
export const isDebt = (a: Account) => a.type === "credit" || a.type === "loan";

export function netWorth(banks: Bank[]) {
  let assets = 0, debts = 0;
  for (const b of banks) for (const a of b.accounts) {
    const v = a.current ?? 0;
    if (isDebt(a)) debts += Math.abs(v); else assets += v;
  }
  return { assets, debts, net: assets - debts };
}

interface PlaidHandler { open(): void; destroy(): void }
declare global {
  interface Window {
    Plaid?: { create(cfg: {
      token: string;
      onSuccess(publicToken: string, metadata: { institution?: { name?: string } | null }): void;
      onExit?(err: { display_message?: string | null; error_message?: string } | null): void;
    }): PlaidHandler };
  }
}

let plaidScript: Promise<void> | null = null;
function loadPlaid() {
  plaidScript ??= new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    s.onload = () => resolve();
    s.onerror = () => { plaidScript = null; reject(new Error("Couldn't load Plaid. Check your connection.")); };
    document.head.append(s);
  });
  return plaidScript;
}

/**
 * Open Plaid's window to connect a bank (or, with a bank id, to sign in to it
 * again). Resolves true when something changed, false if the window was closed.
 */
export async function openPlaid(bankId?: string): Promise<boolean> {
  const [{ linkToken }] = await Promise.all([financeApi<{ linkToken: string }>("link_token", bankId ? { id: bankId } : {}), loadPlaid()]);
  return new Promise((resolve, reject) => {
    const handler = window.Plaid!.create({
      token: linkToken,
      onSuccess: async (publicToken, metadata) => {
        handler.destroy();
        try {
          if (!bankId) await financeApi("exchange", { publicToken, institution: metadata.institution?.name ?? "" });
          resolve(true);
        } catch (e) { reject(e); }
      },
      onExit: err => {
        handler.destroy();
        if (err) reject(new Error(err.display_message || err.error_message || "Plaid closed with an error."));
        else resolve(false);
      },
    });
    handler.open();
  });
}
