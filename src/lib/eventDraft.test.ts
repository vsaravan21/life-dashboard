import { describe, expect, it } from "vitest";
import { applyRecurrence, buildEventBody, buildRecurrence, newDraft, problem, seriesDraft, shift, timeRange } from "./eventDraft";

const draft = () => newDraft("2026-10-25", "primary", new Date(2026, 9, 24, 12));

describe("event drafts", () => {
  it("starts new events at 9:00 for an hour on other days", () => {
    expect(draft()).toMatchObject({ date: "2026-10-25", time: "09:00", endDate: "2026-10-25", endTime: "10:00" });
  });

  it("shifts across midnight", () => {
    expect(shift("2026-10-25", "23:30", 60)).toEqual({ date: "2026-10-26", time: "00:30" });
  });

  it("builds timed and all-day bodies, clearing the other kind of time", () => {
    const timed = buildEventBody({ ...draft(), title: "Run" }, { series: true, hadMeet: false });
    expect(timed.start).toMatchObject({ date: null, dateTime: "2026-10-25T09:00:00" });
    expect(timed.recurrence).toEqual([]);
    const allDay = buildEventBody({ ...draft(), allDay: true, endDate: "2026-10-27" }, { series: false, hadMeet: false });
    expect(allDay.start).toMatchObject({ date: "2026-10-25", dateTime: null });
    expect(allDay.end?.date).toBe("2026-10-28"); // Google's end day is exclusive
    expect(allDay.recurrence).toBeUndefined();
  });

  it("writes and reads repeat rules", () => {
    const d = { ...draft(), repeat: "weekly" as const, interval: 2, days: ["TU", "MO"], ends: "after" as const, count: 6 };
    const rule = buildRecurrence(d);
    expect(rule).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU;COUNT=6"]);
    expect(applyRecurrence(draft(), rule, "2026-10-25")).toMatchObject({ repeat: "weekly", interval: 2, days: ["MO", "TU"], ends: "after", count: 6 });
    expect(applyRecurrence(draft(), ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"], "2026-10-26").repeat).toBe("weekdays");
    const odd = applyRecurrence(draft(), ["RRULE:FREQ=MONTHLY;BYDAY=2TU", "EXDATE:20261110"], "2026-10-13");
    expect(odd.repeat).toBe("custom");
    expect(buildRecurrence(odd)).toEqual(["RRULE:FREQ=MONTHLY;BYDAY=2TU", "EXDATE:20261110"]);
  });

  it("moves a whole series by the days one occurrence moved", () => {
    const original = { ...draft(), date: "2026-10-27", endDate: "2026-10-27" };
    const edited = { ...original, date: "2026-10-28", endDate: "2026-10-28", time: "10:00", endTime: "11:30" };
    expect(seriesDraft(edited, original, { id: "s", start: { date: "2026-09-01" } }))
      .toMatchObject({ date: "2026-09-02", endDate: "2026-09-02", time: "10:00", endTime: "11:30" });
  });

  it("catches events that end before they start", () => {
    expect(problem({ ...draft(), endTime: "08:00" })).toMatch(/ends before/);
    expect(problem({ ...draft(), guests: "friend@example.com, nope" })).toMatch(/nope/);
    expect(problem(draft())).toBeNull();
  });

  it("formats time ranges", () => {
    expect(timeRange({ date: "2026-10-25", time: "09:30", endDate: "2026-10-25", endTime: "10:45" })).toBe("09:30 – 10:45");
    expect(timeRange({ date: "2026-10-25", time: "", allDay: true, endDate: "2026-10-25" })).toBe("All day");
  });
});
