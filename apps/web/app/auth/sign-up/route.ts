import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { toFriendlyAuthError } from "@/lib/auth-errors";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attributeReferral } from "@/lib/referrals";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/new";

  const response = NextResponse.redirect(new URL(safeNext, request.url), 303);

  const supabase = await createRouteClient(response);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(toFriendlyAuthError(error.message))}`, request.url),
      303,
    );
  }

  if (data.user) {
    const cookieStore = await cookies();
    const code = cookieStore.get("gs_ref")?.value ?? null;
    if (code) {
      try {
        const admin = createAdminClient();
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await attributeReferral({
          admin,
          userId: data.user.id,
          email: data.user.email ?? email,
          code,
          ip,
          userAgent: request.headers.get("user-agent"),
        });
      } catch (referralError) {
        console.error("[referrals] attribution failed", referralError);
      }
      response.cookies.delete("gs_ref");
    }
  }

  // When email confirmation is enabled, Supabase returns a user but no session.
  // Sending them to the dashboard would bounce straight back to /login.
  if (!data.session) {
    return NextResponse.redirect(
      new URL(
        `/login?message=${encodeURIComponent("Check your email to confirm your account, then log in.")}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
        request.url,
      ),
      303,
    );
  }

  return response;
}
