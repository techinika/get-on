import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const p = join(process.cwd(), "..", "..", "packages", "site-server", "client", "consent.ts");
    const content = readFileSync(p, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "text/javascript; charset=utf-8" } });
  }
}
