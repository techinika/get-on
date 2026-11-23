import { createBrowserClient } from "@supabase/ssr";
import env from "@/lib/env";
import { createMockSupabaseClient, isSupabaseConfigured } from "./fallback";

export function createClient() {
  if (!isSupabaseConfigured()) {
    return createMockSupabaseClient();
  }
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
