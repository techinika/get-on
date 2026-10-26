import { describe, expect, it } from "vitest";
import {
  AiError,
  aiErrorMessage,
  isAiError,
  toAiError,
} from "../src/errors";

describe("AI errors", () => {
  it("maps provider status and codes", () => {
    expect(toAiError({ status: 408 }).code).toBe("AI_TIMEOUT");
    expect(toAiError({ code: 3006 }).code).toBe("AI_TOO_LONG");
    expect(toAiError({ code: 3036 }).code).toBe("AI_RATE_LIMIT");
    expect(toAiError({ code: 3040 }).code).toBe("AI_BUSY");
    expect(toAiError({ status: 403 }).code).toBe("AI_PROVIDER_ERROR");
    expect(toAiError({ status: 400 }).code).toBe("AI_PROVIDER_ERROR");
  });

  it("maps JSON mode failures", () => {
    expect(
      toAiError({ message: "JSON Mode couldn't be met" }).code,
    ).toBe("AI_BAD_RESULT");
  });

  it("keeps existing AI errors", () => {
    const error = new AiError("AI_BUSY");
    expect(toAiError(error)).toBe(error);
    expect(isAiError(error)).toBe(true);
  });

  it("marks retryable errors", () => {
    expect(new AiError("AI_TIMEOUT").retryable).toBe(true);
    expect(new AiError("AI_BUSY").retryable).toBe(true);
    expect(new AiError("AI_REFUSED").retryable).toBe(false);
  });

  it("fills plain-language messages", () => {
    expect(aiErrorMessage("AI_NO_CREDITS", { n: 2, m: 5 })).toContain(
      "You have 2 and this needs about 5.",
    );
  });
});
