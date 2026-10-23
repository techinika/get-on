import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  const response = NextResponse.redirect(new URL("/dashboard/new", request.url));

  const supabase = await createRouteClient(response);
  const { data, error } = await supabase.auth.signUp({
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

  // When email confirmation is enabled, Supabase returns a user but no session.
  // Sending them to the dashboard would bounce straight back to /login.
  if (!data.session) {
    return NextResponse.redirect(
      new URL(
        `/login?message=${encodeURIComponent("Check your email to confirm your account, then log in.")}`,
        request.url,
      ),
    );
  }

  return response;
}
