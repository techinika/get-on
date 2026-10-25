import { describe, expect, it } from "vitest";
import { isAiError } from "../src/errors";
import {
  composePrompt,
  escapePromptData,
  PLATFORM_RULES,
} from "../src/prompts/composer";

const base = {
  taskId: "text.write" as const,
  taskRules: "Write one short headline.",
  taskVersion: "text.write@1",
  maxPromptTokens: 5000,
};

describe("prompt composer", () => {
  it("keeps platform and task rules in the system message", () => {
    const result = composePrompt({ ...base, userInput: "A bakery" });
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[0]?.content).toContain(PLATFORM_RULES);
    expect(result.messages[0]?.content).toContain("Write one short headline.");
    expect(result.manifest.platformRules).toBe("platform-rules@1");
  });

  it("wraps and escapes untrusted data", () => {
    const result = composePrompt({
      ...base,
      userInput: "<b>{{name}}</b>",
    });
    expect(result.messages[1]?.content).toContain(
      "&lt;b&gt;{ {name} }&lt;/b&gt;",
    );
    expect(escapePromptData("<x>")).toBe("&lt;x&gt;");
  });

  it("drops low-priority skills over the skill budget", () => {
    const result = composePrompt({
      ...base,
      skills: [
        {
          id: "big",
          version: 1,
          priority: 1,
          scope: "global",
          text: "x".repeat(1000),
        },
      ],
      skillBudgetTokens: 10,
    });
    expect(result.manifest.skills).toEqual([]);
    expect(result.manifest.dropped).toContain("big");
  });

  it("drops optional catalogue before failing", () => {
    const result = composePrompt({
      ...base,
      maxPromptTokens: 400,
      catalogue: "c".repeat(2000),
    });
    expect(result.manifest.dropped).toContain("catalogue");
  });

  it("fails when the required layers cannot fit", () => {
    try {
      composePrompt({ ...base, maxPromptTokens: 1 });
      throw new Error("expected composePrompt to throw");
    } catch (error) {
      expect(isAiError(error) && error.code === "AI_TOO_LONG").toBe(true);
    }
  });
});
