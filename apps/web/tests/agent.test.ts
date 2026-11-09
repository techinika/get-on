import { describe, expect, it } from "vitest";
import {
  ASSISTANT_DEFAULT_WIDTH,
  ASSISTANT_MAX_WIDTH,
  ASSISTANT_MIN_WIDTH,
  asAssistantTab,
  assistantOpenFromCookie,
  assistantTabFromCookie,
  assistantWidthFromCookie,
  clampAssistantWidth,
} from "@/lib/agent/constants";
import { buildAgentPrompt, normaliseAgentContext } from "@/lib/agent/prompt";
import { chunkText, encodeSse } from "@/lib/agent/sse";
import type { AgentMessage } from "@/lib/agent/conversations";

function message(
  id: string,
  role: AgentMessage["role"],
  content: string,
): AgentMessage {
  return {
    id,
    role,
    content,
    credits: 0,
    requestId: null,
    createdAt: "2026-11-19T00:00:00.000Z",
  };
}

describe("assistant preferences", () => {
  it("clamps the dock width", () => {
    expect(clampAssistantWidth(undefined)).toBe(ASSISTANT_DEFAULT_WIDTH);
    expect(clampAssistantWidth("nope")).toBe(ASSISTANT_DEFAULT_WIDTH);
    expect(clampAssistantWidth(100)).toBe(ASSISTANT_MIN_WIDTH);
    expect(clampAssistantWidth(9999)).toBe(ASSISTANT_MAX_WIDTH);
    expect(clampAssistantWidth(400.6)).toBe(401);
  });

  it("reads the saved tab, open state and width", () => {
    expect(assistantOpenFromCookie("1")).toBe(true);
    expect(assistantOpenFromCookie("true")).toBe(true);
    expect(assistantOpenFromCookie("0")).toBe(false);
    expect(assistantTabFromCookie("help")).toBe("help");
    expect(assistantTabFromCookie("other")).toBe("assistant");
    expect(asAssistantTab("help")).toBe("help");
    expect(assistantWidthFromCookie("500")).toBe(500);
  });
});

describe("agent prompt", () => {
  it("keeps the current page context and latest messages", () => {
    const prompt = buildAgentPrompt(
      [
        message("1", "user", "Hello"),
        message("2", "assistant", "Hi there"),
        message("3", "user", "How do I publish?"),
      ],
      {
        teamName: "Acme",
        projectName: "Acme site",
        route: "/dashboard/projects/1/pages/2",
        pageTitle: "Home page",
      },
    );

    expect(prompt).toContain("Team: Acme");
    expect(prompt).toContain("Website: Acme site");
    expect(prompt).toContain("Current route: /dashboard/projects/1/pages/2");
    expect(prompt).toContain("Current page: Home page");
    expect(prompt.indexOf("User: Hello")).toBeLessThan(
      prompt.indexOf("User: How do I publish?"),
    );
  });

  it("drops system and tool messages and trims old history", () => {
    const prompt = buildAgentPrompt(
      [
        message("1", "user", "old"),
        message("2", "system", "secret"),
        message("3", "tool", "secret tool"),
        message("4", "user", "new"),
      ],
      { teamName: "", projectName: "", route: "", pageTitle: "" },
      10,
    );

    expect(prompt).not.toContain("secret");
    expect(prompt).not.toContain("old");
    expect(prompt).toContain("new");
  });

  it("normalises and limits browser context", () => {
    const context = normaliseAgentContext(
      {
        teamName: "  Acme   Ltd ",
        projectName: "x".repeat(200),
        route: "/dashboard",
        pageTitle: 42,
      },
      { teamName: "Fallback", projectName: "", route: "", pageTitle: "Fallback page" },
    );

    expect(context.teamName).toBe("Acme Ltd");
    expect(context.projectName).toHaveLength(120);
    expect(context.pageTitle).toBe("Fallback page");
  });
});

describe("agent stream", () => {
  it("encodes named SSE events", () => {
    expect(encodeSse("delta", { text: "hi" })).toBe(
      'event: delta\ndata: {"text":"hi"}\n\n',
    );
  });

  it("chunks text without losing characters", () => {
    const text = "a".repeat(70);
    const chunks = chunkText(text, 32);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(text);
    expect(chunkText("")).toEqual([]);
  });
});
