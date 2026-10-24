import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "done", step: "complete", progress: 100 });
}
