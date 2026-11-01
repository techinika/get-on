import { cookies } from "next/headers";
import { PENDING_COOKIE } from "@/lib/auth/cookies";
import { maskEmail } from "@/lib/security/otp";
import { verifyToken } from "@/lib/security/tokens";

export type PendingSignup = {
  email: string;
  maskedEmail: string;
  next: string;
};

/**
 * The signup code is sent by Supabase, so we only need the address and where
 * to go afterwards in the signed cookie. There is no local challenge row.
 */
export async function readPendingSignup(): Promise<PendingSignup | null> {
  const cookieStore = await cookies();
  const pending = verifyToken(cookieStore.get(PENDING_COOKIE)?.value);
  if (!pending || pending.purpose !== "signup_verify") return null;

  const email = typeof pending.email === "string" ? pending.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return null;

  return {
    email,
    maskedEmail: maskEmail(email),
    next: typeof pending.next === "string" ? pending.next : "/dashboard/new",
  };
}
