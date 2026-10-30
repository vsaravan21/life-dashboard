import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudStore } from "./store";

/** A stand-in for Supabase storage that counts how often links are signed. */
function fakeClient(fail = false) {
  const calls: string[][] = [];
  const bucket = {
    async createSignedUrls(paths: string[]) {
      calls.push(paths);
      if (fail) return { data: null, error: new Error("offline") };
      return { data: paths.map(p => ({ path: p, signedUrl: `https://cdn/${p}?t=${calls.length}`, error: null })), error: null };
    },
  };
  return { client: { storage: { from: () => bucket } } as unknown as SupabaseClient, calls };
}

describe("cloud photo links", () => {
  it("signs photos asked for together in one request, then reuses the links", async () => {
    const { client, calls } = fakeClient();
    const store = cloudStore(client, "u1");
    const urls = await Promise.all(["u1/a.jpg", "u1/b.jpg", "u1/a.jpg"].map(r => store.photoUrl(r)));
    expect(calls).toEqual([["u1/a.jpg", "u1/b.jpg"]]);
    expect(urls).toEqual(["https://cdn/u1/a.jpg?t=1", "https://cdn/u1/b.jpg?t=1", "https://cdn/u1/a.jpg?t=1"]);
    expect(await store.photoUrl("u1/a.jpg")).toBe("https://cdn/u1/a.jpg?t=1");
    expect(calls).toHaveLength(1);
  });

  it("gets a new link when asked for a fresh one", async () => {
    const { client, calls } = fakeClient();
    const store = cloudStore(client, "u1");
    await store.photoUrl("u1/a.jpg");
    expect(await store.photoUrl("u1/a.jpg", true)).toBe("https://cdn/u1/a.jpg?t=2");
    expect(calls).toHaveLength(2);
  });

  it("answers no link when signing fails, instead of hanging", async () => {
    const { client } = fakeClient(true);
    expect(await cloudStore(client, "u1").photoUrl("u1/a.jpg")).toBeNull();
  });
});
