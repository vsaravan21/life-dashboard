/**
 * The Finance server: everything that touches Plaid or bank connections.
 *
 * It runs as a Vercel Function, so Plaid's secret and each bank's access token
 * never reach the browser. Every request must carry a Supabase session for an
 * email listed in FINANCE_EMAILS. Bank connections live in the `plaid_items`
 * table, which only this server (with the service-role key) can read.
 */

export interface Env {
  PLAID_CLIENT_ID?: string;
  PLAID_SECRET?: string;
  /** "sandbox" or "production". */
  PLAID_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Comma-separated emails allowed to use Finance. */
  FINANCE_EMAILS?: string;
}

type Fetch = typeof fetch;

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function config(env: Env) {
  const missing = (["PLAID_CLIENT_ID", "PLAID_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FINANCE_EMAILS"] as const).filter(k => !env[k]);
  if (missing.length) throw new HttpError(503, `Finance isn't set up yet. Missing in Vercel: ${missing.join(", ")}.`, "not_configured");
  const plaidEnv = env.PLAID_ENV === "production" ? "production" : "sandbox";
  return {
    plaidUrl: `https://${plaidEnv}.plaid.com`,
    plaidEnv,
    clientId: env.PLAID_CLIENT_ID!, secret: env.PLAID_SECRET!,
    supabaseUrl: env.SUPABASE_URL!.replace(/\/+$/, ""), serviceKey: env.SUPABASE_SERVICE_ROLE_KEY!,
    allowed: env.FINANCE_EMAILS!.split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
  };
}
type Config = ReturnType<typeof config>;

/** The signed-in Supabase user, if their email may use Finance. */
async function requireUser(request: Request, c: Config, f: Fetch) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new HttpError(401, "Sign in to see Finance.", "signed_out");
  const res = await f(`${c.supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: c.serviceKey } });
  if (!res.ok) throw new HttpError(401, "Your sign-in has expired. Sign in again.", "signed_out");
  const user = await res.json() as { id: string; email?: string; email_confirmed_at?: string | null };
  if (!user.email || !user.email_confirmed_at || !c.allowed.includes(user.email.toLowerCase()))
    throw new HttpError(403, "This email isn't allowed to see Finance.", "not_allowed");
  return user;
}

async function plaid<T>(c: Config, f: Fetch, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await f(`${c.plaidUrl}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: c.clientId, secret: c.secret, ...body }),
  });
  const data = await res.json() as T & { error_code?: string; error_message?: string; display_message?: string | null };
  if (!res.ok) throw new HttpError(502, data.display_message || data.error_message || "Plaid returned an error.", data.error_code);
  return data;
}

interface ItemRow { id: string; user_id: string; item_id: string; access_token: string; institution_name: string | null; created_at: string }

/** PostgREST call as the server (service role), always scoped to one user. */
async function db<T>(c: Config, f: Fetch, method: string, query: string, body?: unknown): Promise<T> {
  const res = await f(`${c.supabaseUrl}/rest/v1/plaid_items?${query}`, {
    method,
    headers: {
      apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}`, "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=minimal,resolution=merge-duplicates" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new HttpError(500, `Couldn't reach the bank list (${res.status}). Did you run the plaid_items SQL in Supabase?`, "db");
  return (method === "GET" ? res.json() : []) as Promise<T>;
}
const itemsOf = (c: Config, f: Fetch, userId: string) =>
  db<ItemRow[]>(c, f, "GET", `user_id=eq.${encodeURIComponent(userId)}&order=created_at`);

interface PlaidAccount {
  account_id: string; name: string; official_name?: string | null; mask?: string | null; type: string; subtype?: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code?: string | null; unofficial_currency_code?: string | null };
}
interface PlaidTransaction {
  transaction_id: string; account_id: string; name: string; merchant_name?: string | null; amount: number; date: string; pending: boolean;
  iso_currency_code?: string | null; personal_finance_category?: { primary?: string } | null; category?: string[] | null;
}

const toAccount = (a: PlaidAccount) => ({
  id: a.account_id, name: a.name, officialName: a.official_name ?? null, mask: a.mask ?? null, type: a.type, subtype: a.subtype ?? null,
  current: a.balances.current, available: a.balances.available,
  currency: a.balances.iso_currency_code || a.balances.unofficial_currency_code || "USD",
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const NEEDS_RECONNECT = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT", "ACCESS_NOT_GRANTED"]);

/** Handle one Finance request. `action` picks what to do; nothing here ever returns an access token. */
export async function handle(request: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  try {
    if (request.method !== "POST") throw new HttpError(405, "Use POST.");
    const c = config(env);
    const user = await requireUser(request, c, f);
    const body = await request.json().catch(() => ({})) as { action?: string; publicToken?: string; institution?: string; id?: string; days?: number };

    switch (body.action) {
      case "link_token": {
        // With an id, open Link in update mode to repair a connection that needs signing in again.
        const item = body.id ? (await itemsOf(c, f, user.id)).find(i => i.id === body.id) : undefined;
        if (body.id && !item) throw new HttpError(404, "That bank isn't connected.");
        const r = await plaid<{ link_token: string }>(c, f, "/link/token/create", {
          user: { client_user_id: user.id }, client_name: "My Life", language: "en", country_codes: ["US", "CA"],
          ...(item ? { access_token: item.access_token } : {
            products: ["transactions"], additional_consented_products: ["investments"], transactions: { days_requested: 90 },
          }),
        });
        return json({ linkToken: r.link_token, environment: c.plaidEnv });
      }

      case "exchange": {
        if (!body.publicToken) throw new HttpError(400, "Missing the token from Plaid.");
        const r = await plaid<{ access_token: string; item_id: string }>(c, f, "/item/public_token/exchange", { public_token: body.publicToken });
        await db(c, f, "POST", "on_conflict=item_id", {
          user_id: user.id, item_id: r.item_id, access_token: r.access_token, institution_name: (body.institution || "").slice(0, 120) || null,
        });
        return json({ ok: true });
      }

      case "summary": {
        const items = await itemsOf(c, f, user.id);
        const banks = await Promise.all(items.map(async i => {
          try {
            const r = await plaid<{ accounts: PlaidAccount[] }>(c, f, "/accounts/get", { access_token: i.access_token });
            return { id: i.id, institution: i.institution_name || "Bank", connectedAt: i.created_at, accounts: r.accounts.map(toAccount), problem: null };
          } catch (e) {
            const code = e instanceof HttpError ? e.code : undefined;
            return {
              id: i.id, institution: i.institution_name || "Bank", connectedAt: i.created_at, accounts: [],
              problem: { reconnect: !!code && NEEDS_RECONNECT.has(code), message: e instanceof Error ? e.message : "Couldn't load this bank." },
            };
          }
        }));
        return json({ banks, environment: c.plaidEnv });
      }

      case "transactions": {
        const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
        const end = new Date(), start = new Date(end.getTime() - days * 86_400_000);
        const items = await itemsOf(c, f, user.id);
        const notReady: string[] = [];
        const lists = await Promise.all(items.map(async i => {
          try {
            const r = await plaid<{ transactions: PlaidTransaction[]; accounts: PlaidAccount[] }>(c, f, "/transactions/get", {
              access_token: i.access_token, start_date: iso(start), end_date: iso(end), options: { count: 250 },
            });
            const names = new Map(r.accounts.map(a => [a.account_id, a.name]));
            return r.transactions.map(t => ({
              id: t.transaction_id, date: t.date, name: t.merchant_name || t.name,
              // Plaid counts money leaving the account as positive; flip it so spending is negative.
              amount: -t.amount, currency: t.iso_currency_code || "USD", pending: t.pending,
              category: t.personal_finance_category?.primary?.replace(/_/g, " ").toLowerCase() ?? t.category?.[0] ?? null,
              account: names.get(t.account_id) ?? "", institution: i.institution_name || "Bank",
            }));
          } catch (e) {
            if (e instanceof HttpError && e.code === "PRODUCT_NOT_READY") { notReady.push(i.institution_name || "A bank"); return []; }
            if (e instanceof HttpError && (e.code === "PRODUCTS_NOT_SUPPORTED" || e.code === "NO_ACCOUNTS")) return [];
            throw e;
          }
        }));
        const transactions = lists.flat().sort((a, b) => b.date.localeCompare(a.date));
        return json({ transactions, notReady });
      }

      case "remove": {
        const item = (await itemsOf(c, f, user.id)).find(i => i.id === body.id);
        if (!item) throw new HttpError(404, "That bank isn't connected.");
        await plaid(c, f, "/item/remove", { access_token: item.access_token }).catch(() => { /* already gone at Plaid */ });
        await db(c, f, "DELETE", `id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`);
        return json({ ok: true });
      }

      default:
        throw new HttpError(400, "Unknown action.");
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code ?? null }, e.status);
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
