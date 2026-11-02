/**
 * Turnstile is off unless explicitly enabled. This lets us ship without a
 * working challenge and turn it back on with one environment value.
 */
export function isTurnstileEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true";
}
