import { describe, expect, it } from "vitest";
import { designCatalogueExcerpt, designCatalogueIds } from "../src/design/catalogue";

describe("design catalogue excerpt", () => {
  it("includes ids, meanings and synonyms for prompts", () => {
    const excerpt = designCatalogueExcerpt(["heroLayouts", "headerStyles", "footerLayouts", "blockVariants"]);
    expect(excerpt).toContain("split screen");
    expect(excerpt).toContain("browser window");
    expect(excerpt).toContain("bigbrand");
    expect(excerpt).toContain("mosaic");
    expect(excerpt.length).toBeGreaterThan(2000);
  });

  it("lists ids for validation", () => {
    expect(designCatalogueIds("heroLayouts")).toContain("editorial");
    expect(designCatalogueIds("footerLayouts")).toEqual(["simple", "columns", "centered", "bigbrand"]);
    expect(designCatalogueIds("designOptions").length).toBeGreaterThan(20);
  });
});
