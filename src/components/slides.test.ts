import { describe, expect, it } from "vitest";
import { clampFrame, frameStyle } from "./Slides";

describe("photo framing", () => {
  it("keeps zoom between half and four times, and the photo near its frame", () => {
    expect(clampFrame({ x: 0, y: 0, z: 9 }).z).toBe(4);
    expect(clampFrame({ x: 0, y: 0, z: 0.1 }).z).toBe(0.5);
    expect(clampFrame({ x: 500, y: -500, z: 1 })).toEqual({ x: 90, y: -90, z: 1 });
  });
  it("turns a framing into a transform, and none into nothing", () => {
    expect(frameStyle({ x: 10, y: -5, z: 1.5 })).toEqual({ transform: "translate(10%, -5%) scale(1.5)" });
    expect(frameStyle(undefined)).toBeUndefined();
  });
});
