import { describe, expect, it } from "vitest";
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
      seo: { allowIndexing: true },
      plan: "basic",
    },
    pages: [
      {
        id: "page-home",
        slug: "",
        title: "Home",
        blocks: [
          { id: "block-0000000001", type: "heading", props: { text: "Hello", level: "h2" } },
          {
            id: "form-00000001",
            type: "contact-form",
            props: { heading: "Contact us", variation: "classic", showName: true },
          },
        ],
      },
      {
        id: "page-contact",
        slug: "contact",
        title: "Contact",
        blocks: [
          {
            id: "form-00000002",
            type: "contact-form",
            props: { heading: "Say hello", variation: "classic" },
          },
        ],
      },
    ],
    forms: { enabled: true },
    ...overrides,
  };
}

function text(file: { body: Uint8Array }): string {
  return new TextDecoder().decode(file.body);
}

describe("published contact forms", () => {
  it("writes the form action and a placeholder token when the plugin is on", async () => {
    const result = await buildSite(input());
    const home = text(result.files["index.html"]!);
    expect(home).toContain('action="/_forms/form-00000001"');
    expect(home).toContain("{{GS_FORM_TOKEN:form-00000001}}");
    expect(home).toContain('name="_b" value="/"');
  });

  it("reports the forms that were found", async () => {
    const result = await buildSite(input());
    expect(result.forms).toEqual([
      { id: "form-00000001", pagePath: "/", showName: true, showPhone: false, phoneRequired: false },
      { id: "form-00000002", pagePath: "/contact", showName: true, showPhone: false, phoneRequired: false },
    ]);
  });

  it("writes the thank-you and problem pages", async () => {
    const result = await buildSite(input());
    expect(result.files["_forms/sent/index.html"]).toBeTruthy();
    const problem = text(result.files["_forms/problem/index.html"]!);
    expect(problem).toContain("{{GS_PROBLEM_TEXT}}");
  });

  it("keeps the forms folder out of search results", async () => {
    const result = await buildSite(input());
    const robots = text(result.files["robots.txt"]!);
    expect(robots).toContain("Disallow: /_forms/");
  });

  it("renders nothing for forms when the plugin is off", async () => {
    const result = await buildSite(input({ forms: { enabled: false } }));
    const home = text(result.files["index.html"]!);
    expect(home).not.toContain("action=\"/_forms/");
    expect(home).not.toContain("{{GS_FORM_TOKEN");
    expect(result.forms).toEqual([]);
    expect(result.files["_forms/sent/index.html"]).toBeUndefined();
  });

  it("defuses placeholders typed into the content", async () => {
    const result = await buildSite(
      input({
        pages: [
          {
            id: "page-home",
            slug: "",
            title: "Home",
            blocks: [
              {
                id: "block-0000000001",
                type: "heading",
                props: { text: "Look {{GS_PAGE_PATH}} here", level: "h2" },
              },
            ],
          },
        ],
      }),
    );
    const home = text(result.files["index.html"]!);
    expect(home).not.toContain("{{GS_PAGE_PATH}}");
    expect(home).toContain("Look {\u200B{GS_PAGE_PATH}\u200B} here");
  });
});
