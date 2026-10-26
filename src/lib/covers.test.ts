import { describe, expect, it } from "vitest";
import { findCover, NO_COVER } from "./covers";

const reply = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

describe("findCover", () => {
  it("uses the first result that has a cover", async () => {
    expect(await findCover("Atomic Habits", "James Clear", reply({ docs: [{}, { cover_i: 42 }] }))).toBe("https://covers.openlibrary.org/b/id/42-L.jpg");
  });
  it("says none when nothing has a cover", async () => {
    expect(await findCover("Nothing", undefined, reply({ docs: [] }))).toBe(NO_COVER);
  });
});
