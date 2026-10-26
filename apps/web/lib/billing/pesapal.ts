import {
  PaymentProviderError,
  type IpnRegistration,
  type PaymentProvider,
  type ProviderName,
  type ProviderStatus,
  type ProviderTransaction,
  type RefundInput,
  type RefundResult,
  type SubmitOrderInput,
  type SubmitOrderResult,
} from "./provider";

const SANDBOX = "https://cybqa.pesapal.com/pesapalv3/api";
const LIVE = "https://pay.pesapal.com/v3/api";
const TOKEN_SAFETY_MS = 4 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

type PesapalConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  notificationId: string;
};

type TokenResponse = {
  token?: string;
  expiryDate?: string;
  error?: string | null;
  status?: string;
};

type SubmitOrderResponse = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
  error?: { code?: string; message?: string } | null;
  status?: string;
};

type StatusResponse = {
  payment_method?: string;
  amount?: number | string;
  created_date?: string;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  message?: string;
  payment_account?: string;
  call_back_url?: string;
  status_code?: number;
  merchant_reference?: string;
  order_tracking_id?: string;
  currency?: string;
  error?: { code?: string; message?: string } | null;
  status?: string;
};

type RefundResponse = {
  status?: string;
  message?: string;
  error?: { code?: string; message?: string } | null;
};

type IpnResponse = {
  ipn_id?: string;
  url?: string;
  error?: { code?: string; message?: string } | null;
  status?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function readConfig(notificationId?: string | null): PesapalConfig {
  const env = (process.env.PESAPAL_ENV ?? "").toLowerCase();
  if (env !== "sandbox" && env !== "live") {
    throw new PaymentProviderError(
      "PESAPAL_ENV must be sandbox or live.",
      "PESAPAL_ENV_INVALID",
    );
  }
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim() ?? "";
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim() ?? "";
  if (!consumerKey || !consumerSecret) {
    throw new PaymentProviderError(
      "Pesapal credentials are missing.",
      "PESAPAL_CREDENTIALS_MISSING",
    );
  }
  return {
    baseUrl: env === "live" ? LIVE : SANDBOX,
    consumerKey,
    consumerSecret,
    notificationId:
      notificationId?.trim() || (process.env.PESAPAL_IPN_ID?.trim() ?? ""),
  };
}

function minorToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function majorToMinor(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function mapStatus(code: number | undefined): ProviderStatus {
  switch (code) {
    case 1:
      return "completed";
    case 2:
      return "failed";
    case 3:
      return "reversed";
    case 0:
      return "invalid";
    default:
      return "unknown";
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  errorCode: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      throw new PaymentProviderError(
        `Pesapal returned HTTP ${response.status}.`,
        errorCode,
        response.status,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    if ((error as { name?: string })?.name === "AbortError") {
      throw new PaymentProviderError("Pesapal timed out.", "PESAPAL_TIMEOUT");
    }
    throw new PaymentProviderError(
      "Could not reach Pesapal.",
      "PESAPAL_NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}

export class PesapalPaymentProvider implements PaymentProvider {
  private config: PesapalConfig;

  constructor(notificationId?: string | null, config: PesapalConfig = readConfig(notificationId)) {
    this.config = config;
  }

  name(): ProviderName {
    return "pesapal";
  }

  private async token(force = false): Promise<string> {
    if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.value;
    }
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const body = await requestJson<TokenResponse>(
        `${this.config.baseUrl}/Auth/RequestToken`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consumer_key: this.config.consumerKey,
            consumer_secret: this.config.consumerSecret,
          }),
        },
        "PESAPAL_TOKEN_FAILED",
      );
      if (!body?.token) {
        throw new PaymentProviderError(
          body?.error ?? "Pesapal did not return a token.",
          "PESAPAL_TOKEN_FAILED",
        );
      }
      const expiry = body.expiryDate ? Date.parse(body.expiryDate) : 0;
      const now = Date.now();
      const expiresAt =
        Number.isFinite(expiry) && expiry > now
          ? Math.max(now + 30_000, expiry - 30_000)
          : now + TOKEN_SAFETY_MS;
      cachedToken = { value: body.token, expiresAt };
      return body.token;
    })();
    try {
      return await tokenRequest;
    } finally {
      tokenRequest = null;
    }
  }

  private async authorized<T>(
    path: string,
    init: RequestInit,
    errorCode: string,
  ): Promise<T> {
    let token = await this.token();
    const run = (bearer: string) =>
      requestJson<T>(
        `${this.config.baseUrl}${path}`,
        {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${bearer}`,
          },
        },
        errorCode,
      );
    try {
      return await run(token);
    } catch (error) {
      if (error instanceof PaymentProviderError && error.status === 401) {
        cachedToken = null;
        token = await this.token(true);
        return run(token);
      }
      throw error;
    }
  }

  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    const notificationId = this.config.notificationId;
    if (!notificationId) {
      throw new PaymentProviderError(
        "Pesapal IPN is not registered.",
        "PESAPAL_IPN_MISSING",
      );
    }
    const [firstName, ...rest] = String(input.name ?? "").trim().split(/\s+/);
    const body = await this.authorized<SubmitOrderResponse>(
      "/Transactions/SubmitOrderRequest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: input.merchantReference,
          currency: input.currency,
          amount: minorToMajor(input.amountCents),
          description: input.description.slice(0, 100),
          callback_url: input.callbackUrl,
          cancellation_url: input.cancellationUrl ?? input.callbackUrl,
          notification_id: notificationId,
          billing_address: {
            email_address: input.email ?? undefined,
            phone_number: input.phone ?? undefined,
            first_name: firstName || undefined,
            last_name: rest.join(" ") || undefined,
          },
        }),
      },
      "PESAPAL_SUBMIT_FAILED",
    );
    if (!body?.redirect_url || !body?.order_tracking_id) {
      throw new PaymentProviderError(
        body?.error?.message ?? "Pesapal did not return a checkout URL.",
        "PESAPAL_SUBMIT_FAILED",
      );
    }
    return {
      orderTrackingId: body.order_tracking_id,
      merchantReference: body.merchant_reference ?? input.merchantReference,
      redirectUrl: body.redirect_url,
    };
  }

  async getTransactionStatus(orderTrackingId: string): Promise<ProviderTransaction> {
    const body = await this.authorized<StatusResponse>(
      `/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
      { method: "GET" },
      "PESAPAL_STATUS_FAILED",
    );
    return {
      orderTrackingId: body?.order_tracking_id ?? orderTrackingId,
      merchantReference: body?.merchant_reference ?? "",
      amountCents: majorToMinor(body?.amount),
      currency: String(body?.currency ?? "").toUpperCase(),
      status: mapStatus(body?.status_code),
      statusCode: typeof body?.status_code === "number" ? body.status_code : null,
      description: String(body?.payment_status_description ?? body?.description ?? ""),
      method: body?.payment_method ?? null,
      confirmationCode: body?.confirmation_code ?? null,
      paidAt: body?.created_date ?? null,
      rawStatus: String(body?.payment_status_description ?? ""),
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const body = await this.authorized<RefundResponse>(
      "/Transactions/RefundRequest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_code: input.confirmationCode || input.orderTrackingId,
          amount: minorToMajor(input.amountCents),
          currency: input.currency,
          username: "Get-On",
          remarks: input.reason.slice(0, 200),
        }),
      },
      "PESAPAL_REFUND_FAILED",
    );
    if (body?.error) {
      return {
        providerReference: "",
        status: "failed",
        message: body.error.message ?? "Pesapal refund failed.",
      };
    }
    const status = String(body?.status ?? "").toLowerCase();
    return {
      providerReference: `pesapal-refund-${Date.now()}`,
      status: status === "failed" ? "failed" : status === "pending" ? "requested" : "processed",
      message: body?.message ?? "Refund recorded.",
    };
  }

  async registerIpn(url: string): Promise<IpnRegistration> {
    const body = await this.authorized<IpnResponse>(
      "/URLSetup/RegisterIPN",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ipn_notification_type: "POST" }),
      },
      "PESAPAL_IPN_FAILED",
    );
    if (!body?.ipn_id) {
      throw new PaymentProviderError(
        body?.error?.message ?? "Pesapal did not return an IPN id.",
        "PESAPAL_IPN_FAILED",
      );
    }
    return { notificationId: body.ipn_id, url: body.url ?? url };
  }
}
