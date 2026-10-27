import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BuiltFile } from "@get-on/publisher";
import { readPublishConfig } from "@/lib/publishing/config";
import {
  buildSiteInput,
  buildSnapshot,
  decodeDataUrl,
  parseTheme,
  usedImageIds,
} from "@/lib/publishing/build-input";
import {
  pauseFromSettings,
  redirectsFromRows,
} from "@/lib/publishing/live-pointer";
import { createPublishStore } from "@/lib/publishing/store";
import { displayAddress, siteStateOf } from "@/lib/publishing/status";

const dirs: string[] = [];

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Rose Bakery",
  subdomain: "rosebakery",
  settings: {
    contact: { phone: "+27 82 123 4567", email: "hello@example.com" },
    businessType: "Restaurant or cafe",
    about: "Fresh bread every day.",
    logoData: "data:image/png;base64,iVBORw0KGgo=",
  },
};

const page = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Home",
  path: "/",
  position: 0,
  is_homepage: true,
  blocks: [{ id: "block-one", type: "image", props: { imageId: "33333333-3333-4333-8333-333333333333" } }],
  show_in_menu: true,
  is_hidden: false,
  seo_title: "Rose Bakery",
  seo_description: "Fresh bread every day",
  hide_from_search: false,
};

describe("publishing config", () => {
  it("falls back to the local store without Cloudflare credentials", () => {
    const config = readPublishConfig(env({ ROOT_DOMAIN: "example.test" }));
    expect(config.kind).toBe("local");
    expect(config.rootDomain).toBe("example.test");
  });

  it("uses Cloudflare when every credential is present", () => {
    const config = readPublishConfig(
      env({
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_KV_NAMESPACE_ID: "namespace",
        CLOUDFLARE_R2_BUCKET: "bucket",
      }),
    );
    expect(config.kind).toBe("cloudflare");
  });

  it("lets PUBLISH_STORE force local even when credentials exist", () => {
    const config = readPublishConfig(
      env({
        PUBLISH_STORE: "local",
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_KV_NAMESPACE_ID: "namespace",
        CLOUDFLARE_R2_BUCKET: "bucket",
      }),
    );
    expect(config.kind).toBe("local");
  });
});

describe("site input", () => {
  it("keeps a known theme and forces light mode", () => {
    expect(
      parseTheme({ palette: "ocean", fontPair: "classic", corners: "round", colorMode: "dark" }),
    ).toEqual({ palette: "ocean", fontPair: "classic", corners: "round", colorMode: "light" });
  });

  it("falls back to the default theme", () => {
    expect(parseTheme({ palette: "neon" })).toEqual({
      palette: "fresh-green",
      fontPair: "friendly",
      corners: "soft",
      colorMode: "light",
    });
  });

  it("reads a logo data URL and rejects other data", () => {
    expect(decodeDataUrl("data:image/png;base64,iVBORw0KGgo=")?.contentType).toBe("image/png");
    expect(decodeDataUrl("data:text/html;base64,aGk=")).toBeNull();
    expect(decodeDataUrl("not a data url")).toBeNull();
  });

  it("finds images used by blocks", () => {
    expect([...usedImageIds([page])]).toEqual(["33333333-3333-4333-8333-333333333333"]);
  });

  it("maps database rows to the builder input", () => {
    const imageBytes = new Map([
      ["33333333-3333-4333-8333-333333333333", new Uint8Array([1, 2, 3])],
    ]);
    const input = buildSiteInput({
      project,
      projectSettings: {
        theme: { palette: "berry", fontPair: "warm", corners: "sharp" },
        seo_site_title: "Rose Bakery",
        seo_description: "Bread and pastries",
        search_indexing: false,
      },
      pages: [page],
      media: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          path: "project/picture.webp",
          alt: "Bread",
          width: 1024,
          height: 768,
          mime: "image/webp",
        },
      ],
      imageBytes,
      planId: "free",
      publishId: "44444444-4444-4444-8444-444444444444",
      rootDomain: "example.test",
      builtAt: new Date("2026-10-22T10:00:00Z"),
    });

    expect(input.siteId).toBe(project.id);
    expect(input.settings.businessName).toBe("Rose Bakery");
    expect(input.settings.theme.palette).toBe("berry");
    expect(input.settings.phone).toBe("+27 82 123 4567");
    expect(input.settings.logo?.contentType).toBe("image/png");
    expect(input.settings.seo).toEqual({
      title: "Rose Bakery",
      description: "Bread and pastries",
      allowIndexing: false,
    });
    expect(input.pages[0]).toMatchObject({
      slug: "",
      title: "Home",
      noindex: true,
      hidden: false,
    });
    expect(input.images?.[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("writes a snapshot with the pages and settings", () => {
    const snapshot = buildSnapshot(project, { seo_site_title: "Rose Bakery" }, [page]);
    expect(snapshot.project).toEqual({ name: "Rose Bakery", subdomain: "rosebakery" });
    expect((snapshot.pages as unknown[]).length).toBe(1);
  });
});

describe("live pointer settings", () => {
  it("reads a pause message from the saved settings", () => {
    expect(
      pauseFromSettings({
        enabled: true,
        title: "Back soon",
        text: "We are making bread.",
        since: "2026-10-24T10:00:00.000Z",
      }),
    ).toEqual({
      title: "Back soon",
      text: "We are making bread.",
      since: "2026-10-24T10:00:00.000Z",
    });
    expect(pauseFromSettings({ enabled: false })).toBeNull();
  });

  it("cleans moved pages before they reach the live pointer", () => {
    expect(
      redirectsFromRows([
        { from_path: "/Old-Menu/", to_value: "/menu", code: 301 },
        { from_path: "/bad", to_value: "javascript:alert(1)", code: 301 },
      ]),
    ).toEqual([{ from: "/old-menu", to: "/menu", code: 301 }]);
  });
});

describe("local publish store", () => {
  it("writes a version, verifies the home page and flips the pointer", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "get-on-publish-"));
    dirs.push(dir);
    const config = readPublishConfig(env({ PUBLISH_STORE: "local", LOCAL_SITES_DIR: dir }));
    const store = createPublishStore(config);
    const html = new TextEncoder().encode(
      '<!doctype html><html><head><style data-gs="1">.gs-root{--s-primary:#0B6B4F}.gs-header{}.gs-section{}.gs-btn{}</style></head><body><h1>Hello</h1></body></html>',
    );

    const files: Record<string, BuiltFile> = {
      "index.html": {
        body: html,
        contentType: "text/html; charset=utf-8",
        size: html.byteLength,
      },
    };
    const shared: Record<string, BuiltFile> = {
      "fonts/figtree-400-abc.woff2": {
        body: new Uint8Array([1, 2]),
        contentType: "font/woff2",
        size: 2,
      },
    };

    await store.writeShared(shared);
    await store.writeVersion("site-1", "publish-1", files);
    await store.writePointer("rosebakery.example.test", {
      siteId: "site-1",
      publishId: "publish-1",
      state: "live",
      builtAt: "2026-10-22T10:00:00.000Z",
      plan: "free",
    });

    const stored = await readFile(path.join(dir, "sites", "site-1", "v", "publish-1", "index.html"));
    expect(Buffer.from(stored).equals(Buffer.from(html))).toBe(true);
    const pointer = JSON.parse(
      await readFile(path.join(dir, "pointers", "rosebakery.example.test.json"), "utf8"),
    );
    expect(pointer.publishId).toBe("publish-1");
    const sharedFile = await readFile(path.join(dir, "_shared", "fonts", "figtree-400-abc.woff2"));
    expect(Buffer.from(sharedFile).equals(Buffer.from([1, 2]))).toBe(true);
  });

  it("refuses to upload a page without marked styles", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "get-on-publish-"));
    dirs.push(dir);
    const config = readPublishConfig(env({ PUBLISH_STORE: "local", LOCAL_SITES_DIR: dir }));
    const store = createPublishStore(config);
    const html = new TextEncoder().encode("<!doctype html><h1>Hello</h1>");
    const files: Record<string, BuiltFile> = {
      "index.html": {
        body: html,
        contentType: "text/html; charset=utf-8",
        size: html.byteLength,
      },
    };

    await expect(
      store.writeVersion("site-1", "publish-1", files),
    ).rejects.toThrow("UPLOAD_VERIFY_FAILED");
  });
});

describe("site status", () => {
  it("uses one status for every screen", () => {
    expect(
      siteStateOf({
        published: false,
        hasLiveVersion: false,
        hasChanges: true,
        reviewState: "none",
        suspendedAt: null,
      }),
    ).toBe("draft");
    expect(
      siteStateOf({
        published: true,
        hasLiveVersion: true,
        hasChanges: false,
        reviewState: "none",
        suspendedAt: null,
      }),
    ).toBe("live");
    expect(
      siteStateOf({
        published: true,
        hasLiveVersion: true,
        hasChanges: true,
        reviewState: "none",
        suspendedAt: null,
      }),
    ).toBe("changes");
    expect(
      siteStateOf({
        published: false,
        hasLiveVersion: true,
        hasChanges: false,
        reviewState: "none",
        suspendedAt: null,
      }),
    ).toBe("offline");
    expect(
      siteStateOf({
        published: true,
        hasLiveVersion: true,
        hasChanges: false,
        reviewState: "pending",
        suspendedAt: null,
      }),
    ).toBe("review");
    expect(
      siteStateOf({
        published: true,
        hasLiveVersion: true,
        hasChanges: false,
        reviewState: "none",
        suspendedAt: "2026-10-22T10:00:00.000Z",
      }),
    ).toBe("suspended");
  });

  it("shows an address without the http prefix", () => {
    expect(displayAddress("https://rosebakery.get-on.tech/")).toBe(
      "rosebakery.get-on.tech",
    );
    expect(displayAddress("http://rosebakery.localhost:8787")).toBe(
      "rosebakery.localhost:8787",
    );
  });
});
