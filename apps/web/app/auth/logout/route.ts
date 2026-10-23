import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const supabase = await createRouteClient(response);
  await supabase.auth.signOut();

  return response;
}
