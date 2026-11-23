import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import env from "@/lib/env";
import { createMockSupabaseClient, isSupabaseConfigured } from "./fallback";

export async function createClient() {
  if (!isSupabaseConfigured()) {
    return createMockSupabaseClient();
  }

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // no-op when called from a server component
        }
      },
    },
  });
}

/**
 * Server client for Route Handlers that end in a redirect. Auth cookies are
 * written onto the response that is actually returned, instead of the implicit
 * one that `cookies().set()` would target and then discard.
 */
export async function createRouteClient(response: NextResponse) {
  if (!isSupabaseConfigured()) {
    return createMockSupabaseClient();
  }

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
