import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import env from "@/lib/env";

/**
 * Supabase sends the signup code, using the SMTP settings (Resend) that the
 * project already has. We only ever ask it to resend an existing unconfirmed
 * signup; the account itself is created by the server action.
 */
function codeClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function sendSignupCode(email: string, emailRedirectTo?: string): Promise<boolean> {
  const { error } = await codeClient().auth.resend({
    type: "signup",
    email,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) {
    console.error("[security] could not send signup code:", error.message);
    return false;
  }
  return true;
}
