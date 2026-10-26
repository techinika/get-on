export const AI_ERROR_CODES = [
  "AI_NO_CREDITS",
  "AI_MEMBER_CAP",
  "AI_RATE_LIMIT",
  "AI_DAILY_ACTIONS",
  "AI_DAILY_CAP",
  "AI_DISABLED",
  "AI_REFUSED",
  "AI_BAD_RESULT",
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "AI_TOO_LONG",
  "AI_BUSY",
  "AI_IMAGES_OFF",
  "AI_PLAN_INACTIVE",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NO_CREDITS:
    "You do not have enough AI credits for this. You have {n} and this needs about {m}.",
  AI_MEMBER_CAP:
    "You have reached your monthly AI limit set by your team owner.",
  AI_RATE_LIMIT: "You are going a little fast. Please wait a moment.",
  AI_DAILY_ACTIONS:
    "You have used today's AI actions for your plan. Try again tomorrow.",
  AI_DAILY_CAP: "AI is very busy today. Please try again later.",
  AI_DISABLED: "AI is paused for a short while. You can still write by hand.",
  AI_REFUSED:
    "We cannot help with that request. Please try different words.",
  AI_BAD_RESULT:
    "AI could not make something good enough. You were not charged.",
  AI_TIMEOUT: "That took too long. You were not charged. Please try again.",
  AI_PROVIDER_ERROR: "AI is not available right now. You were not charged.",
  AI_TOO_LONG: "That is too long for AI to work with. Try a shorter piece.",
  AI_BUSY: "AI is already working on this website. Please wait a moment.",
  AI_IMAGES_OFF: "AI pictures are not available yet.",
  AI_PLAN_INACTIVE:
    "Your plan is not active right now. Renew it to use AI again.",
};

const RETRYABLE = new Set<AiErrorCode>([
  "AI_RATE_LIMIT",
  "AI_TIMEOUT",
  "AI_BUSY",
  "AI_PROVIDER_ERROR",
]);

export type AiErrorOptions = {
  cause?: unknown;
  status?: number;
  providerCode?: string;
  details?: Record<string, string | number>;
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly providerCode?: string;
  readonly details: Record<string, string | number>;

  constructor(code: AiErrorCode, options: AiErrorOptions = {}) {
    super(AI_ERROR_MESSAGES[code], { cause: options.cause });
    this.name = "AiError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
    this.status = options.status;
    this.providerCode = options.providerCode;
    this.details = options.details ?? {};
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

export function aiErrorMessage(
  code: AiErrorCode,
  values: Record<string, string | number> = {},
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) =>
      message.replaceAll(`{${key}}`, String(value)),
    AI_ERROR_MESSAGES[code],
  );
}

type ProviderFailure = {
  status?: number;
  statusCode?: number;
  code?: string | number;
  providerCode?: string | number;
  message?: string;
  error?: { message?: string; code?: string | number };
};

function asProviderFailure(value: unknown): ProviderFailure {
  return typeof value === "object" && value !== null
    ? (value as ProviderFailure)
    : {};
}

export function toAiError(value: unknown): AiError {
  if (isAiError(value)) return value;

  const failure = asProviderFailure(value);
  const status = Number(failure.status ?? failure.statusCode ?? 0);
  const code = String(
    failure.code ?? failure.providerCode ?? failure.error?.code ?? "",
  );
  const message =
    failure.message ?? failure.error?.message ?? (value instanceof Error ? value.message : "");

  if (code === "3007" || code === "3008" || status === 408) {
    return new AiError("AI_TIMEOUT", {
      cause: value,
      status: status || undefined,
      providerCode: code || undefined,
    });
  }

  if (code === "3006" || status === 413) {
    return new AiError("AI_TOO_LONG", {
      cause: value,
      status: status || undefined,
      providerCode: code || undefined,
    });
  }

  if (code === "3036") {
    return new AiError("AI_RATE_LIMIT", {
      cause: value,
      status: status || 429,
      providerCode: code,
    });
  }

  if (code === "3040") {
    return new AiError("AI_BUSY", {
      cause: value,
      status: status || 429,
      providerCode: code,
    });
  }

  if (status === 429) {
    return new AiError("AI_RATE_LIMIT", {
      cause: value,
      status,
      providerCode: code || undefined,
    });
  }

  if (/json mode couldn't be met/i.test(message)) {
    return new AiError("AI_BAD_RESULT", {
      cause: value,
      status: status || undefined,
      providerCode: code || undefined,
    });
  }

  if (status === 403) {
    return new AiError("AI_PROVIDER_ERROR", {
      cause: value,
      status,
      providerCode: code || "5035",
    });
  }

  if (
    status === 400 ||
    status === 404 ||
    code === "3042" ||
    code === "5007"
  ) {
    return new AiError("AI_PROVIDER_ERROR", {
      cause: value,
      status: status || undefined,
      providerCode: code || undefined,
    });
  }

  return new AiError("AI_PROVIDER_ERROR", {
    cause: value,
    status: status || undefined,
    providerCode: code || undefined,
  });
}
