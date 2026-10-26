export type ProviderName = "fake" | "pesapal";

export type SubmitOrderInput = {
  merchantReference: string;
  amountCents: number;
  currency: string;
  description: string;
  callbackUrl: string;
  cancellationUrl?: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
};

export type SubmitOrderResult = {
  orderTrackingId: string;
  merchantReference: string;
  redirectUrl: string;
};

export type ProviderStatus =
  | "completed"
  | "failed"
  | "reversed"
  | "invalid"
  | "pending"
  | "unknown";

export type ProviderTransaction = {
  orderTrackingId: string;
  merchantReference: string;
  amountCents: number;
  currency: string;
  status: ProviderStatus;
  statusCode: number | null;
  description: string;
  method: string | null;
  confirmationCode: string | null;
  paidAt: string | null;
  rawStatus: string;
};

export type RefundInput = {
  orderTrackingId: string;
  confirmationCode: string;
  amountCents: number;
  currency: string;
  reason: string;
};

export type RefundResult = {
  providerReference: string;
  status: "processed" | "requested" | "failed";
  message: string;
};

export type IpnRegistration = {
  notificationId: string;
  url: string;
};

export interface PaymentProvider {
  name(): ProviderName;
  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  getTransactionStatus(orderTrackingId: string): Promise<ProviderTransaction>;
  refund(input: RefundInput): Promise<RefundResult>;
  registerIpn?(url: string): Promise<IpnRegistration>;
}

export class PaymentProviderError extends Error {
  code: string;
  status: number | null;

  constructor(message: string, code = "PAYMENT_PROVIDER_ERROR", status: number | null = null) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
    this.status = status;
  }
}

export function paymentProviderName(): ProviderName {
  const value = (process.env.PAYMENT_PROVIDER ?? "fake").toLowerCase();
  if (value === "pesapal" || value === "fake") return value;
  throw new PaymentProviderError(
    `Unknown PAYMENT_PROVIDER "${value}". Use "fake" or "pesapal".`,
    "PAYMENT_PROVIDER_INVALID",
  );
}

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_ORIGIN ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export class FakePaymentProvider implements PaymentProvider {
  name(): ProviderName {
    return "fake";
  }

  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    const orderTrackingId = `fake-${input.merchantReference}`;
    const url = new URL("/api/billing/fake/checkout", appOrigin());
    url.searchParams.set("ref", input.merchantReference);
    url.searchParams.set("tracking", orderTrackingId);
    return {
      orderTrackingId,
      merchantReference: input.merchantReference,
      redirectUrl: url.toString(),
    };
  }

  async getTransactionStatus(orderTrackingId: string): Promise<ProviderTransaction> {
    return {
      orderTrackingId,
      merchantReference: orderTrackingId.replace(/^fake-/, ""),
      amountCents: 0,
      currency: "USD",
      status: "pending",
      statusCode: null,
      description: "The fake provider confirms payments from its checkout page.",
      method: null,
      confirmationCode: null,
      paidAt: null,
      rawStatus: "PENDING",
    };
  }

  async refund(): Promise<RefundResult> {
    return {
      providerReference: `fake-refund-${Date.now()}`,
      status: "processed",
      message: "Fake refund completed.",
    };
  }

  async registerIpn(url: string): Promise<IpnRegistration> {
    return { notificationId: `fake-ipn-${Date.now()}`, url };
  }
}
