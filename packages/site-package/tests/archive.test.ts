import { describe, expect, it } from "vitest";
import {
  assertArchiveEntries,
  checksumsFor,
  isPdf,
  isSafeMediaPath,
  parseChecksums,
  validateArchivePath,
  verifyChecksums,
} from "../src";

const encoder = new TextEncoder();

describe("archive safety", () => {
  it("accepts normal paths", () => {
    expect(validateArchivePath("media/files/a.webp")).toBe("media/files/a.webp");
    expect(validateArchivePath("site.json")).toBe("site.json");
  });

  it.each([
    "/absolute",
    "\\absolute",
    "../escape",
    "a/../../escape",
    "a\\b",
    "a//b",
    "a/./b",
    "C:/windows",
    "a\u0000b",
  ])("rejects %s", (path) => {
    expect(() => validateArchivePath(path)).toThrow();
  });

  it("rejects duplicate and oversized entries", () => {
    expect(() =>
      assertArchiveEntries([
        { path: "a.json", bytes: encoder.encode("{}") },
        { path: "A.json", bytes: encoder.encode("{}") },
      ]),
    ).toThrow();
  });

  it("round-trips checksums", () => {
    const entries = [
      { path: "site.json", bytes: encoder.encode("{}") },
      { path: "media/index.json", bytes: encoder.encode("[]") },
    ];
    const text = checksumsFor(entries);
    expect(parseChecksums(text).size).toBe(2);
    expect(() => verifyChecksums(entries, text)).not.toThrow();
    expect(() =>
      verifyChecksums([{ path: "site.json", bytes: encoder.encode("[]") }], text),
    ).toThrow();
  });

  it("checks media paths and PDFs", () => {
    expect(isSafeMediaPath("media/files/a.webp")).toBe(true);
    expect(isSafeMediaPath("media/files/../a.webp")).toBe(false);
    expect(isPdf(encoder.encode("%PDF-1.7"))).toBe(true);
    expect(isPdf(encoder.encode("<html>"))).toBe(false);
  });
});
