import { describe, expect, it } from "vitest";
import { isAiError } from "../src/errors";
import { FakeAiProvider } from "../src/providers/fake";

const textInput = {
  modelId: "test-model",
  messages: [{ role: "user" as const, content: "Write a headline" }],
};

describe("fake provider", () => {
  it("is deterministic for the same input", async () => {
    const provider = new FakeAiProvider();
    const first = await provider.generateText(textInput);
    const second = await provider.generateText(textInput);
    expect(first.value).toBe(second.value);
    expect(first.usage.inputTokens).toBeGreaterThan(0);
  });

  it("simulates timeouts and rate limits", async () => {
    await expect(
      new FakeAiProvider({ mode: "timeout" }).generateText(textInput),
    ).rejects.toSatisfy((error) => isAiError(error) && error.code === "AI_TIMEOUT");
    await expect(
      new FakeAiProvider({ mode: "rate_limit" }).generateText(textInput),
    ).rejects.toSatisfy(
      (error) => isAiError(error) && error.code === "AI_RATE_LIMIT",
    );
  });

  it("simulates invalid structured output and refusals", async () => {
    await expect(
      new FakeAiProvider({ mode: "invalid_json" }).generateStructured({
        ...textInput,
        schemaName: "Test",
      }),
    ).rejects.toSatisfy(
      (error) => isAiError(error) && error.code === "AI_BAD_RESULT",
    );

    const refusal = await new FakeAiProvider({
      mode: "refusal",
    }).generateStructured({ ...textInput, schemaName: "Test" });
    expect(refusal.value).toMatchObject({ refusal: { reason: expect.any(String) } });
  });

  it("returns a usable design interpretation for design schemas", async () => {
    const result = await new FakeAiProvider().generateStructured({
      ...textInput,
      schemaName: "design_restyle",
    });
    expect(result.value).toMatchObject({
      requirements: [],
      palette: {},
      fonts: {},
      layout: {},
      sections: { include: [], exclude: [] },
      pages: { include: [], exclude: [] },
      unsupported: [],
      confidence: 0.5,
    });
  });

  it("returns usable slot text for template and site generation", async () => {
    const result = await new FakeAiProvider().generateStructured({
      modelId: "test-model",
      schemaName: "site_generation",
      messages: [
        {
          role: "user" as const,
          content: JSON.stringify({ slots: [{ id: "hero:heading", text: "Sample" }] }),
        },
      ],
    });
    expect(result.value).toMatchObject({
      slots: [{ id: "hero:heading", text: expect.any(String) }],
    });
  });

  it("returns safe and unsafe moderation results", async () => {
    const safe = await new FakeAiProvider().moderate({
      modelId: "guard",
      text: "Hello",
    });
    const unsafe = await new FakeAiProvider({ mode: "unsafe" }).moderate({
      modelId: "guard",
      text: "Unsafe",
    });
    expect(safe.safe).toBe(true);
    expect(unsafe.safe).toBe(false);
    expect(unsafe.categories).toContain("S1");
  });

  it("returns a fake image", async () => {
    const result = await new FakeAiProvider().generateImage({
      modelId: "image",
      prompt: "A bakery",
      width: 512,
      height: 512,
      steps: 4,
    });
    expect(result.imageBase64).toBeTruthy();
    expect(result.mime).toBe("image/png");
    expect(result.usage.images).toBe(1);
  });
});
