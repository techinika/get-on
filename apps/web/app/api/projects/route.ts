import { NextResponse } from "next/server";
import { generateStarterContent } from "@get-on/blocks";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { friendlyError } from "@/lib/errors";
import { invalidateQuickFind } from "@/lib/project-activity";

export async function POST(request: Request) {
  const current = await getCurrentTeam();
  if (!current) {
    return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  const name = String((body as Record<string, unknown>).name ?? "").trim();
  const address = normalizeAddress(String((body as Record<string, unknown>).address ?? ""));
  const about = String((body as Record<string, unknown>).about ?? "");
  const businessType = String((body as Record<string, unknown>).businessType ?? "");
  const startChoice = String((body as Record<string, unknown>).startChoice ?? "blank");
  const contact = ((body as Record<string, unknown>).contact ?? {}) as Record<string, string>;
  const includeContactForm = (body as Record<string, unknown>).includeContactForm === true;

  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }
  const validation = validateAddress(address);
  if (!validation.ok) {
    return NextResponse.json({ error: "SUBDOMAIN_INVALID" }, { status: 400 });
  }

  const supabase = await createClient();
  const plan = planLimits(current.team.planId);

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("team_id", current.team.teamId);

  if (plan.maxWebsites !== null && (count ?? 0) >= plan.maxWebsites) {
    return NextResponse.json({ error: "LIMIT_WEBSITES_REACHED" }, { status: 403 });
  }

  const { data: available } = await supabase.rpc("is_subdomain_available", {
    candidate: address,
  });
  if (available !== true) {
    return NextResponse.json({ error: "SUBDOMAIN_TAKEN" }, { status: 409 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      team_id: current.team.teamId,
      name,
      subdomain: address,
      status: "draft",
      settings: {
        businessType,
        about: about.trim().slice(0, 300),
        startChoice,
        contact: {
          phone: contact.phone ?? "",
          email: contact.email ?? "",
          address: contact.address ?? "",
        },
        logoData: (body as Record<string, unknown>).logoData
          ? String((body as Record<string, unknown>).logoData)
          : null,
      },
    })
    .select("id, name, subdomain, status")
    .single();

  if (error || !project) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "SUBDOMAIN_TAKEN" }, { status: 409 });
    }
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  if (includeContactForm) {
    const { error: pluginError } = await supabase.rpc("enable_plugin", {
      p_project_id: project.id,
      p_plugin_id: "contact",
    });
    if (pluginError) {
      await supabase.from("projects").delete().eq("id", project.id);
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }
  }

  const content = generateStarterContent({
    businessName: name,
    businessType,
    description: about,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    includeContactForm,
  });

  const { error: pageError } = await supabase.from("pages").insert({
    project_id: project.id,
    title: "Home",
    path: "/",
    position: 0,
    is_homepage: true,
    blocks: content.blocks,
  });

  if (pageError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  invalidateQuickFind(current.team.teamId);

  return NextResponse.json({ project }, { status: 201 });
}

export function friendly(code: string) {
  return friendlyError(code);
}
