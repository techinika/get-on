import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createNodeStore, writeNodePointer } from "@get-on/site-server/node";
import { handleSiteRequest } from "@get-on/site-server";
import { buildSite } from "../index";

let rootDir: string;

beforeAll(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "get-on-publish-"));
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("a published website", () => {
  it("can be opened by a visitor", async () => {
    const result = await buildSite({
      siteId: "site-1",
      publishId: "pub-1",
      subdomain: "rosebakery",
      settings: {
        businessName: "Rose Bakery",
        theme: {
          palette: "fresh-green",
          fontPair: "friendly",
          corners: "soft",
        },
        phone: "+442079460000",
        seo: {
          title: "Rose Bakery",
          description: "Fresh bread every morning.",
        },
        plan: "free",
      },
      pages: [
        {
          id: "page-home",
          slug: "",
          title: "Home",
          blocks: [
            {
              id: "block-0000000001",
              type: "hero",
              props: {
                heading: "Fresh bread every morning",
                subheading: "We bake in our shop on Rose Street.",
                buttonLabel: "Call us",
                buttonLink: { type: "phone", number: "+442079460000" },
                layout: "text-only",
                align: "center",
                background: "soft",
              },
            },
          ],
        },
        {
          id: "page-about",
          slug: "about-us",
          title: "About us",
          showInMenu: true,
          blocks: [],
        },
      ],
    });

    // Put the files where the local server looks for them.
    const siteDir = path.join(rootDir, "sites", "site-1", "v", "pub-1");
    for (const [name, file] of Object.entries(result.files)) {
      const target = path.join(siteDir, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.body);
    }
    for (const [name, file] of Object.entries(result.shared)) {
      const target = path.join(rootDir, "_shared", name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.body);
    }
    await writeNodePointer(rootDir, "rosebakery.localhost", {
      siteId: "site-1",
      publishId: "pub-1",
      state: "live",
      builtAt: "2026-01-01T00:00:00.000Z",
      plan: "free",
    });

    const store = createNodeStore(rootDir);
    const home = await handleSiteRequest(
      new Request("http://rosebakery.localhost/", {
        headers: { host: "rosebakery.localhost" },
      }),
      store,
      { rootDomain: "localhost" },
    );
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("Fresh bread every morning");
    expect(html).toContain("<style>");

    const about = await handleSiteRequest(
      new Request("http://rosebakery.localhost/about-us", {
        headers: { host: "rosebakery.localhost" },
      }),
      store,
      { rootDomain: "localhost" },
    );
    expect(about.status).toBe(200);

    const missing = await handleSiteRequest(
      new Request("http://rosebakery.localhost/nope", {
        headers: { host: "rosebakery.localhost" },
      }),
      store,
      { rootDomain: "localhost" },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("Page not found");

    const sitemap = await handleSiteRequest(
      new Request("http://rosebakery.localhost/sitemap.xml", {
        headers: { host: "rosebakery.localhost" },
      }),
      store,
      { rootDomain: "localhost" },
    );
    expect(sitemap.status).toBe(200);
    expect(await sitemap.text()).toContain(
      "<loc>https://rosebakery.get-on.tech/about-us</loc>",
    );
  });
});

describe("the local site server with a published website", () => {
  let server: http.Server;
  let port: number;

  function request(pathname: string) {
    return new Promise<{
      status: number;
      headers: http.IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method: "GET",
          headers: { host: `rosebakery.localhost:${port}` },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body,
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  beforeAll(async () => {
    const { serve } = await import("@get-on/site-server/node");
    server = serve({ rootDir, port: 0, rootDomain: "localhost" });
    await new Promise<void>((resolve) =>
      server.once("listening", () => resolve()),
    );
    const address = server.address();
    port = typeof address === "object" && address ? address.port : 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("serves the website to a browser", async () => {
    const response = await request("/");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.body).toContain("Rose Bakery");
  });

  it("moves the old address to the new one", async () => {
    const response = await request("/about-us/");
    expect(response.status).toBe(308);
    expect(response.headers.location).toBe("/about-us");
  });
});
