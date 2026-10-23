import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const redirectTo = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(redirectTo, 303);

  const supabase = await createRouteClient(response);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(toFriendlyAuthError(error.message))}`, request.url),
      303,
    );
  }

  return response;
}
