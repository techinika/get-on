import { describe, expect, it } from "vitest";
import { pageFromBlocks, createNode, compileStyles } from "@get-on/blocks";
import { buildSite, type BuildSiteInput } from "../index";

const theme = { palette: "fresh-green" as const, fontPair: "friendly" as const, corners: "soft" as const };

function htmlOf(files: Record<string, { body: Uint8Array }>, path: string): string {
  const file = files[path];
  if (!file) throw new Error(`missing ${path}`);
  return new TextDecoder().decode(file.body);
}

function v5Input(plan = "free"): BuildSiteInput {
  const content = pageFromBlocks([
    { id: "contact-form-1", type: "contact-form", props: { heading: "Say hello" } },
  ]);
  const section = createNode("section");
  const heading = createNode("heading", { text: "Fresh bread", level: "h2" });
  heading.styles = { base: { color: "{text}", "padding-top": "12px" } };
  section.children = [heading];
  content.root.children = [section, ...(content.root.children ?? [])];

  return {
    siteId: "site-v5",
    publishId: "pub-v5",
    subdomain: "rosebakery",
    rootDomain: "get-on.tech",
    settings: {
      businessName: "Rose Bakery",
      theme,
      locale: "en-GB",
      seo: { title: "Rose Bakery", description: "Fresh bread." },
      plan,
    },
    pages: [
      {
        id: "page-home",
        slug: "",
        title: "Home",
        blocks: [],
        content,
      },
    ],
    forms: { enabled: true },
  };
}

describe("v5 publishing", () => {
  it("renders the v5 tree with compiled classes and cascade layers", async () => {
    const result = await buildSite(v5Input());
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain("gs-page");
    expect(html).toContain("gs-n-");
    expect(html).toContain("gs-s-");
    expect(html).toContain("@layer gs-protect,gs-base,gs-theme,gs-nodes,gs-user");
    expect(html).toContain("@layer gs-nodes{");
  });

  it("adds the protected badge and report link on Free", async () => {
    const result = await buildSite(v5Input("free"));
    const html = htmlOf(result.files, "index.html");
    expect(html).toContain('data-gs-protect="1"');
    expect(html).toContain("Report this site");
    expect(html).toContain("Built with");
  });

  it("does not add the badge on a paid plan", async () => {
    const result = await buildSite(v5Input("pro"));
    const html = htmlOf(result.files, "index.html");
    expect(html).not.toContain('data-gs-protect="1"');
  });

  it("collects the contact form from a smart v5 node", async () => {
    const result = await buildSite(v5Input());
    expect(result.forms.map((form) => form.id)).toContain("contact-form-1");
  });

  it("publishes no scripts", async () => {
    const result = await buildSite(v5Input());
    const html = htmlOf(result.files, "index.html");
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)\b/i);
  });

  it("keeps compiled node classes stable", async () => {
    const input = v5Input();
    const content = input.pages[0].content!;
    const first = compileStyles(content.root).classes.get(content.root.children![0].children![0].id);
    const second = compileStyles(content.root).classes.get(content.root.children![0].children![0].id);
    expect(first).toEqual(second);
    expect(first?.length).toBeGreaterThan(0);
  });
});
