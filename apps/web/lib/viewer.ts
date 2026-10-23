/** The signed-in person, as shown in menus and avatars. */
export type Viewer = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

/**
 * Two letter initials for an avatar. Falls back to the first letter of the
 * email, then to "U".
 */
export function initialsFrom(name: string | null | undefined, email: string | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "U";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}


import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function getViewer(): Promise<Viewer | null> {
  const cookieStore = await cookies();
  const signedIn = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  if (!signedIn) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = profile?.full_name ?? user.email ?? "Account";
  return {
    id: user.id,
    name,
    email: user.email ?? "",
    initials: initialsFrom(profile?.full_name, user.email),
  };
}
