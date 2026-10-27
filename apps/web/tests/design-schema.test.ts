import { describe, expect, it } from "vitest";
import { designInterpretationJsonSchema, designInterpretationSchema } from "@/lib/ai/design-schema";
import { structuredTask } from "@/lib/ai/tasks";

const valid = {
  requirements: [
    { kind: "color_exact", target: "primary", value: "#1e40af", strength: "must", evidence: "Main colour" },
    { kind: "hero_layout", target: "home", value: "editorial", strength: "should" },
  ],
  palette: { primary: "#1e40af", mode: "light" },
  fonts: { feel: "modern" },
  layout: { hero: "editorial" },
  sections: { include: ["pricing"], exclude: ["testimonials"] },
  pages: { include: ["about"], exclude: [], count: 4 },
  tone: ["friendly"],
  copy: { mention: ["family run"], avoidWords: ["cheap"], useWords: [] },
  unsupported: [{ text: "video background", nearest: "Use a full-width photo." }],
  clarifications: [],
  confidence: 0.9,
};

describe("design interpretation schema", () => {
  it("accepts a valid design interpretation", () => {
    expect(designInterpretationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invented requirement kinds and short hex colours", () => {
    expect(designInterpretationSchema.safeParse({ ...valid, requirements: [{ ...valid.requirements[0], kind: "vibes" }] }).success).toBe(false);
    expect(designInterpretationSchema.safeParse({ ...valid, palette: { primary: "#fff" } }).success).toBe(false);
  });

  it("has a strict JSON schema for Workers AI", () => {
    expect(designInterpretationJsonSchema.required).toContain("requirements");
    expect(designInterpretationJsonSchema.properties.requirements.maxItems).toBe(40);
    expect(designInterpretationJsonSchema.additionalProperties).toBe(false);
  });

  it("registers all three design tasks", () => {
    for (const id of ["design.interpret", "design.options", "design.restyle"] as const) {
      const task = structuredTask(id);
      expect(task?.kind).toBe("structured");
      expect(task?.schemaName).toMatch(/^design_/);
      expect(task?.validate(valid)).toEqual({ ok: true, data: expect.objectContaining({ confidence: 0.9 }) });
    }
  });
});
