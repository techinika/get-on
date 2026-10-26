import { describe, expect, it } from "vitest";
import { fallbackChain, modelFor, MODEL_SEEDS } from "../src/registry/models";

describe("model registry", () => {
  it("finds the JSON structured model", () => {
    expect(modelFor("brief", { needsJson: true })?.id).toBe("llama-3.3-70b");
    expect(modelFor("writer", { needsJson: true })?.id).toBe("llama-3.3-70b");
  });

  it("finds the cheapest plain-text model", () => {
    expect(modelFor("writer", { preferCheap: true })?.id).toBe("llama-3.2-3b");
  });

  it("finds vision, guard and image models", () => {
    expect(modelFor("vision", { needsVision: true })?.id).toBe("gemma-4-26b");
    expect(modelFor("guard")?.id).toBe("llama-guard-3-8b");
    expect(modelFor("image")?.id).toBe("flux-1-schnell");
  });

  it("respects the prompt context limit", () => {
    expect(modelFor("writer", { maxPromptTokens: 50_000 })?.id).toBe(
      "llama-3.2-3b",
    );
  });

  it("returns null when no model fits", () => {
    expect(modelFor("writer", { needsJson: true, needsVision: true })).toBeNull();
  });

  it("follows fallback chains without loops", () => {
    const cheap = MODEL_SEEDS.find((model) => model.id === "llama-3.2-3b")!;
    const gemma = MODEL_SEEDS.find((model) => model.id === "gemma-4-26b")!;
    expect(fallbackChain(cheap).map((model) => model.id)).toEqual([
      "llama-3.2-3b",
      "llama-3.3-70b",
    ]);
    expect(fallbackChain(gemma).map((model) => model.id)).toEqual([
      "gemma-4-26b",
      "llama-3.2-11b-vision",
    ]);
  });
});
