import { describe, expect, it } from "vitest";
import { designFixtures, runDesignEval } from "../src/design/eval";

describe("design eval fixtures", () => {
  it("has at least 200 briefs across the required cases", () => {
    const fixtures = designFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(200);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(fixtures.length);
    expect(fixtures.some((fixture) => fixture.expectedUnsupported?.length)).toBe(true);
    expect(fixtures.some((fixture) => fixture.expectedLanguage)).toBe(true);
  });

  it("passes every deterministic gate", () => {
    const summary = runDesignEval();
    expect(summary.failures).toEqual([]);
    expect(summary.gates.every((gate) => gate.passed)).toBe(true);
    expect(summary.extractionRecall).toBeGreaterThanOrEqual(0.95);
    expect(summary.exactHex).toBe(1);
    expect(summary.namedFonts).toBe(1);
    expect(summary.pageCounts).toBe(1);
    expect(summary.unsupportedReported).toBe(1);
  });
});
