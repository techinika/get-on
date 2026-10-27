import { describe, expect, it } from "vitest";
import {
  MAX_CONTENT_BYTES,
  SITE_PACKAGE_CONTENT_SCHEMA_VERSION,
  SITE_PACKAGE_FORMAT,
  SITE_PACKAGE_FORMAT_VERSION,
  SitePackageError,
  contentHash,
  parseContentBytes,
  validateDocument,
  validateManifest,
} from "../src";

function document(overrides: Record<string, unknown> = {}) {
  return {
    profile: { name: "Acme", address: "https://acme.get-on.tech" },
    look: { palette: "fresh-green" },
    pages: [
      {
        pageKey: "home",
        title: "Home",
        path: "/",
        position: 0,
        is_homepage: true,
        blocks: [],
      },
    ],
    sharedSections: [],
    search: { title: "Acme", indexing: true },
    redirects: [],
    google: {},
    plugins: ["contact"],
    customNotFound: {},
    templateOrigin: null,
    ...overrides,
  };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    format: SITE_PACKAGE_FORMAT,
    formatVersion: SITE_PACKAGE_FORMAT_VERSION,
    createdAt: "2026-10-27T00:00:00.000Z",
    createdWith: "Get-On",
    kind: "export",
    contentSchemaVersion: SITE_PACKAGE_CONTENT_SCHEMA_VERSION,
    themeVersion: 2,
    source: { name: "Acme", address: "https://acme.get-on.tech" },
    options: { pictures: false, files: false, messages: false },
    counts: { pages: 1 },
    contentHash: "",
    mediaTotalBytes: 0,
    ...overrides,
  };
}

describe("site package content", () => {
  it("parses a bare document", () => {
    const parsed = parseContentBytes(new TextEncoder().encode(JSON.stringify(document())));
    expect(parsed.manifest).toBeNull();
    expect(parsed.document.pages[0]?.pageKey).toBe("home");
    expect(parsed.document.plugins).toEqual(["contact"]);
  });

  it("parses a manifest and document", () => {
    const parsed = parseContentBytes(
      new TextEncoder().encode(JSON.stringify({ manifest: manifest(), document: document() })),
    );
    expect(parsed.manifest?.kind).toBe("export");
    expect(parsed.document.pages).toHaveLength(1);
  });

  it("rejects a newer format", () => {
    expect(() => validateManifest(manifest({ formatVersion: 2 }))).toThrowError(
      expect.objectContaining({ code: "IMPORT_TOO_NEW" }),
    );
    expect(() =>
      validateManifest(manifest({ contentSchemaVersion: SITE_PACKAGE_CONTENT_SCHEMA_VERSION + 1 })),
    ).toThrowError(expect.objectContaining({ code: "IMPORT_TOO_NEW" }));
  });

  it("rejects unknown top-level keys", () => {
    expect(() => validateDocument({ ...document(), secret: "x" })).toThrowError(
      expect.objectContaining({ code: "IMPORT_NOT_VALID" }),
    );
  });

  it("rejects prototype keys", () => {
    const raw = JSON.stringify(document()).replace('"profile":{', '"profile":{"__proto__":{"x":1},');
    expect(() => parseContentBytes(new TextEncoder().encode(raw))).toThrowError(
      expect.objectContaining({ code: "IMPORT_NOT_VALID" }),
    );
  });

  it("rejects too much data", () => {
    expect(() =>
      parseContentBytes(new Uint8Array(MAX_CONTENT_BYTES + 1)),
    ).toThrowError(expect.objectContaining({ code: "IMPORT_TOO_BIG" }));
  });

  it("rejects an unsafe page path", () => {
    expect(() =>
      validateDocument(document({ pages: [{ pageKey: "home", title: "Home", path: "/../x", blocks: [] }] })),
    ).toThrowError(SitePackageError);
  });

  it("is deterministic for hashes", () => {
    expect(contentHash({ b: 2, a: [1, { d: 4, c: 3 }] })).toBe(
      contentHash({ a: [1, { c: 3, d: 4 }], b: 2 }),
    );
  });
});
