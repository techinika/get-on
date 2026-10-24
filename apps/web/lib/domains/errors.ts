export const DOMAIN_ERROR_CODES = [
  "DOMAIN_INVALID",
  "DOMAIN_BLOCKED",
  "DOMAIN_PLAN",
  "DOMAIN_LIMIT_REACHED",
  "DOMAIN_STARTS_TODAY",
  "DOMAIN_NOT_VERIFIED",
  "DOMAIN_VERIFICATION_EXPIRED",
  "DOMAIN_REVIEW_PENDING",
  "DOMAIN_ALREADY_CONNECTED",
  "DOMAIN_NOT_CONNECTED",
  "DOMAIN_PAUSED",
  "HOSTNAME_TAKEN",
  "HOSTNAME_LIMIT",
  "PROJECT_BUSY",
  "DNS_LOOKUP_FAILED",
  "PROVIDER_ERROR",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_NOT_CONFIGURED",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const MESSAGES: Record<DomainErrorCode, string> = {
  DOMAIN_INVALID: "That does not look like a domain. Enter one like yourbusiness.com.",
  DOMAIN_BLOCKED: "This domain cannot be connected. Contact us if you think this is a mistake.",
  DOMAIN_PLAN: "Your own domain is included from the Basic plan.",
  DOMAIN_LIMIT_REACHED: "Your plan has no room for another domain on this website.",
  DOMAIN_STARTS_TODAY: "You have started too many domains today. Try again tomorrow.",
  DOMAIN_NOT_VERIFIED: "Add the verification record first, then check again.",
  DOMAIN_VERIFICATION_EXPIRED: "Check your verification record again before adding another address.",
  DOMAIN_REVIEW_PENDING: "We need to take a quick look at this domain before you continue.",
  DOMAIN_ALREADY_CONNECTED: "This domain is already connected to a website.",
  DOMAIN_NOT_CONNECTED: "This domain is not connected to a website yet.",
  DOMAIN_PAUSED: "This website is taking a break.",
  HOSTNAME_TAKEN: "That address is already connected to a website.",
  HOSTNAME_LIMIT: "Each domain can have one main address and one extra address.",
  PROJECT_BUSY: "We are finishing another change on this website. Try again in a moment.",
  DNS_LOOKUP_FAILED: "We could not check your DNS settings. Try again in a moment.",
  PROVIDER_ERROR: "We could not connect this domain right now. Try again in a few minutes.",
  PROVIDER_UNAVAILABLE: "Our domain service is unavailable. Try again shortly.",
  PROVIDER_RATE_LIMITED: "We are handling a lot of domain checks. Try again in a few minutes.",
  PROVIDER_NOT_CONFIGURED: "Domain connections are not set up yet.",
};

export function isDomainErrorCode(value: string): value is DomainErrorCode {
  return (DOMAIN_ERROR_CODES as readonly string[]).includes(value);
}

export function domainErrorMessage(
  code: DomainErrorCode,
  values?: { plan?: string; limit?: number },
): string {
  if (code === "DOMAIN_LIMIT_REACHED" && values?.limit != null) {
    const plan = values.plan ? `${values.plan} plan` : "plan";
    return `Your ${plan} includes ${values.limit} domain${values.limit === 1 ? "" : "s"} for each website.`;
  }
  return MESSAGES[code];
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? domainErrorMessage(code));
    this.name = "DomainError";
    this.code = code;
  }
}

export class ProviderError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    code: DomainErrorCode,
    options: { status?: number | null; retryable?: boolean; message?: string } = {},
  ) {
    super(options.message ?? domainErrorMessage(code));
    this.name = "ProviderError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

/** Turns a database RPC message into a stable code without leaking details. */
export function domainCodeFromMessage(message: string | undefined): DomainErrorCode {
  const text = message ?? "";
  for (const code of DOMAIN_ERROR_CODES) {
    if (text.includes(code)) return code;
  }
  return "DOMAIN_INVALID";
}

export function asDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (error instanceof ProviderError) {
    return new DomainError(error.code, error.message);
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return new DomainError(domainCodeFromMessage(message));
}
