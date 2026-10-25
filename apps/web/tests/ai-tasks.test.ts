import { describe, expect, it } from "vitest";
import { TEXT_TASKS, VISION_TASKS, textTask, visionTask } from "@/lib/ai/tasks";

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

  it("uses a vision model for picture descriptions", () => {
    const task = visionTask("alt.describe");
    expect(task?.requirement.needsVision).toBe(true);
    expect(task?.maxChars).toBeLessThanOrEqual(160);
    expect(VISION_TASKS["alt.describe"]?.version).toBe("alt.describe@1");
  });
});
