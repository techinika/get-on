import {
  generateStarterContent,
} from "@get-on/blocks";
import {
  materializeTemplate,
  requireSystemTemplate,
  withDefaultImages,
  type Block,
} from "@get-on/templates";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/team";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { getQuota } from "@/lib/quotas";
import { templateAvailable, templateBySlug } from "@/lib/templates/catalog";
import { parseDesignPrefs } from "@/lib/ai/design-prefs";
import { fillTemplateTextWithAi } from "@/lib/ai/template-fill";
import {
  applyWizardDesignToPages,
  buildWizardDesign,
  chooseWizardDesign,
  designSummary,
} from "@/lib/ai/wizard-design";
import { createAdminClient } from "@/lib/supabase/admin";
import { logTeamActivity } from "@/lib/activity/log";
import { invalidateQuickFind } from "@/lib/project-activity";
import type { AgentActor } from "@/lib/agent/auth";
import type { DesignPrefs } from "@/lib/ai/design-prefs";

export type SiteBrief = {
  name: string;
  address: string;
  businessType: string;
  about: string;
  style: string | null;
  designPrefs: DesignPrefs;
  contact: { phone: string; email: string; address: string };
  includeContactForm: boolean;
};

export type CreateSiteResult = {
  ok: true;
  project: { id: string; name: string; subdomain: string; status: string };
  credits: number;
  ai: { status: "ready" | "fallback"; code?: string };
} | {
  ok: false;
  code: string;
  message: string;
  upgrade_hint?: string;
};

const STARTER_SLUG = "starter";

function addressPrimary(address: string): string {
  return `https://${address}.get-on.tech`;
}

export async function validateSiteBrief(
  actor: AgentActor,
  brief: Partial<SiteBrief>,
): Promise<
  | { ok: true; brief: SiteBrief }
  | { ok: false; code: string; upgrade_hint?: string }
> {
  const name = String(brief.name ?? "").trim();
  if (!name) return { ok: false, code: "NAME_REQUIRED" };
  if (name.length > 120) return { ok: false, code: "NAME_TOO_LONG" };

  const address = normalizeAddress(String(brief.address ?? ""));
  const validation = validateAddress(address);
  if (!validation.ok) return { ok: false, code: "SUBDOMAIN_INVALID" };

  const businessType = String(brief.businessType ?? "").trim();
  if (!businessType) return { ok: false, code: "BUSINESS_TYPE_REQUIRED" };
  if (businessType.length > 80) return { ok: false, code: "BUSINESS_TYPE_TOO_LONG" };

  const about = String(brief.about ?? "").trim().slice(0, 300);

  const admin = createAdminClient();
  const templateSlug = STARTER_SLUG;
  if (!templateAvailable(actor.planId, templateSlug)) {
    return { ok: false, code: "TEMPLATE_PLAN_REQUIRED" };
  }

  const quota = await getQuota(actor.teamId);
  const maxWebsites = quota?.max_websites ?? null;
  const activeSites = Number(quota?.active_sites ?? 0);
  if (maxWebsites !== null && activeSites >= maxWebsites) {
    return { ok: false, code: "LIMIT_WEBSITES_REACHED", upgrade_hint: "upgrade" };
  }

  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const hourAgo = new Date(Date.now() - 36e5).toISOString();
  const [{ count: teamDay }, { count: userHour }] = await Promise.all([
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", actor.teamId)
      .gte("created_at", dayAgo),
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", actor.teamId)
      .eq("created_by", actor.userId)
      .gte("created_at", hourAgo),
  ]);
  if ((teamDay ?? 0) >= 5 || (userHour ?? 0) >= 3) {
    return { ok: false, code: "WEBSITE_CREATE_RATE" };
  }

  const { data: available } = await admin.rpc("is_subdomain_available", {
    candidate: address,
  });
  if (available !== true) return { ok: false, code: "SUBDOMAIN_TAKEN" };

  return {
    ok: true,
    brief: {
      name,
      address,
      businessType,
      about,
      style: brief.style ?? null,
      designPrefs: brief.designPrefs ?? parseDesignPrefs({ styles: [brief.style ?? "Modern"] }),
      contact: brief.contact ?? { phone: "", email: "", address: "" },
      includeContactForm: brief.includeContactForm ?? false,
    },
  };
}

export async function createSiteFromBrief(
  admin: ReturnType<typeof createAdminClient>,
  actor: AgentActor,
  conversationId: string,
  brief: SiteBrief,
): Promise<CreateSiteResult> {
  const validated = await validateSiteBrief(actor, brief);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message: siteGenerationMessage(validated.code),
      upgrade_hint: validated.upgrade_hint,
    };
  }
  brief = validated.brief;

  const plan = planLimits(actor.planId);

  const design = buildWizardDesign({
    name: brief.name,
    businessType: brief.businessType,
    about: brief.about,
    prefs: brief.designPrefs,
    brief: brief.about,
    teamId: actor.teamId,
    planId: actor.planId,
    maxPages: plan.maxPagesPerSite,
  });
  const chosen = chooseWizardDesign(design, null);

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      team_id: actor.teamId,
      name: brief.name,
      subdomain: brief.address,
      status: "draft",
      created_by: actor.userId,
      created_via: "assistant",
      last_edited_by: actor.userId,
      last_edited_at: new Date().toISOString(),
      stats_site_key: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
      design_spec: design.spec,
      settings: {
        businessType: brief.businessType,
        about: brief.about,
        startChoice: "ai",
        designBrief: brief.about,
        contact: brief.contact,
        templateOrigin: {
          slug: STARTER_SLUG,
          name: templateBySlug(STARTER_SLUG)?.name ?? STARTER_SLUG,
          version: 1,
          appliedAt: new Date().toISOString(),
          mode: "full",
        },
      },
    })
    .select("id, name, subdomain, status")
    .single();

  if (error || !project) {
    if (error?.code === "23505") return { ok: false, code: "SUBDOMAIN_TAKEN", message: "That web address is already taken." };
    return { ok: false, code: "AGENT_CREATE_FAILED", message: "We could not create the website." };
  }

  if (brief.includeContactForm) {
    await supabase.rpc("enable_plugin", { p_project_id: project.id, p_plugin_id: "contact" });
  }

  const pkg = requireSystemTemplate(chosen.decision.archetype);
  const profile = {
    businessName: brief.name,
    tagline: "",
    description: brief.about,
    phone: brief.contact.phone,
    email: brief.contact.email,
    address: brief.contact.address,
    hoursNote: "",
    businessType: brief.businessType,
    city: "",
    region: "",
    country: "",
    areaServed: "",
  };

  let pages;
  try {
    const materialized = materializeTemplate(pkg, {
      profile,
      maxPages: plan.maxPagesPerSite,
      compositionId: chosen.decision.compositionId,
      imageSeed: project.id,
    });
    const starter = generateStarterContent({
      businessName: brief.name,
      businessType: brief.businessType,
      description: brief.about,
      phone: brief.contact.phone,
      email: brief.contact.email,
      address: brief.contact.address,
      includeContactForm: brief.includeContactForm,
    });
    const contactBlock =
      starter.blocks.find(
        (block) =>
          block &&
          typeof block === "object" &&
          (block as { type?: string }).type === "contact-form",
      ) ?? null;
    pages = applyWizardDesignToPages(materialized.pages, chosen.decision, {
      includeContactForm: brief.includeContactForm,
      contactBlock: contactBlock as Block | null,
    });
  } catch {
    await supabase.from("projects").delete().eq("id", project.id);
    return { ok: false, code: "AGENT_CREATE_FAILED", message: "We could not build the website design." };
  }

  const { error: settingsError } = await supabase
    .from("project_settings")
    .upsert(
      { project_id: project.id, theme: chosen.decision.theme, design_prefs: brief.designPrefs },
      { onConflict: "project_id" },
    );
  if (settingsError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return { ok: false, code: "AGENT_CREATE_FAILED", message: "We could not save the website design." };
  }

  const { error: pageError } = await supabase.from("pages").insert(
    pages.map((page) => ({
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
    await supabase.from("projects").delete().eq("id", project.id);
    return { ok: false, code: "AGENT_CREATE_FAILED", message: "We could not save the website pages." };
  }

  let aiResult;
  try {
    aiResult = await fillTemplateTextWithAi({
      projectId: project.id,
      taskId: "site.generate",
      compact: true,
      context: [
        designSummary(chosen.decision),
        `Business: ${brief.name}.`,
        brief.businessType ? `Business type: ${brief.businessType}.` : "",
        brief.about ? `About: ${brief.about}.` : "",
      ].filter(Boolean).join(" "),
      notes: "Write the whole first draft from these text slots. Keep the chosen design and the business facts.",
    });
  } catch {
    aiResult = null;
  }

  if (!aiResult || !aiResult.ok) {
    const fallback = generateStarterContent({
      businessName: brief.name,
      businessType: brief.businessType,
      description: brief.about,
      phone: brief.contact.phone,
      email: brief.contact.email,
      address: brief.contact.address,
      includeContactForm: brief.includeContactForm,
    });
    await supabase.from("pages").delete().eq("project_id", project.id);
    await supabase.from("pages").insert({
      project_id: project.id,
      title: "Home",
      path: "/",
      position: 0,
      is_homepage: true,
      blocks: withDefaultImages(fallback.blocks, project.id),
      seo_title: brief.name.slice(0, 60),
      seo_description: brief.about.slice(0, 155) || null,
    });
    await logTeamActivity({
      teamId: actor.teamId,
      actor: { userId: actor.userId },
      event: "website_created",
      summary: `${actor.teamName} created the website ${brief.name} with AI`,
      project: { id: project.id, name: brief.name },
      meta: { via: "assistant", fallback: true },
    });
    await invalidateQuickFind(actor.teamId);
    await admin
      .from("agent_conversations")
      .update({ project_id: project.id })
      .eq("id", conversationId);
    return {
      ok: true,
      project: { id: project.id, name: project.name, subdomain: project.subdomain, status: project.status },
      credits: 0,
      ai: { status: "fallback", code: aiResult && !aiResult.ok ? aiResult.code : "UNKNOWN" },
    };
  }

  await logTeamActivity({
    teamId: actor.teamId,
    actor: { userId: actor.userId },
    event: "website_created",
    summary: `${actor.teamName} created the website ${brief.name} with AI`,
    project: { id: project.id, name: brief.name },
    meta: { via: "assistant", design: chosen.decision.archetype },
  });
  await invalidateQuickFind(actor.teamId);
  await admin
    .from("agent_conversations")
    .update({ project_id: project.id })
    .eq("id", conversationId);

  return {
    ok: true,
    project: { id: project.id, name: project.name, subdomain: project.subdomain, status: project.status },
    credits: aiResult.credits,
    ai: { status: "ready" },
  };
}

function siteGenerationMessage(code: string): string {
  switch (code) {
    case "LIMIT_WEBSITES_REACHED":
      return "You have reached your plan’s website limit.";
    case "WEBSITE_CREATE_RATE":
      return "You’re creating websites too quickly. Try again later.";
    case "SUBDOMAIN_TAKEN":
      return "That web address is already taken.";
    case "TEMPLATE_PLAN_REQUIRED":
      return "That template is not available on your plan.";
    case "NAME_REQUIRED":
      return "Please give your website a name.";
    case "BUSINESS_TYPE_REQUIRED":
      return "Please tell me what kind of business it is.";
    case "SUBDOMAIN_INVALID":
      return "Please enter a valid web address.";
    default:
      return "We could not prepare the website.";
  }
}

export { addressPrimary };
