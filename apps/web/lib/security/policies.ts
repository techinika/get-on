import type { RateLimitPolicy } from "./rate-limit";

export const POLICIES = {
  loginPerEmail: { limit: 10, windowSeconds: 15 * 60 } satisfies RateLimitPolicy,
  loginPerIp: { limit: 30, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  codeVerifyPerUser: { limit: 10, windowSeconds: 30 * 60 } satisfies RateLimitPolicy,
  codeSendPerUser: { limit: 5, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  codeSendPerEmailHash: { limit: 5, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  codeSendPerIp: { limit: 10, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  signupPerIpHour: { limit: 5, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  signupPerIpDay: { limit: 20, windowSeconds: 24 * 60 * 60 } satisfies RateLimitPolicy,
  passwordResetPerEmail: { limit: 3, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  passwordResetPerIp: { limit: 10, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  emailChangePerDay: { limit: 3, windowSeconds: 24 * 60 * 60 } satisfies RateLimitPolicy,
  turnstileFailuresPerIp: { limit: 10, windowSeconds: 60 * 60 } satisfies RateLimitPolicy,
  unauthEndpointPerIp: { limit: 60, windowSeconds: 60 } satisfies RateLimitPolicy,
  authEndpointPerUser: { limit: 300, windowSeconds: 60 } satisfies RateLimitPolicy,
} as const;
