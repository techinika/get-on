import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAddress, suggestAddresses, validateAddress } from "@/lib/address";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("q") ?? "";

  const validation = validateAddress(raw);
  if (!validation.ok) {
    return NextResponse.json({
      status: "invalid",
      reason: validation.reason,
    });
  }

  const candidate = normalizeAddress(raw);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_subdomain_available", {
    candidate,
  });

  if (error) {
    return NextResponse.json({ status: "invalid", reason: "Please try again." });
  }

  if (data === true) {
    return NextResponse.json({ status: "available" });
  }

  return NextResponse.json({
    status: "taken",
    suggestions: suggestAddresses(candidate),
  });
}
