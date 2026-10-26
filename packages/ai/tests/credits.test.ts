import { describe, expect, it } from "vitest";
import {
  actualCredits,
  chargeCredits,
  creditRange,
  estimateCredits,
  imageCredits,
  imageNeurons,
  neuronsToCredits,
  reserveCredits,
  usageToNeurons,
  usdToNeurons,
} from "../src/credits";
import { MODEL_SEEDS } from "../src/registry/models";

const llama = MODEL_SEEDS.find((model) => model.id === "llama-3.3-70b")!;

describe("credit maths", () => {
  it("turns token usage into neurons", () => {
    const neurons = usageToNeurons(
      { inputTokens: 1000, outputTokens: 350 },
      llama,
    );
    expect(neurons).toBeCloseTo(98.34975, 5);
    expect(chargeCredits(neurons)).toBe(1);
  });

  it("prefers provider-reported neurons", () => {
    expect(
      usageToNeurons({ neurons: 250, inputTokens: 999999 }, llama),
    ).toBe(250);
  });

  it("converts neurons to credits and rounds charges up", () => {
    expect(neuronsToCredits(250)).toBe(2.5);
    expect(chargeCredits(250)).toBe(3);
    expect(chargeCredits(0)).toBe(1);
  });

  it("returns no charge for failures", () => {
    expect(
      actualCredits({ inputTokens: 1000, outputTokens: 500 }, llama, false),
    ).toBe(0);
    expect(
      actualCredits({ inputTokens: 1000, outputTokens: 500 }, llama, true),
    ).toBeGreaterThanOrEqual(1);
  });

  it("estimates and reserves within the cap", () => {
    const estimate = estimateCredits({
      inputTokens: 500,
      expectedOutputTokens: 100,
      model: llama,
    });
    expect(estimate).toBe(1);
    expect(reserveCredits(8, 15)).toBe(12);
    expect(reserveCredits(20, 15)).toBe(15);
    expect(creditRange(8, 15)).toEqual({ low: 6, high: 12 });
  });

  it("prices images by tile and step", () => {
    expect(imageNeurons({ width: 512, height: 512, steps: 4 })).toBeCloseTo(
      43.2,
    );
    expect(imageNeurons({ width: 1024, height: 1024, steps: 4 })).toBeCloseTo(
      172.8,
    );
    expect(imageCredits({ width: 1024, height: 1024, steps: 4 })).toBe(2);
  });

  it("converts dollars using the published neuron rate", () => {
    expect(usdToNeurons(0.011)).toBeCloseTo(1000);
  });
});
