import { describe, expect, it } from "vitest";
import { invoicePdf } from "@/lib/billing/pdf";

describe("invoice PDF", () => {
  it("builds a one-page PDF with the invoice details", () => {
    const bytes = invoicePdf({
      invoice: {
        number: "GO-2026-000001",
        status: "paid",
        currency: "USD",
        total_cents: 15109,
        subtotal_cents: 16788,
        discount_cents: 1679,
        tax_cents: 0,
        plan_id: "pro",
        months: 12,
        created_at: "2026-10-26T00:00:00Z",
        due_at: "2026-10-26T00:00:00Z",
        billing_name: "Rose Bakery",
        billing_email: "owner@example.com",
      },
      lines: [{ id: "line-1", description: "Pro plan, 1 year", amount_cents: 16788 }],
      teamName: "Rose Bakery",
    });
    const pdf = Buffer.from(bytes).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("GO-2026-000001");
    expect(pdf).toContain("Pro plan, 1 year");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
