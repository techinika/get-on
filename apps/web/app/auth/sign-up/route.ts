import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(toFriendlyAuthError(error.message))}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard/new", request.url));
}
