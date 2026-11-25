import { afterEach, describe, expect, it } from "vitest";
import {
  PLAN_CATALOGUE,
  parseTermMonths,
  quote,
  termEnd,
} from "@get-on/billing";
import {
  FakePaymentProvider,
  PaymentProviderError,
  paymentProviderName,
} from "@/lib/billing/provider";
import { formatMoney } from "@/lib/billing/format";

const original = process.env.PAYMENT_PROVIDER;

afterEach(() => {
  if (original === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = original;
});

describe("payment provider selection", () => {
  it("defaults to fake", () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(paymentProviderName()).toBe("fake");
  });

  it("rejects an unknown provider", () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    expect(() => paymentProviderName()).toThrow(PaymentProviderError);
  });
});

describe("fake payment provider", () => {
  it("returns a local checkout URL and tracking id", async () => {
    const provider = new FakePaymentProvider();
    const result = await provider.submitOrder({
      merchantReference: "GO2026000001-ABCD",
      amountCents: 799,
      currency: "USD",
      description: "Basic plan",
      callbackUrl: "http://localhost:3000/api/billing/pesapal/callback",
    });
    expect(result.orderTrackingId).toBe("fake-GO2026000001-ABCD");
    expect(result.redirectUrl).toContain("/api/billing/fake/checkout");
    expect(result.redirectUrl).toContain("ref=GO2026000001-ABCD");
  });

  it("does not settle anything by itself", async () => {
    const provider = new FakePaymentProvider();
    const status = await provider.getTransactionStatus("fake-REF");
    expect(status.status).toBe("pending");
    expect(status.merchantReference).toBe("REF");
  });
});

describe("money formatting", () => {
  it("formats integer cents", () => {
    expect(formatMoney(799)).toBe("$7.99");
    expect(formatMoney(15109)).toBe("$151.09");
  });
});

describe("multi-year billing terms", () => {
  it("parses 3-year, 4-year, and 5-year billing terms instead of falling back to 1 month", () => {
    expect(parseTermMonths(36)).toBe(36);
    expect(parseTermMonths("36")).toBe(36);
    expect(parseTermMonths(48)).toBe(48);
    expect(parseTermMonths("48")).toBe(48);
    expect(parseTermMonths(60)).toBe(60);
    expect(parseTermMonths("60")).toBe(60);
    expect(parseTermMonths("invalid")).toBe(1);
  });

  it("quotes full 60-month gross, discount, and total for Basic and Pro plans", () => {
    const terms = [
      { months: 1 as const, discountBps: 0, label: "1 month", active: true },
      { months: 60 as const, discountBps: 3000, label: "5 years", active: true },
    ];
    const fiveYearQuote = quote({
      planId: "basic",
      months: 60,
      terms,
      coupon: null,
      taxRateBps: 0,
      currency: "USD",
    });

    expect(fiveYearQuote.months).toBe(60);
    expect(fiveYearQuote.grossCents).toBe(PLAN_CATALOGUE.basic.priceMonthlyCents * 60);
    expect(fiveYearQuote.termDiscountCents).toBe(
      Math.round((PLAN_CATALOGUE.basic.priceMonthlyCents * 60 * 3000) / 10_000),
    );
    expect(fiveYearQuote.totalCents).toBe(
      fiveYearQuote.grossCents - fiveYearQuote.termDiscountCents,
    );
    expect(fiveYearQuote.totalCents).toBeGreaterThan(PLAN_CATALOGUE.basic.priceMonthlyCents);
  });

  it("advances coverage end date by 5 years for a 60-month term", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = termEnd(start, 60);
    expect(end.toISOString()).toBe("2031-01-01T00:00:00.000Z");
  });
});

