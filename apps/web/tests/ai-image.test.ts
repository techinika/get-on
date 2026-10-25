import { describe, expect, it } from "vitest";
import { imagePrompt } from "@/lib/ai/image-pipeline";

describe("AI image prompt", () => {
  it("keeps safety rules and business facts in the prompt", () => {
    const prompt = imagePrompt("a warm photo of a bakery counter", {
      brandVoice: {},
      businessType: "Bakery",
      templateSlug: null,
      businessFacts: [{ label: "Town", value: "Bristol" }],
    });
    expect(prompt).toContain("No text, logos, watermarks");
    expect(prompt).toContain("Town: Bristol");
    expect(prompt).toContain("a warm photo of a bakery counter");
  });

  it("caps the prompt for the image model", () => {
    const prompt = imagePrompt("x".repeat(5000), {
      brandVoice: {},
      businessType: null,
      templateSlug: null,
      businessFacts: [],
    });
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });
});
