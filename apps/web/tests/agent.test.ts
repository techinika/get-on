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
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessage } from "@/components/agent/assistant-message";
import {
  VirtualizedMessageList,
  computeMessageLayout,
  estimateMessageHeight,
  findVisibleMessageRange,
  type VirtualChatMessage,
} from "@/components/agent/virtualized-message-list";

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

describe("assistant message markdown rendering", () => {
  it("terminates cleanly on unmatched parentheses, brackets, asterisks, and backticks", () => {
    const input = "Website (draft) with [unclosed bracket, *lonely star and `unclosed code";
    const html = renderToStaticMarkup(React.createElement(AssistantMessage, { text: input }));
    expect(html).toContain("Website (draft)");
    expect(html).toContain("[unclosed bracket");
  });

  it("renders valid links and strips javascript: link protocols", () => {
    const input =
      "Visit [Docs](https://get-on.tech/docs) and ignore [bad](javascript:alert(1)).";
    const html = renderToStaticMarkup(React.createElement(AssistantMessage, { text: input }));
    expect(html).toContain('href="https://get-on.tech/docs"');
    expect(html).not.toContain('href="javascript:');
  });

  it("renders headings, lists, bold, italic, and inline code cleanly", () => {
    const input = [
      "## Next steps",
      "",
      "- **Publish** your *home* page with `npm run build`",
      "- Review [settings](/dashboard)",
    ].join("\n");
    const html = renderToStaticMarkup(React.createElement(AssistantMessage, { text: input }));
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>Publish</strong>");
    expect(html).toContain("<em>home</em>");
    expect(html).toContain("<code");
    expect(html).toContain('href="/dashboard"');
  });

  it("handles pathological unclosed markdown in linear time without freezing", () => {
    const pathological = "**[unclosed ".repeat(1500) + "`code *star ".repeat(1500);
    const start = performance.now();
    const html = renderToStaticMarkup(
      React.createElement(AssistantMessage, { text: pathological }),
    );
    const elapsedMs = performance.now() - start;
    expect(html).toContain("[unclosed");
    expect(elapsedMs).toBeLessThan(250);
  });
});

describe("virtualized message list", () => {
  function makeHistory(count: number): VirtualChatMessage[] {
    return Array.from({ length: count }, (_, idx) => ({
      id: `msg-${idx}`,
      role: idx % 2 === 0 ? "user" : "assistant",
      content: `Message #${idx}: **hello** world`,
    }));
  }

  it("computes cumulative layout offsets and slices only visible range in O(log n)", () => {
    const history = makeHistory(2000);
    const measured = new Map<string, number>([
      ["msg-0", 80],
      ["msg-1", 120],
    ]);
    const layout = computeMessageLayout(history, measured, 360);

    expect(layout.offsets[0]).toBe(0);
    expect(layout.offsets[1]).toBe(80);
    expect(layout.offsets[2]).toBe(200);
    expect(layout.totalHeight).toBeGreaterThan(2000 * 50);

    const topRange = findVisibleMessageRange(layout.offsets, layout.sizes, 0, 500, 4);
    expect(topRange.startIndex).toBe(0);
    expect(topRange.endIndex).toBeLessThan(20);

    const midOffset = layout.offsets[1000]!;
    const midRange = findVisibleMessageRange(layout.offsets, layout.sizes, midOffset, 500, 4);
    expect(midRange.startIndex).toBeLessThanOrEqual(1000);
    expect(midRange.endIndex).toBeGreaterThanOrEqual(1000);
    expect(midRange.endIndex - midRange.startIndex).toBeLessThan(25);
  });

  it("scales height estimates for multiline content and credits", () => {
    const shortHeight = estimateMessageHeight({ content: "hi", credits: 0 }, 360);
    const longHeight = estimateMessageHeight(
      { content: "line\n".repeat(10), credits: 1 },
      360,
    );
    expect(longHeight).toBeGreaterThan(shortHeight);
  });

  it("renders only a small visible slice for 1,500 messages", () => {
    const history = makeHistory(1500);
    const html = renderToStaticMarkup(
      React.createElement(VirtualizedMessageList, {
        messages: history,
        stickTrigger: "0:0:0::0",
        loading: false,
        loadingState: null,
        emptyState: null,
        hasTrailingContent: false,
      }),
    );

    const renderedCount = (html.match(/data-virtual-id="/g) ?? []).length;
    expect(renderedCount).toBeGreaterThan(0);
    expect(renderedCount).toBeLessThan(30);
    expect(html).toContain("msg-1499");
    expect(html).not.toContain('data-virtual-id="msg-0"');
  });
});
