import { describe, expect, it } from "vitest";
import { handle, type Env } from "./_core";

const env: Env = {
  PLAID_CLIENT_ID: "cid", PLAID_SECRET: "sec", PLAID_ENV: "sandbox",
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", FINANCE_EMAILS: "me@example.com",
};
const rows = [{ id: "row1", user_id: "u1", item_id: "item1", access_token: "access-secret", institution_name: "Betterment", created_at: "2026-10-25" }];

/** A fake network: Supabase auth, the plaid_items table, and Plaid. */
function fakeFetch(email = "me@example.com", calls: string[] = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.endsWith("/auth/v1/user"))
      return (init?.headers as Record<string, string>).Authorization === "Bearer good"
        ? ok({ id: "u1", email, email_confirmed_at: "2026-01-01" }) : new Response("{}", { status: 401 });
    if (url.includes("/rest/v1/plaid_items")) return init?.method === "GET" || !init?.method ? ok(rows) : new Response(null, { status: 201 });
    if (url.endsWith("/link/token/create")) return ok({ link_token: "link-sandbox-1" });
    if (url.endsWith("/accounts/get"))
      return ok({ accounts: [{ account_id: "a1", name: "Investing", type: "investment", subtype: "brokerage", balances: { current: 1234.5, available: null, iso_currency_code: "USD" } }] });
    if (url.endsWith("/transactions/get"))
      return new Response(JSON.stringify({ error_code: "PRODUCT_NOT_READY", error_message: "not ready" }), { status: 400 });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}
const req = (body: unknown, token = "good") =>
  new Request("https://site/api/finance", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

describe("finance server", () => {
  it("says what's missing when not configured", async () => {
    const res = await handle(req({ action: "summary" }), {}, fakeFetch());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/PLAID_CLIENT_ID/);
  });

  it("refuses signed-out requests and emails not on the list", async () => {
    expect((await handle(req({ action: "summary" }, "bad"), env, fakeFetch())).status).toBe(401);
    expect((await handle(req({ action: "summary" }), env, fakeFetch("stranger@example.com"))).status).toBe(403);
  });

  it("returns balances without ever including the access token", async () => {
    const res = await handle(req({ action: "summary" }), env, fakeFetch());
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("access-secret");
    expect(JSON.parse(text).banks[0]).toMatchObject({ institution: "Betterment", accounts: [{ name: "Investing", current: 1234.5 }] });
  });

  it("reports banks whose transactions aren't ready yet", async () => {
    const body = await (await handle(req({ action: "transactions" }), env, fakeFetch())).json();
    expect(body).toEqual({ transactions: [], notReady: ["Betterment"] });
  });

  it("creates link tokens for the signed-in user", async () => {
    const calls: string[] = [];
    const body = await (await handle(req({ action: "link_token" }), env, fakeFetch(undefined, calls))).json();
    expect(body.linkToken).toBe("link-sandbox-1");
    expect(calls.some(c => c.startsWith("POST https://sandbox.plaid.com/link/token/create"))).toBe(true);
  });
});
