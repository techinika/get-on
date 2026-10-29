/**
 * Reads the auth session id from a Supabase access token. The token was already
 * validated by the auth service, so this is a decode, not a verification.
 * Kept free of Node built-ins so the proxy can use it.
 */
export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  const part = accessToken.split(".")[1];
  if (!part) return null;
  try {
    const normalised = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalised)) as { session_id?: unknown };
    return typeof json.session_id === "string" && json.session_id.length > 0 ? json.session_id : null;
  } catch {
    return null;
  }
}
