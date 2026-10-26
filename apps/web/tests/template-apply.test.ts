import { describe, expect, it } from "vitest";
import { uniquePagePath } from "@/lib/templates/apply";

describe("template add pages", () => {
  it("keeps a free path unchanged", () => {
    expect(uniquePagePath("/about", new Set())).toBe("/about");
    expect(uniquePagePath("about", new Set())).toBe("/about");
    expect(uniquePagePath("/about/", new Set())).toBe("/about");
  });

  it("adds a number when the path is taken", () => {
    const taken = new Set(["/about", "/about-2"]);
    expect(uniquePagePath("/about", taken)).toBe("/about-3");
  });

  it("matches existing paths without caring about case", () => {
    expect(uniquePagePath("/About", new Set(["/about"]))).toBe("/About-2");
  });

  it("never uses the home path for an added page", () => {
    expect(uniquePagePath("/", new Set())).toBe("/page");
    expect(uniquePagePath("/", new Set(["/page"]))).toBe("/page-2");
  });
});
