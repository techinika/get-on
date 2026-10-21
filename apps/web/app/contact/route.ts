import { NextResponse, type NextRequest } from "next/server";

/** The old contact page is now the demo request form. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/request-demo", request.url), 308);
}
