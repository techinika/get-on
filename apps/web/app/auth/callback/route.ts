import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const response = NextResponse.redirect(new URL(safeNext, request.url));

  if (code) {
    const supabase = await createRouteClient(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("That link has expired. Please log in again.")}`,
          request.url,
        ),
      );
    }
  }

  return response;
}
