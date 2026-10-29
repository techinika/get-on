import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { sessionIdFromAccessToken } from "@/lib/auth/session-id";
import { isSessionUsable } from "@/lib/security/session-check";

const PROTECTED = ["/dashboard", "/onboarding"];

export async function proxy(request: NextRequest) {
  const { response, user, session } = await updateSession(request);

  const ref = request.nextUrl.searchParams.get("ref");
  const path = request.nextUrl.pathname;
  if (ref && (path === "/" || path === "/signup" || path === "/login") && /^[A-Za-z0-9-]{2,40}$/.test(ref)) {
    response.cookies.set("gs_ref", ref.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
  }

  const needsSession = PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!needsSession) return response;

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // The email must be confirmed and the emailed code accepted for this session.
  const emailConfirmed = Boolean((user as { email_confirmed_at?: string | null } | null)?.email_confirmed_at);
  const sessionId = sessionIdFromAccessToken(session?.access_token);
  const verified = emailConfirmed && sessionId ? await isSessionUsable(sessionId, user.id) : false;

  if (!verified) {
    const target = emailConfirmed ? "/login/verify" : "/verify-email";
    const url = new URL(target, request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/signup", "/login", "/dashboard/:path*", "/onboarding/:path*"],
};
