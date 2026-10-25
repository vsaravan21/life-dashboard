import { describe, expect, it } from "vitest";
import { toGoogleEvent } from "./google";

describe("toGoogleEvent", () => {
  it("keeps all-day events on their date with no time", () => {
    expect(toGoogleEvent({ id: "a", summary: "Holiday", start: { date: "2026-10-30" }, end: { date: "2026-10-31" } }, "Personal"))
      .toMatchObject({ date: "2026-10-30", endDate: "2026-10-30", allDay: true, time: "", title: "Holiday", calendar: "Personal" });
  });

  it("converts timed events to the local day and time", () => {
    const start = new Date(2026, 9, 27, 9, 30);
    expect(toGoogleEvent({ id: "b", summary: "Dentist", start: { dateTime: start.toISOString() } }, "Personal"))
      .toMatchObject({ date: "2026-10-27", time: "09:30" });
  });

  it("drops cancelled events and names untitled ones", () => {
    expect(toGoogleEvent({ id: "c", status: "cancelled", start: { date: "2026-10-30" } }, "x")).toBeNull();
    expect(toGoogleEvent({ id: "d", start: { date: "2026-10-30" } }, "x")?.title).toBe("(No title)");
  });
});
