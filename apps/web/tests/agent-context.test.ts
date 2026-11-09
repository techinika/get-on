import { describe, expect, it } from "vitest";
import { buildAgentPrompt, normaliseAgentContext } from "@/lib/agent/prompt";

describe("assistant project context", () => {
  it("normalises optional site context", () => {
    const context = normaliseAgentContext(
      {
        siteState: "  live  ",
        published: "no",
        hasUnpublishedChanges: "yes",
        pageCount: "two",
        primaryAddress: "https://example.com",
        tagline: "   Acme   Co   ",
      },
      {
        teamName: "Fallback Team",
        projectName: "Fallback Site",
        route: "/",
        pageTitle: "Home",
      },
    );

    expect(context.siteState).toBe("live");
    expect(context.published).toBeUndefined();
    expect(context.hasUnpublishedChanges).toBeUndefined();
    expect(context.pageCount).toBeUndefined();
    expect(context.primaryAddress).toBe("https://example.com");
    expect(context.tagline).toBe("Acme Co");
  });

  it("uses fallback when client context is missing", () => {
    const context = normaliseAgentContext(null, {
      teamName: "Fallback Team",
      projectName: "Fallback Site",
      route: "/",
      pageTitle: "Home",
      siteState: "draft",
      published: false,
    });

    expect(context.teamName).toBe("Fallback Team");
    expect(context.siteState).toBe("draft");
    expect(context.published).toBe(false);
  });

  it("renders read-only site context in the prompt", () => {
    const prompt = buildAgentPrompt(
      [
        {
          id: "1",
          role: "user",
          content: "Is my site live?",
          credits: 0,
          requestId: null,
          createdAt: "2026-11-20T00:00:00.000Z",
        },
      ],
      {
        teamName: "Acme",
        projectName: "Acme site",
        route: "/dashboard/projects/1",
        pageTitle: "Home",
        siteState: "live",
        published: true,
        hasUnpublishedChanges: false,
        pageCount: 3,
        primaryAddress: "https://acme.example.com",
        tagline: "Great cookies",
      },
    );

    expect(prompt).toContain("Team: Acme");
    expect(prompt).toContain("Website: Acme site");
    expect(prompt).toContain("Address: https://acme.example.com");
    expect(prompt).toContain("Tagline: Great cookies");
    expect(prompt).toContain("Site state: live");
    expect(prompt).toContain("Published: yes");
    expect(prompt).toContain("Unpublished changes: no");
    expect(prompt).toContain("Pages: 3");
  });
});
