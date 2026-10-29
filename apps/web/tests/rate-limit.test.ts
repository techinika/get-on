import { describe, expect, it } from "vitest";
import { decide } from "@/lib/security/rate-limit";

describe("rate-limit decide", () => {
  const policy = { limit: 3, windowSeconds: 60, blockSeconds: 60 };

  it("allows up to limit", () => {
    let state: Parameters<typeof decide>[1] = null;
    const now = 1000;
    for (let i = 0; i < 3; i++) {
      const r = decide(now + i, state, policy);
      state = r.state;
      expect(r.result.ok).toBe(true);
    }
  });

  it("blocks after limit", () => {
    let state: Parameters<typeof decide>[1] = null;
    const now = 1000;
    for (let i = 0; i < 3; i++) {
      const r = decide(now, state, policy);
      state = r.state;
    }
    const r = decide(now, state, policy);
    expect(r.result.ok).toBe(false);
    expect(r.result.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window", () => {
    let state: Parameters<typeof decide>[1] = null;
    const now = 1000;
    for (let i = 0; i < 3; i++) {
      const r = decide(now, state, policy);
      state = r.state;
    }
    const r = decide(now + 61_000, state, policy);
    expect(r.result.ok).toBe(true);
  });

  it("honours active block", () => {
    let state: Parameters<typeof decide>[1] = null;
    const now = 1000;
    for (let i = 0; i < 4; i++) {
      const r = decide(now, state, policy);
      state = r.state;
    }
    const r = decide(now + 1000, state, policy);
    expect(r.result.ok).toBe(false);
  });
});
