const TOKEN_PATTERN = /^[a-f0-9]{48}$/i;

/** True when the value has the shape of an email preference token. */
export function isUnsubscribeToken(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
