import { NextResponse } from "next/server";
import { generateStarterContent } from "@get-on/blocks";
import { materializeTemplate, requireSystemTemplate } from "@get-on/templates";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { friendlyError } from "@/lib/errors";
import { invalidateQuickFind } from "@/lib/project-activity";
import { templateAvailable, templateBySlug } from "@/lib/templates/catalog";
import { generatePageWithAi } from "@/lib/ai/actions";

export const maxDuration = 90;

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
  const templateSlug = String((body as Record<string, unknown>).templateSlug ?? "").trim();
  const contact = ((body as Record<string, unknown>).contact ?? {}) as Record<string, string>;
  const includeContactForm = (body as Record<string, unknown>).includeContactForm === true;

  if (templateSlug && !templateBySlug(templateSlug)) {
    return NextResponse.json({ error: "TEMPLATE_NOT_FOUND" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }
  const validation = validateAddress(address);
  if (!validation.ok) {
    return NextResponse.json({ error: "SUBDOMAIN_INVALID" }, { status: 400 });
  }

  if (templateSlug && !templateAvailable(current.team.planId, templateSlug)) {
    return NextResponse.json({ error: "TEMPLATE_PLAN_REQUIRED" }, { status: 403 });
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
      stats_site_key: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
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
        ...(templateSlug
          ? {
              templateOrigin: {
                slug: templateSlug,
                name: templateBySlug(templateSlug)?.name,
                version: 1,
                appliedAt: new Date().toISOString(),
                mode: "full",
              },
            }
          : {}),
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
      try {
        await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", project.id);
      } catch {
        await supabase.from("projects").delete().eq("id", project.id);
      }
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }
  }

  if (templateSlug) {
    const pkg = requireSystemTemplate(templateSlug);
    const materialized = materializeTemplate(pkg, {
      profile: {
        businessName: name,
        description: about,
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        address: contact.address ?? "",
      },
      maxPages: plan.maxPagesPerSite,
    });

    const { data: insertedSettings, error: themeError } = await supabase
      .from("project_settings")
      .upsert({ project_id: project.id, theme: materialized.theme }, { onConflict: "project_id" })
      .select("project_id")
      .single();
    if (themeError || !insertedSettings) {
      try {
        await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", project.id);
      } catch {
        await supabase.from("projects").delete().eq("id", project.id);
      }
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }

    const blocks = materialized.pages.flatMap((page) => page.blocks);
    const hasContactForm = blocks.some(
      (block) => block && typeof block === "object" && (block as { type?: string }).type === "contact-form",
    );
    if (hasContactForm && !includeContactForm) {
      await supabase.rpc("enable_plugin", { p_project_id: project.id, p_plugin_id: "contact" });
    }

    const { error: pageError } = await supabase.from("pages").insert(
      materialized.pages.map((page) => ({
        id: page.id,
        project_id: project.id,
        title: page.title,
        path: page.path,
        position: page.position,
        is_homepage: page.isHome,
        blocks: page.blocks,
        show_in_menu: page.showInMenu,
        seo_title: page.seoTitle || null,
        seo_description: page.seoDescription || null,
      })),
    );

    if (pageError) {
      try {
        await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", project.id);
      } catch {
        await supabase.from("projects").delete().eq("id", project.id);
      }
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }

    invalidateQuickFind(current.team.teamId);
    return NextResponse.json({ project }, { status: 201 });
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

  const { data: insertedPage, error: pageError } = await supabase
    .from("pages")
    .insert({
      project_id: project.id,
      title: "Home",
      path: "/",
      position: 0,
      is_homepage: true,
      blocks: content.blocks,
    })
    .select("id")
    .single();

  if (pageError || !insertedPage) {
    try {
      await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", project.id);
    } catch {
      await supabase.from("projects").delete().eq("id", project.id);
    }
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  invalidateQuickFind(current.team.teamId);

  if (startChoice === "ai") {
    const brief = [
      `Create the home page for ${name}.`,
      businessType ? `Business type: ${businessType}.` : "",
      about.trim() ? `About the business: ${about.trim()}.` : "",
      contact.phone ? `Phone: ${contact.phone}.` : "",
      contact.email ? `Email: ${contact.email}.` : "",
      contact.address ? `Address: ${contact.address}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const generated = await generatePageWithAi({
      projectId: project.id,
      brief,
    }).catch((error) => {
      console.error("[projects] AI first page failed", error);
      return null;
    });

    if (generated?.ok) {
      const blocks = Array.isArray(generated.data) ? [...generated.data] : null;
      if (blocks && blocks.length > 0) {
        const hasContactForm = blocks.some(
          (block) =>
            block &&
            typeof block === "object" &&
            (block as { type?: string }).type === "contact-form",
        );
        if (includeContactForm && !hasContactForm) {
          const starterContact = content.blocks.find(
            (block) =>
              block &&
              typeof block === "object" &&
              (block as { type?: string }).type === "contact-form",
          );
          if (starterContact) blocks.push(starterContact);
        }
        const { error: updateError } = await supabase
          .from("pages")
          .update({
            blocks,
            seo_title: name.slice(0, 60),
            seo_description: about.trim().slice(0, 155) || null,
          })
          .eq("id", insertedPage.id);
        if (!updateError) {
          invalidateQuickFind(current.team.teamId);
          return NextResponse.json(
            {
              project,
              ai: { status: "ready", credits: generated.credits },
            },
            { status: 201 },
          );
        }
      }
    }

    return NextResponse.json(
      {
        project,
        ai: {
          status: "fallback",
          code: generated?.ok ? "AI_BAD_RESULT" : generated?.code ?? "UNKNOWN",
        },
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ project }, { status: 201 });
}

export function friendly(code: string) {
  return friendlyError(code);
}
