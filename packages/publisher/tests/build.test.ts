import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { buildSite, type BuildSiteInput } from "../index";

const theme = {
  palette: "fresh-green" as const,
  fontPair: "friendly" as const,
  corners: "soft" as const,
};

function input(overrides: Partial<BuildSiteInput> = {}): BuildSiteInput {
  return {
    siteId: "site-1",
    publishId: "pub-1",
    subdomain: "rosebakery",
    rootDomain: "get-on.tech",
    settings: {
      businessName: "Rose Bakery",
      theme,
      locale: "en-GB",
      phone: "+44 20 7946 0000",
      email: "hello@rosebakery.test",
      address: "12 Rose Street, London",
      hours: "Mon to Fri, 8am to 5pm",
      businessType: "bakery",
      socialLinks: [
        { network: "instagram", url: "https://instagram.com/rosebakery" },
      ],
      seo: { title: "Rose Bakery", description: "Fresh bread every morning." },
      plan: "free",
    },
    pages: [
      {
        id: "page-home",
        slug: "",
        title: "Home",
        description: "Fresh bread every morning.",
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
          {
            id: "block-0000000002",
            type: "heading",
            props: {
              text: "What we bake",
              level: "h2",
              align: "left",
              background: "plain",
            },
          },
          {
            id: "block-0000000003",
            type: "text",
            props: {
              content: "Sourdough, rye and a very good butter croissant.",
              align: "left",
              background: "plain",
            },
          },
        ],
      },
      {
        id: "page-about",
        slug: "about-us",
        title: "About us",
        description: "Meet the team.",
        seoTitle: "About Rose Bakery",
        showInMenu: true,
        blocks: [
          {
            id: "block-0000000004",
            type: "text",
            props: {
              content: "We opened in 2019.",
              align: "left",
              background: "plain",
            },
          },
        ],
      },
      {
        id: "page-secret",
        slug: "secret",
        title: "Secret",
        hidden: true,
        blocks: [],
      },
    ],
    ...overrides,
  };
}

function htmlOf(
  files: Record<string, { body: Uint8Array }>,
  path: string,
): string {
  const file = files[path];
  if (!file) throw new Error(`missing ${path}`);
  return new TextDecoder().decode(file.body);
}

describe("buildSite", () => {
  it("builds a page for every page that is not hidden", async () => {
    const result = await buildSite(input());
    expect(Object.keys(result.files)).toContain("index.html");
    expect(Object.keys(result.files)).toContain("about-us/index.html");
    expect(Object.keys(result.files)).not.toContain("secret/index.html");
  });

  it("adds the files that Google and browsers need", async () => {
    const result = await buildSite(input());
    expect(Object.keys(result.files)).toContain("sitemap.xml");
    expect(Object.keys(result.files)).toContain("robots.txt");
    expect(Object.keys(result.files)).toContain("404.html");
  });

  it("writes no JavaScript into the page", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "index.html");
    expect(html).not.toContain("<script src");
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
  });

  it("puts the styles in the page", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain("<style>");
    expect(html).toContain("--s-primary:#0B6B4F");
  });

  it("keeps the page small", async () => {
    const result = await buildSite(input());
    const gzipped = gzipSync(
      Buffer.from(result.files["index.html"]!.body),
    ).byteLength;
    expect(gzipped).toBeLessThan(20 * 1024);
    expect(result.largestPageBytes).toBeLessThan(20 * 1024);
  });

  it("shows the business name, the menu and the blocks", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain("Rose Bakery");
    expect(html).toContain("Fresh bread every morning");
    expect(html).toContain("What we bake");
    expect(html).toContain('href="/about-us"');
  });

  it("marks the page as not needing Google when the owner turned it off", async () => {
    const base = input();
    const result = await buildSite({
      ...base,
      settings: {
        ...base.settings,
        seo: { ...base.settings.seo, allowIndexing: false },
      },
    });
    expect(htmlOf(result.files, "index.html")).toContain(
      'name="robots" content="noindex,nofollow"',
    );
    expect(htmlOf(result.files, "robots.txt")).toContain("Disallow: /");
  });

  it("keeps Google away from a page that is hidden from Google", async () => {
    const base = input();
    const result = await buildSite({
      ...base,
      pages: base.pages.map((page) =>
        page.id === "page-about" ? { ...page, noindex: true } : page,
      ),
    });
    const html = htmlOf(result.files, "about-us/index.html");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(htmlOf(result.files, "sitemap.xml")).not.toContain("about-us");
  });

  it("writes the address of every page into the sitemap", async () => {
    const result = await buildSite(input());
    const sitemap = htmlOf(result.files, "sitemap.xml");
    expect(sitemap).toContain("<loc>https://rosebakery.get-on.tech</loc>");
    expect(sitemap).toContain(
      "<loc>https://rosebakery.get-on.tech/about-us</loc>",
    );
    expect(htmlOf(result.files, "robots.txt")).toContain(
      "Sitemap: https://rosebakery.get-on.tech/sitemap.xml",
    );
  });

  it("adds the structured data Google reads", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain('"telephone":"+44 20 7946 0000"');
    expect(html).toContain('"@type":"WebPage"');
  });

  it("shows a friendly page when a page is missing", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "404.html");
    expect(html).toContain("Page not found");
    expect(html).toContain("Go to the homepage");
    expect(html).toContain("Made with");
  });

  it("shows the Get-On mark on a free website", async () => {
    const result = await buildSite(input());
    expect(htmlOf(result.files, "index.html")).toContain("Made with");
  });

  it("does not show the Get-On mark on a paid website", async () => {
    const base = input();
    const result = await buildSite({
      ...base,
      settings: { ...base.settings, plan: "pro" },
    });
    expect(htmlOf(result.files, "index.html")).not.toContain("Made with");
  });

  it("shows a letter instead of a logo when the website has no logo", async () => {
    const result = await buildSite(input());
    const html = htmlOf(result.files, "index.html");
    expect(html).not.toContain('<img class="gs-logo"');
    expect(html).toContain("gs-logo-letter");
  });

  it("gives every page its own address", async () => {
    const result = await buildSite(input());
    expect(htmlOf(result.files, "about-us/index.html")).toContain(
      '<link rel="canonical" href="https://rosebakery.get-on.tech/about-us">',
    );
  });

  it("uses the page title in the page and the site title as a fallback", async () => {
    const result = await buildSite(input());
    expect(htmlOf(result.files, "about-us/index.html")).toContain(
      "<title>About Rose Bakery</title>",
    );
    expect(htmlOf(result.files, "index.html")).toContain(
      "<title>Rose Bakery</title>",
    );
  });

  it("makes the fonts ready to share between websites", async () => {
    const result = await buildSite({
      ...input(),
      fonts: [
        {
          family: "Figtree",
          weight: 400,
          bytes: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ],
    });
    const fontFile = Object.keys(result.shared).find((name) =>
      name.startsWith("fonts/"),
    );
    expect(fontFile).toBeTruthy();
    expect(result.shared[fontFile!]!.contentType).toBe("font/woff2");
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain("@font-face{font-family:'Figtree'");
    expect(html).toContain(`url('/${fontFile}')`);
  });

  it("warns when a picture cannot be prepared", async () => {
    const result = await buildSite({
      ...input(),
      images: [{ id: "img-1", bytes: new Uint8Array([1, 2, 3]) }],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("gives the same result every time", async () => {
    const first = await buildSite(input());
    const second = await buildSite(input());
    expect(Object.keys(first.files).sort()).toEqual(
      Object.keys(second.files).sort(),
    );
    expect(first.totalBytes).toBe(second.totalBytes);
  });
});
