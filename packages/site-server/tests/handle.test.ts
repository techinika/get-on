import { describe, expect, it } from "vitest";
import {
  handleSiteRequest,
  notFoundPage,
  notPublishedPage,
  parseHost,
  pausedPage,
  suspendedPage,
  type SiteFile,
  type SitePointer,
  type SiteStore,
} from "../index";

const encoder = new TextEncoder();

function file(
  body: string,
  contentType = "text/html; charset=utf-8",
): SiteFile {
  const bytes = encoder.encode(body);
  return {
    body: bytes,
    contentType,
    etag: `"${bytes.length}-abc"`,
    size: bytes.byteLength,
  };
}

type StoreState = {
  pointer?: SitePointer | null;
  files?: Record<string, SiteFile>;
  shared?: Record<string, SiteFile>;
};

function memoryStore(state: StoreState): SiteStore {
  return {
    async getPointer(_host: string) {
      if (!state.pointer) return null;
      return state.pointer;
    },
    async getFile(_siteId: string, _publishId: string, path: string) {
      return state.files?.[path] ?? null;
    },
    async getSharedFile(path: string) {
      return state.shared?.[path] ?? null;
    },
  };
}

const livePointer: SitePointer = {
  siteId: "site-1",
  publishId: "pub-1",
  state: "live",
  builtAt: "2026-01-01T00:00:00.000Z",
  plan: "free",
};

function request(url: string, init: RequestInit = {}) {
  const host = new URL(url).host;
  return new Request(url, {
    ...init,
    headers: { host, ...(init.headers ?? {}) },
  });
}

describe("parseHost", () => {
  it("reads the website name", () => {
    const result = parseHost("rosebakery.get-on.tech");
    expect(result).toEqual({
      ok: true,
      name: "rosebakery",
      hostname: "rosebakery.get-on.tech",
    });
  });

  it("lowercases and drops the port", () => {
    const result = parseHost("RoseBakery.Get-On.Tech:8787");
    expect(result.ok && result.name).toBe("rosebakery");
  });

  it("rejects the apex, nested platform labels and IP hosts", () => {
    expect(parseHost("get-on.tech")).toEqual({ ok: false, reason: "apex" });
    expect(parseHost("a.b.get-on.tech")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseHost("127.0.0.1")).toEqual({ ok: false, reason: "invalid" });
    expect(parseHost("")).toEqual({ ok: false, reason: "invalid" });
  });

  it("accepts a customer host on another domain", () => {
    expect(parseHost("WWW.Example.COM:443")).toEqual({
      ok: true,
      name: "www.example.com",
      hostname: "www.example.com",
      custom: true,
    });
  });

  it("rejects reserved names", () => {
    expect(parseHost("admin.get-on.tech")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(parseHost("www.get-on.tech")).toEqual({
      ok: false,
      reason: "reserved",
    });
  });
});

describe("handleSiteRequest", () => {
  it("serves the homepage of a live site", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "index.html": file("<html>home</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(await response.text()).toContain("home");
  });

  it("maps a page to its clean address", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "about/index.html": file("<html>about</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/about"),
      store,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("about");
  });

  it("redirects a trailing slash to the clean address", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/about/"),
      store,
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/about");
  });

  it("redirects index.html to the clean address", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    const root = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/index.html"),
      store,
    );
    expect(root.status).toBe(308);
    expect(root.headers.get("location")).toBe("/");
    const page = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/about/index.html"),
      store,
    );
    expect(page.headers.get("location")).toBe("/about");
  });

  it("redirects an upper case path to lower case", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/About"),
      store,
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/about");
  });

  it("ignores the query string when looking up a file", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "index.html": file("<html>home</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/?utm=1"),
      store,
    );
    expect(response.status).toBe(200);
  });

  it("only allows GET and HEAD", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/", { method: "POST" }),
      store,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("answers HEAD without a body", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "index.html": file("<html>home</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/", { method: "HEAD" }),
      store,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("refuses traversal attempts", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    for (const path of ["/%2e%2e/secret", "/a\\b", "/a//b", "/a%00b"]) {
      const response = await handleSiteRequest(
        request(`http://rosebakery.get-on.tech${path}`),
        store,
        {
          rawPath: path,
        },
      );
      expect(response.status, path).toBe(400);
    }
  });

  it("refuses a raw path that tries to step out of the website", async () => {
    const store = memoryStore({ pointer: livePointer, files: {} });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/secret"),
      store,
      { rawPath: "/../secret" },
    );
    expect(response.status).toBe(400);
  });

  it("serves the site 404 page with status 404", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "404.html": file("<html>missing</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/nope"),
      store,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("missing");
  });

  it("shows the pause message while the owner makes changes", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        pause: { title: "Back after lunch", text: "We are baking new bread." },
      },
      files: { "index.html": file("<html>home</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("Back after lunch");
    expect(html).toContain("We are baking new bread.");
    expect(html).not.toContain("<script");
  });

  it("sends an old address to the new one", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        redirects: [{ from: "/old-menu", to: "/menu", code: 301 }],
      },
      files: {},
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/old-menu?ref=menu"),
      store,
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/menu?ref=menu");
  });

  it("refuses an unsafe moved-page target", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        redirects: [{ from: "/old", to: "javascript:alert(1)", code: 301 }],
      },
      files: {},
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/old"),
      store,
    );
    expect(response.status).toBe(404);
  });

  it("caches images and fonts for a long time", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "assets/a.webp": file("image", "image/webp") },
      shared: { "fonts/a.woff2": file("font", "font/woff2") },
    });
    const image = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/assets/a.webp"),
      store,
    );
    expect(image.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    const font = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/fonts/a.woff2"),
      store,
    );
    expect(font.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("caches the sitemap and the favicon for an hour", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: {
        "sitemap.xml": file("<urlset/>", "application/xml; charset=utf-8"),
        "favicon.ico": file("icon", "image/x-icon"),
      },
    });
    const sitemap = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/sitemap.xml"),
      store,
    );
    expect(sitemap.headers.get("cache-control")).toBe("public, max-age=3600");
    const icon = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/favicon.ico"),
      store,
    );
    expect(icon.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("answers a matching ETag with 304", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "index.html": file("<html>home</html>") },
    });
    const first = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    const etag = first.headers.get("etag")!;
    const second = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/", {
        headers: { "if-none-match": etag },
      }),
      store,
    );
    expect(second.status).toBe(304);
  });

  it("sets the security headers on every answer", async () => {
    const store = memoryStore({
      pointer: livePointer,
      files: { "index.html": file("<html>home</html>") },
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    );
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
  });

  it("shows the not found page for an unknown host", async () => {
    const store = memoryStore({ pointer: null, files: {} });
    const response = await handleSiteRequest(
      request("http://nothing.get-on.tech/"),
      store,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("We could not find this website");
  });

  it("shows the not live page for a site that is not published", async () => {
    const store = memoryStore({
      pointer: { ...livePointer, state: "unpublished" },
      files: {},
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("This website is not live yet");
  });

  it("shows the suspended page with 403 and no caching", async () => {
    const store = memoryStore({
      pointer: { ...livePointer, state: "suspended" },
      files: {},
    });
    const response = await handleSiteRequest(
      request("http://rosebakery.get-on.tech/"),
      store,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("This website is not available");
  });
});

describe("platform pages", () => {
  it("has no JavaScript and says who made it", () => {
    for (const html of [
      notFoundPage(),
      notPublishedPage(),
      pausedPage("Back soon", "Please come back later."),
      suspendedPage("rosebakery"),
    ]) {
      expect(html).not.toContain("<script");
      expect(html).toContain("Made with");
      expect(html).toContain("Get-On");
    }
  });
});

describe("custom domains", () => {
  it("serves a connected custom host with the customer HSTS header", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        primaryHost: "www.example.com",
        freeHost: "rose.get-on.tech",
        redirectToPrimary: true,
      },
      files: { "index.html": file("<h1>Rose Bakery</h1>") },
    });

    const response = await handleSiteRequest(
      request("https://www.example.com/"),
      store,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000",
    );
  });

  it("redirects another custom address to the main address", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        primaryHost: "www.example.com",
      },
    });

    const response = await handleSiteRequest(
      request("https://example.com/menu?from=old"),
      store,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://www.example.com/menu?from=old",
    );
  });

  it("sends the free address to the main address when the owner allows it", async () => {
    const store = memoryStore({
      pointer: {
        ...livePointer,
        primaryHost: "www.example.com",
        freeHost: "rose.get-on.tech",
        redirectToPrimary: true,
      },
    });

    const response = await handleSiteRequest(
      request("https://rose.get-on.tech/"),
      store,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://www.example.com/");
  });

  it("answers the health check without redirecting", async () => {
    const store = memoryStore({
      pointer: { ...livePointer, primaryHost: "www.example.com" },
    });

    const response = await handleSiteRequest(
      request("https://example.com/_gs/health"),
      store,
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("ok");
  });

  it("shows the not-connected page for an unknown custom host", async () => {
    const response = await handleSiteRequest(
      request("https://unknown.example.com/"),
      memoryStore({}),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("not connected to a website");
  });

  it("pauses a website when its plan lapsed", async () => {
    const response = await handleSiteRequest(
      request("https://www.example.com/"),
      memoryStore({ pointer: { ...livePointer, planLapsed: true } }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("3600");
  });
});
