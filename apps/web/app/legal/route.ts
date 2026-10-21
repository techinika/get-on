import { NextResponse, type NextRequest } from "next/server";

/** Old short link for the legal pages. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/terms", request.url), 308);
}
