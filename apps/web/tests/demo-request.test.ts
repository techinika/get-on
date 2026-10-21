import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "@/lib/demo-request";

const valid = {
  fullName: "Rose Baker",
  email: "rose@example.com",
  phone: "+27 82 123 4567",
  businessName: "Rose Bakery",
  businessType: "Restaurant or cafe",
  websitesNeeded: "1",
  meetingMethod: "video",
  preferredTime: "morning",
  timezone: "Africa/Johannesburg",
  message: "I want a simple site for my bakery.",
  consent: true,
};

describe("demo request schema", () => {
  it("accepts a complete request", () => {
    const result = demoRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("trims the text before checking it", () => {
    const result = demoRequestSchema.safeParse({ ...valid, fullName: "  Rose Baker  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Rose Baker");
  });

  it("rejects a name that is too short", () => {
    const result = demoRequestSchema.safeParse({ ...valid, fullName: "R" });
    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = demoRequestSchema.safeParse({ ...valid, fullName: "a".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = demoRequestSchema.safeParse({ ...valid, email: "rose@" });
    expect(result.success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    const result = demoRequestSchema.safeParse({
      ...valid,
      email: `${"a".repeat(250)}@example.com`,
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty phone number", () => {
    const result = demoRequestSchema.safeParse({ ...valid, phone: "  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeUndefined();
  });

  it("rejects a phone number with letters", () => {
    const result = demoRequestSchema.safeParse({ ...valid, phone: "call me" });
    expect(result.success).toBe(false);
  });

  it("rejects a message longer than 500 characters", () => {
    const result = demoRequestSchema.safeParse({ ...valid, message: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects a request without consent", () => {
    const result = demoRequestSchema.safeParse({ ...valid, consent: false });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown number of websites", () => {
    const result = demoRequestSchema.safeParse({ ...valid, websitesNeeded: "many" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown meeting method", () => {
    const result = demoRequestSchema.safeParse({ ...valid, meetingMethod: "carrier pigeon" });
    expect(result.success).toBe(false);
  });
});
