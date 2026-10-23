import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.redirect(
      new URL(`/reset-password?error=${encodeURIComponent(toFriendlyAuthError(error.message))}`, request.url),
      303,
    );
  }

  return NextResponse.redirect(
    new URL("/login?message=Your password has been updated.", request.url),
    303,
  );
}
