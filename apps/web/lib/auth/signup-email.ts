import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import env from "@/lib/env";

/**
 * Supabase sends the signup confirmation link using the SMTP settings (Resend)
 * that the project already has. The account itself is created by the server.
 */
function confirmationClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function confirmationRedirect(): string | undefined {
  const base = (env.siteUrl || env.appOrigin || "").replace(/\/+$/, "");
  return base ? `${base}/login?verified=1` : undefined;
}

export async function sendSignupEmail(email: string): Promise<boolean> {
  const emailRedirectTo = confirmationRedirect();
  const { error } = await confirmationClient().auth.resend({
    type: "signup",
    email,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) {
    console.error("[security] could not send signup email:", error.message);
    return false;
  }
  return true;
}
