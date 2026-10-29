import { createClient } from "@/lib/supabase/server";

export type VerifiedSession = {
  userId: string;
  email: string;
};

/**
 * Returns the verified session for the current request, or null when there is
 * no session or the email is not yet verified. Server actions and API handlers
 * must call this (or throw) before touching user data.
 */
export async function requireVerifiedSession(): Promise<VerifiedSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email_confirmed_at) return null;
  return { userId: user.id, email: user.email ?? "" };
}

export async function requireVerifiedSessionOrThrow(): Promise<VerifiedSession> {
  const session = await requireVerifiedSession();
  if (!session) throw new Error("UNVERIFIED_SESSION");
  return session;
}
