import { describe, expect, it } from "vitest";
import { FakeAiProvider } from "../src/providers/fake";
import { runEvalCase, runEvalSuite, type EvalCase } from "../src/eval";

const messages = [{ role: "user" as const, content: "Write a welcome line." }];

function textCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: "text-1",
    taskId: "text.write",
    kind: "text",
    modelId: "llama-3.3-70b",
    messages,
    expected: { minChars: 5, maxChars: 200, excludes: ["award-winning"] },
    ...overrides,
  };
}

describe("eval runner", () => {
  it("passes a text case that meets the expectations", async () => {
    const result = await runEvalCase(
      new FakeAiProvider({ text: "A clear, friendly welcome." }),
      textCase(),
    );

    expect(result.ok).toBe(true);
    expect(result.score).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("reports a hard fail when output breaks an expectation", async () => {
    const result = await runEvalCase(
      new FakeAiProvider({ text: "We are an award-winning team." }),
      textCase(),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Unexpected: award-winning");
  });

  it("checks structured values and required keys", async () => {
    const result = await runEvalCase(
      new FakeAiProvider({ structuredValue: { heading: "Hello" } }),
      {
        id: "structured-1",
        taskId: "section.generate",
        kind: "structured",
        modelId: "llama-3.3-70b",
        messages,
        schemaName: "section_generation",
        expected: { requiredKeys: ["heading", "text"] },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Missing key: text");
  });

  it("turns provider errors into a failed case", async () => {
    const result = await runEvalCase(
      new FakeAiProvider({ mode: "timeout" }),
      textCase(),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("AI_TIMEOUT");
    expect(result.issues).toEqual(["Provider error: AI_TIMEOUT"]);
  });

  it("summarises a suite and total usage", async () => {
    const summary = await runEvalSuite(
      new FakeAiProvider({ text: "A clear, friendly welcome." }),
      [
        textCase({ id: "one" }),
        textCase({ id: "two" }),
      ],
    );

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.score).toBe(1);
    expect(summary.hardFails).toEqual([]);
    expect(summary.usage.inputTokens).toBeGreaterThan(0);
    expect(summary.usage.outputTokens).toBeGreaterThan(0);
  });
});
