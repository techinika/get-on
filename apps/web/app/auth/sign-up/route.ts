import { NextResponse } from "next/server";

/**
 * Signup is server-controlled at POST /api/auth/register. This legacy path is
 * kept only so old links do not create an account through the auth service.
 */
export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/signup", request.url), 303);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/signup", request.url), 307);
}
