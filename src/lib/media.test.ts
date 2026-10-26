import { describe, expect, it } from "vitest";
import { extFor, isVideoRef } from "./media";

describe("media refs", () => {
  it("names files by type and tells videos apart", () => {
    expect(extFor("video/quicktime")).toBe("mov");
    expect(extFor("image/jpeg")).toBe("jpg");
    expect(extFor("")).toBe("jpg");
    expect(isVideoRef("u1/abc.mov")).toBe(true);
    expect(isVideoRef("idb:abc.mp4")).toBe(true);
    expect(isVideoRef("idb:abc")).toBe(false);
    expect(isVideoRef("u1/abc.jpg")).toBe(false);
  });
});
