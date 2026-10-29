import { NextResponse } from "next/server";

/**
 * Sign-in is server-controlled at POST /api/auth/login, which adds the emailed
 * code step. This legacy path must never sign anyone in directly.
 */
export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 307);
}
