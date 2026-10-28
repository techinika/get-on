import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_PATTERN = /^[a-f0-9]{48}$/i;
const HEADERS = {
  "cache-control": "no-store, private",
  "referrer-policy": "no-referrer",
};

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: HEADERS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) return notFound();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("email_track_click", { p_token: token });
    if (error || typeof data !== "string") return notFound();

    const target = new URL(data);
    if (target.protocol !== "https:" && target.protocol !== "http:") return notFound();
    return NextResponse.redirect(target, { status: 302, headers: HEADERS });
  } catch {
    return notFound();
  }
}
