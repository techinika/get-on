import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

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

  // Email verification gate: a session without a verified email cannot reach
  // the dashboard; send them to the code-entry page instead.
  const verified = Boolean((user as { email_confirmed_at?: string | null } | null)?.email_confirmed_at);
  if (user && !verified && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }
  if (!user && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/signup", "/login", "/dashboard/:path*"],
};
