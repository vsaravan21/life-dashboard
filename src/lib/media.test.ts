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

  it("keeps a document's own extension", () => {
    expect(extFor("application/pdf", "Budget Plan.PDF")).toBe("pdf");
    expect(extFor("", "notes.final.docx")).toBe("docx");
    expect(extFor("application/octet-stream", "README")).toBe("bin");
    expect(extFor("image/png", "x.png")).toBe("png");
  });
});
