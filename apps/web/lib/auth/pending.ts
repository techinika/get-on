import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PENDING_COOKIE } from "@/lib/auth/cookies";
import { maskEmail } from "@/lib/security/otp";
import { verifyToken } from "@/lib/security/tokens";

export type PendingChallenge = {
  challengeId: string;
  purpose: string;
  next: string;
  email: string;
  maskedEmail: string;
};

export async function readPendingChallenge(expectedPurpose: string): Promise<PendingChallenge | null> {
  const cookieStore = await cookies();
  const pending = verifyToken(cookieStore.get(PENDING_COOKIE)?.value);
  if (!pending || pending.purpose !== expectedPurpose || typeof pending.challengeId !== "string") return null;

  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("auth_challenges")
    .select("id,user_id,consumed_at,invalidated_at,expires_at")
    .eq("id", String(pending.challengeId))
    .maybeSingle();
  if (!challenge || challenge.consumed_at || challenge.invalidated_at) return null;
  if (new Date(String(challenge.expires_at)).getTime() <= Date.now()) return null;
  if (!challenge.user_id) return null;

  const { data } = await admin.auth.admin.getUserById(String(challenge.user_id));
  const email = data.user?.email ?? "";
  if (!email) return null;

  return {
    challengeId: String(challenge.id),
    purpose: String(pending.purpose),
    next: typeof pending.next === "string" ? pending.next : "/dashboard",
    email,
    maskedEmail: maskEmail(email),
  };
}
