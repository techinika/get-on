import { describe, expect, it } from "vitest";
import { buildContentBytes, buildContentDocument, type PackageSource } from "@/lib/site-package/content";
import { signDownloadToken, verifyDownloadToken } from "@/lib/site-package/token";

function source(): PackageSource {
  return {
    project: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Acme",
      subdomain: "acme",
      primary_host: null,
      settings: {},
    },
    settings: {
      theme: { palette: "fresh-green", fontPair: "friendly", corners: "soft" },
      seo_site_title: "Acme",
      seo_description: "We help",
      seo_title_format: "{page} | {site}",
      search_indexing: true,
      twitter_handle: null,
      verification: {},
      custom_404: {},
    },
    pages: [
      {
        id: "22222222-2222-2222-2222-222222222222",
        title: "Home",
        path: "/",
        position: 0,
        is_homepage: true,
        blocks: [],
        show_in_menu: true,
        is_hidden: false,
        seo_title: null,
        seo_description: null,
        hide_from_search: false,
      },
    ],
    media: [],
    plugins: ["contact"],
    redirects: [],
  };
}

describe("content package", () => {
  it("builds a valid content document and manifest", () => {
    const document = buildContentDocument(source());
    expect(document.pages[0]?.pageKey).toBe("22222222-2222-2222-2222-222222222222");
    expect(document.plugins).toEqual(["contact"]);
    const built = buildContentBytes(source());
    expect(built.manifest.kind).toBe("export");
    expect(built.manifest.contentHash).toHaveLength(64);
    expect(new TextDecoder().decode(built.bytes)).toContain('"format": "getonsite"');
  });
});

describe("download tokens", () => {
  it("signs and verifies a project-bound token", () => {
    const token = signDownloadToken("backup", "backup-1", "project-1", 60);
    expect(verifyDownloadToken(token)).toMatchObject({
      kind: "backup",
      id: "backup-1",
      projectId: "project-1",
    });
    expect(verifyDownloadToken(`${token}x`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signDownloadToken("export", "export-1", "project-1", -1);
    expect(verifyDownloadToken(token)).toBeNull();
  });
});
