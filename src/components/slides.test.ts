import { describe, expect, it } from "vitest";
import { clampFrame, coverScale, frameStyle, minZoom } from "./Slides";

describe("photo framing", () => {
  it("keeps zoom between half and four times, and the photo near its frame", () => {
    expect(clampFrame({ x: 0, y: 0, z: 9 }).z).toBe(4);
    expect(clampFrame({ x: 0, y: 0, z: 0.1 }).z).toBe(0.5);
    expect(clampFrame({ x: 0, y: 0, z: 0.1 }, 0.3).z).toBe(0.3);
    expect(clampFrame({ x: 500, y: -500, z: 1 })).toEqual({ x: 90, y: -90, z: 1 });
  });
  it("scales a whole photo up to fill the frame, times the zoom", () => {
    expect(frameStyle({ x: 10, y: -5, z: 1.5 }, 2)).toEqual({ transform: "translate(10%, -5%) scale(3)" });
    expect(frameStyle(undefined, 1.25)).toEqual({ transform: "translate(0%, 0%) scale(1.25)" });
  });

  it("works out how much a wide photo must grow to fill a tall frame, and how far out to zoom to see it all", () => {
    // A 3:4 frame and a 4:3 photo: contained it fits the width, so it must grow 16/9 to fill the height.
    expect(coverScale(300, 400, 1600, 1200)).toBeCloseTo(16 / 9);
    expect(coverScale(300, 400, 600, 800)).toBe(1);
    expect(minZoom(16 / 9)).toBe(0.5);
    expect(minZoom(3)).toBeCloseTo(1 / 3);
    expect(minZoom(10)).toBe(0.25);
  });
});
