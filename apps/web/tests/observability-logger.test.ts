import { describe, expect, it } from "vitest";
import { emailLogger, redact, traceId } from "@/lib/observability/logger";

function captureWrite(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const orig = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  return { writes, restore: () => (process.stdout.write = orig) };
}

describe("email observability logger", () => {
  it("masks full email addresses", () => {
    expect(redact("Contact alice@example.com now")).not.toContain("alice@example.com");
    expect(redact("Contact alice@example.com now")).toContain("al***@example.com");
    expect(redact({ to: "bob.smith@mycorp.co.uk", note: "hi" })).toMatchObject({
      to: "bo***@mycorp.co.uk",
      note: "hi",
    });
    // multiple addresses
    expect(redact("a@b.com and c@d.com")).not.toContain("a@b.com");
    expect(redact("a@b.com and c@d.com")).not.toContain("c@d.com");
  });

  it("redacts secret keys and links but keeps safe strings", () => {
    expect(
      redact({ code: "123456", token: "abc", url: "https://example.com/x", safe: "hello" }),
    ).toMatchObject({
      code: "[redacted]",
      token: "[redacted]",
      url: "[redacted]",
      safe: "hello",
    });
    expect(redact({ authorization: "Bearer secret" })).toMatchObject({
      authorization: "[redacted]",
    });
    expect(redact({ password: "hunter2", link: "https://reset?t=1" })).toMatchObject({
      password: "[redacted]",
      link: "[redacted]",
    });
    expect(redact({ subject: "Your code", body: "plain text" })).toMatchObject({
      subject: "Your code",
      body: "plain text",
    });
    // nested objects are redacted too
    expect(redact({ nested: { token: "x", password: "y" }, safe: [1, 2, 3] })).toMatchObject({
      nested: { token: "[redacted]", password: "[redacted]" },
      safe: [1, 2, 3],
    });
  });

  it("emits a dev coloured single line with standard fields", () => {
    const { writes, restore } = captureWrite();
    emailLogger.warn({
      stage: "outbox.skipped",
      reason: "suppressed",
      toMasked: "a***@gmail.com",
      code: "SUPPRESSED",
      msg: "skipped",
    });
    restore();
    const joined = writes.join("");
    expect(joined).toContain("stage=outbox.skipped");
    expect(joined).toContain("reason=suppressed");
    expect(joined).toContain("to=a***@gmail.com");
    expect(joined).toContain("code=SUPPRESSED");
    expect(joined).toContain("msg=skipped");
  });

  it("emits production JSON with standard fields", () => {
    const orig = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const { writes, restore } = captureWrite();
    emailLogger.info({
      stage: "ses.send.response",
      msg: "sent",
      messageId: "msg-1",
      durationMs: 412,
    });
    restore();
    (process.env as { NODE_ENV?: string }).NODE_ENV = orig;
    const joined = writes.join("");
    const parsed = JSON.parse(joined.trim().split("\n").pop() ?? "{}");
    expect(parsed.level).toBe("info");
    expect(parsed.stage).toBe("ses.send.response");
    expect(parsed.message_id).toBe("msg-1");
    expect(parsed.duration_ms).toBe(412);
    // no raw full email in JSON
    expect(joined).not.toContain("alice@example.com");
  });

  it("error level writes to stderr", () => {
    const errWrites: string[] = [];
    const orig = process.stderr.write;
    process.stderr.write = ((chunk: unknown) => {
      errWrites.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    emailLogger.error({ msg: "boom", code: "E1" });
    process.stderr.write = orig;
    const joined = errWrites.join("");
    expect(joined).toContain("boom");
    expect(joined).toContain("E1");
  });

  it("traceId returns a unique non-empty id", () => {
    const a = traceId();
    const b = traceId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("child logger inherits bindings and can override", () => {
    const { writes, restore } = captureWrite();
    const child = emailLogger.child({ service: "contact-form", template: "contact_notification" });
    child.info({ stage: "trigger" });
    restore();
    const joined = writes.join("");
    expect(joined).toContain("svc=contact-form");
    expect(joined).toContain("template=contact_notification");
    expect(joined).toContain("stage=trigger");
  });
});
