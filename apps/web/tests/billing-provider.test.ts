import { afterEach, describe, expect, it } from "vitest";
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
