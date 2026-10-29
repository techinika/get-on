export const SECURITY_MESSAGES = {
  AUTH_INVALID_CREDENTIALS: "Email or password is incorrect.",
  AUTH_LOCKED: "Too many tries. Please wait a few minutes and try again.",
  AUTH_EMAIL_EXISTS: "An account with this email already exists. Log in, or reset your password if you forgot it.",
  AUTH_EMAIL_EXISTS_UNVERIFIED: "You already started signing up with this email. We sent a new code.",
  AUTH_EMAIL_EXISTS_GOOGLE: "This email is already used with Google sign-in. Continue with Google.",
  AUTH_EMAIL_DISPOSABLE: "Please use a permanent email address.",
  AUTH_EMAIL_INVALID: "That email address does not look right.",
  AUTH_PASSWORD_WEAK: "Please choose a stronger password.",
  AUTH_PASSWORD_TOO_SHORT: "Use a longer password. It needs at least 10 characters.",
  AUTH_PASSWORD_PERSONAL: "Please do not use your name or email address in your password.",
  AUTH_PASSWORD_MISMATCH: "Those two passwords do not match.",
  AUTH_PASSWORD_BREACHED: "That password appeared in a data breach. Please choose another.",
  AUTH_TERMS_REQUIRED: "Please accept the Terms of Service and Privacy Policy to continue.",
  OTP_INVALID: "That code is not right.",
  OTP_EXPIRED: "That code has expired. We sent you a new one.",
  OTP_LOCKED: "Too many wrong codes. Please wait a few minutes.",
  OTP_RESEND_WAIT: "Please wait a moment before asking for another code.",
  OTP_RESEND_LIMIT: "You asked for too many codes. Please try again later.",
  STEP_UP_REQUIRED: "Please enter a new code to continue.",
  SESSION_EXPIRED: "You were signed out. Please sign in again.",
  TURNSTILE_FAILED: "We could not check that you are a person. Please try again.",
  RATE_LIMITED: "You are going a little fast. Please wait a moment.",
  TOKEN_INVALID: "That link is no longer valid.",
  REGISTRATION_CLOSED: "New sign-ups are paused right now. Please try again later.",
  SOMETHING_WRONG: "Something went wrong. Please try again.",
} as const;

export type SecurityMessageCode = keyof typeof SECURITY_MESSAGES;

export function securityMessage(code: string, values: { n?: number | string; email?: string } = {}): string {
  const base = (SECURITY_MESSAGES as Record<string, string>)[code] ?? SECURITY_MESSAGES.SOMETHING_WRONG;
  return base.replace("{n}", String(values.n ?? "")).replace("{email}", String(values.email ?? ""));
}
