import { describe, expect, it } from "vitest";
import { normalizeTotpCode, totpQrSource } from "@/lib/admin/mfa";

describe("staff authenticator setup", () => {
  it("keeps only six digits from typed codes", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("123-456")).toBe("123456");
    expect(normalizeTotpCode("123456789")).toBe("123456");
    expect(normalizeTotpCode("code 12a34b56")).toBe("123456");
    expect(normalizeTotpCode("")).toBe("");
  });

  it("turns Supabase SVG markup into an image source", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
    expect(totpQrSource(svg)).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
  });

  it("keeps an existing data image source", () => {
    const source = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E";
    expect(totpQrSource(source)).toBe(source);
  });
});
