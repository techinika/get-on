import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { PENDING_COOKIE } from "@/lib/auth/cookies";
import { getIpHash, uaFamily } from "@/lib/security/request";
import { recordSecurityEvent } from "@/lib/security/events";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/login", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(PENDING_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash") ?? "";
  const type = searchParams.get("type") ?? "signup";

  if (!tokenHash || type !== "signup") {
    return loginRedirect(request, { error: "TOKEN_INVALID" });
  }

  const response = loginRedirect(request, { verified: "1" });
  const supabase = await createRouteClient(response);
  const { data, error } = await supabase.auth.verifyOtp({
    type: "signup",
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    return loginRedirect(request, { error: "TOKEN_INVALID" });
  }

  await recordSecurityEvent({
    userId: data.user.id,
    category: "auth",
    event: "email_verified",
    severity: "info",
    summary: "Email confirmed from the signup link",
    ipHash: getIpHash(request.headers),
    uaFamily: uaFamily(request.headers.get("user-agent")),
    visibleToUser: true,
  });

  await supabase.auth.signOut();
  return response;
}
