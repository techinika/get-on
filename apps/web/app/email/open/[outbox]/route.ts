import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIXEL = Uint8Array.from(
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
);
const HEADERS = {
  "content-type": "image/gif",
  "cache-control": "no-store, private",
  "referrer-policy": "no-referrer",
  "content-length": String(PIXEL.byteLength),
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ outbox: string }> },
) {
  const { outbox } = await params;
  if (UUID_PATTERN.test(outbox)) {
    try {
      const admin = createAdminClient();
      await admin.rpc("email_track_open", { p_outbox: outbox });
    } catch {
      // The pixel is always returned, even when tracking is unavailable.
    }
  }

  return new NextResponse(PIXEL, { status: 200, headers: HEADERS });
}
