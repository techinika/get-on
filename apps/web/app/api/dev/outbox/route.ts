import { NextResponse } from "next/server";
import { readMemoryOutbox } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json(
    { messages: await readMemoryOutbox() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
