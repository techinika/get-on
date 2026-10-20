import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(toFriendlyAuthError(error.message))}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
