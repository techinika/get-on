const AUTH_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/Password should be at least 8 characters/i, "That password is too short. Use at least 8 characters."],
  [/Invalid login credentials/i, "Those login details did not match. Please try again."],
  [/Email not confirmed/i, "Please check your email and confirm your account first."],
  [/User already registered/i, "That email is already registered. Try logging in instead."],
  [
    /rate limit|too many (requests|requests|email)/i,
    "Too many attempts in a short time. Please wait a minute and try again.",
  ],
  [/Email rate limit/i, "Too many sign-ups right now. Please wait a minute and try again."],
];

export function toFriendlyAuthError(raw?: string | null) {
  if (!raw) {
    return "Something went wrong. Please try again.";
  }

  const known = AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(raw));
  return known?.[1] ?? "Something went wrong. Please try again.";
}
