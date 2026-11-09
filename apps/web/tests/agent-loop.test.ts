import { describe, expect, it } from "vitest";
import {
  flowMissing,
  updateCreateSiteBriefSchema,
  generateSiteSchema,
} from "@/lib/agent/tools";
import { FakeAiProvider } from "@get-on/ai";

describe("create site brief schema", () => {
  it("accepts a complete brief", () => {
    const parsed = updateCreateSiteBriefSchema.safeParse({
      name: "Acme Bakery",
      address: "acme-bakery",
      businessType: "bakery",
      about: "Fresh bread in Kigali.",
      style: "Modern",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts partial input (fields are collected over turns)", () => {
    const parsed = updateCreateSiteBriefSchema.safeParse({
      address: "acme-bakery",
      businessType: "bakery",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an over-long business type", () => {
    const parsed = updateCreateSiteBriefSchema.safeParse({
      name: "Acme",
      address: "acme",
      businessType: "x".repeat(81),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("flow missing fields", () => {
  it("reports all missing fields for an empty brief", () => {
    expect(flowMissing({})).toEqual([
      "business name",
      "web address",
      "business type",
      "a few words about your business",
      "a style",
    ]);
  });

  it("reports no missing fields for a complete brief", () => {
    expect(
      flowMissing({
        name: "Acme",
        address: "acme",
        businessType: "bakery",
        about: "Fresh bread.",
        style: "Modern",
      }),
    ).toEqual([]);
  });
});

describe("generate site schema", () => {
  it("accepts an empty input (confirmation is decided by the server)", () => {
    const parsed = generateSiteSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts confirm true", () => {
    const parsed = generateSiteSchema.safeParse({ confirm: true });
    expect(parsed.success).toBe(true);
  });
});

describe("fake provider tool calling", () => {
  it("returns scripted tool calls in tool_calls mode", async () => {
    const provider = new FakeAiProvider({
      mode: "tool_calls",
      toolCalls: [
        {
          id: "call_1",
          name: "update_create_site_brief",
          arguments: { name: "Acme", address: "acme" },
        },
      ],
    });
    const result = await provider.chatWithTools({
      modelId: "test-model",
      messages: [{ role: "user", content: "create a site" }],
      tools: [],
      toolChoice: "auto",
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("update_create_site_brief");
    expect(result.text).toContain("set that up");
  });

  it("returns no tool calls by default", async () => {
    const provider = new FakeAiProvider();
    const result = await provider.chatWithTools({
      modelId: "test-model",
      messages: [{ role: "user", content: "hello" }],
      tools: [],
    });
    expect(result.toolCalls).toHaveLength(0);
    expect(typeof result.text).toBe("string");
  });
});
