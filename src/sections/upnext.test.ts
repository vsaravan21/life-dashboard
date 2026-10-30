import { describe, expect, it } from "vitest";
import type { Entry } from "../lib/types";
import { countdown, upcoming } from "./UpNext";

const trip = (id: string, data: object) => ({ id, kind: "upnext", data: { place: id, color: "mint", ...data }, createdAt: id }) as Entry<"upnext">;

describe("Up next", () => {
  it("puts dated trips soonest first, then dreams, and drops trips that are over", () => {
    const list = upcoming([
      trip("europe", { when: "Summer 2027" }),
      trip("ny", { start: "2026-12-20", end: "2026-12-27" }),
      trip("tokyo", { start: "2026-11-05" }),
      trip("past", { start: "2026-09-01", end: "2026-09-05" }),
      trip("now", { start: "2026-10-28", end: "2026-11-02" }),
    ], "2026-10-30");
    expect(list.map(t => t.id)).toEqual(["now", "tokyo", "ny", "europe"]);
  });

  it("counts down in days, says Now while you're there, and shows roughly when for a dream", () => {
    expect(countdown({ place: "NY", color: "", start: "2026-12-20" }, "2026-10-30")).toEqual({ big: "51", small: "days to go" });
    expect(countdown({ place: "NY", color: "", start: "2026-10-31" }, "2026-10-30")).toEqual({ big: "1", small: "day to go" });
    expect(countdown({ place: "NY", color: "", start: "2026-10-29", end: "2026-11-02" }, "2026-10-30").big).toBe("Now");
    expect(countdown({ place: "Europe", color: "", when: "Summer 2027" })).toEqual({ big: "Summer 2027", small: "dreaming" });
    expect(countdown({ place: "Europe", color: "" }).big).toBe("Someday");
  });
});
