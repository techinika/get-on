import { createClient } from "@supabase/supabase-js";
import env from "@/lib/env";

/**
 * Service role client. It bypasses Row Level Security, so it must only ever
 * be used on the server. It is used for the demo request table, which has no
 * policies for normal users.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createClient(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
