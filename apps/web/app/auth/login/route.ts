import { NextResponse } from "next/server";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const redirectTo = new URL(safeNext, request.url);
  const response = NextResponse.redirect(redirectTo, 303);

  const supabase = await createRouteClient(response);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(toFriendlyAuthError(error.message))}${next ? `&next=${encodeURIComponent(next)}` : ""}`, request.url),
      303,
    );
  }

  return response;
}
