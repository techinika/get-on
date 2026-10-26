import { describe, expect, it } from "vitest";
import { STRUCTURED_TASKS, TEXT_TASKS, VISION_TASKS, structuredTask, textTask, visionTask } from "@/lib/ai/tasks";

describe("AI text task definitions", () => {
  it("covers the editor text actions", () => {
    for (const id of [
      "text.write",
      "text.improve",
      "list.expand",
      "seo.write",
      "profile.write",
      "design.suggest",
    ] as const) {
      expect(textTask(id)?.taskId).toBe(id);
    }
  });

  it("keeps tips.fix deterministic and out of the model path", () => {
    expect(textTask("tips.fix")).toBeNull();
  });

  it("uses the brief model for design suggestions", () => {
    expect(TEXT_TASKS["design.suggest"]?.purpose).toBe("brief");
  });

  it("has a character limit and a task version for every task", () => {
    for (const task of Object.values(TEXT_TASKS)) {
      expect(task?.maxChars).toBeGreaterThan(0);
      expect(task?.version).toContain("@");
    }
  });

  it("has a template fill structured task", () => {
    const task = structuredTask("template.fill");
    expect(task?.schemaName).toBe("template_fill");
    expect(STRUCTURED_TASKS["template.fill"]?.version).toBe("template.fill@1");
    expect(task?.validate({ slots: [{ id: "hero:heading", text: "New heading" }] })).toEqual({
      ok: true,
      data: { slots: [{ id: "hero:heading", text: "New heading" }] },
    });
  });

  it("uses a vision model for picture descriptions", () => {
    const task = visionTask("alt.describe");
    expect(task?.requirement.needsVision).toBe(true);
    expect(task?.maxChars).toBeLessThanOrEqual(160);
    expect(VISION_TASKS["alt.describe"]?.version).toBe("alt.describe@1");
  });
});
