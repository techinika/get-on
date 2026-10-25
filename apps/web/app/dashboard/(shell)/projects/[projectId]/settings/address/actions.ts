"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { asDomainError } from "@/lib/domains/errors";
import { DomainService } from "@/lib/domains/service";
import type { Domain, DomainHostname, HostnameMode, HostnameRole } from "@/lib/domains/types";

export type AddressResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

function canManage(role: string): boolean {
  return role === "owner" || role === "admin";
}

function messageFor(error: unknown): string {
  return asDomainError(error).message;
}

async function context(projectId: string) {
  const current = await getCurrentTeam();
  if (!current) return { error: "Please sign in again." as const };
  if (!canManage(current.team.role)) {
    return {
      error: "Only owners and admins can change domains." as const,
    };
  }
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, subdomain, status, deleted_at")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project || project.deleted_at) {
    return { error: "We could not find that website." as const };
  }
  return { current, supabase, project };
}

function service(supabase: Supabase) {
  return new DomainService({ supabase });
}

function invalidate(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}/settings/address`);
  revalidatePath(`/dashboard/projects/${projectId}/settings/address/connect`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/domains");
}

export async function startDomainAction(
  projectId: string,
  domain: string,
): Promise<AddressResult<Domain>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    const created = await service(ctx.supabase).startDomain({
      projectId,
      domain,
    });
    invalidate(projectId);
    return { ok: true, data: created };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function verifyDomainAction(
  projectId: string,
  domainId: string,
): Promise<AddressResult<{ status: string; domain: Domain }>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    const result = await service(ctx.supabase).verifyDomain(domainId);
    invalidate(projectId);
    return { ok: true, data: { status: result.status, domain: result.domain } };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function addAddressAction(
  projectId: string,
  domainId: string,
  label: string,
  role: HostnameRole,
  mode: HostnameMode,
): Promise<AddressResult<DomainHostname>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    const host = await service(ctx.supabase).addAddress({
      domainId,
      label,
      role,
      mode,
    });
    invalidate(projectId);
    return { ok: true, data: host };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function removeAddressAction(
  projectId: string,
  hostnameId: string,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    await service(ctx.supabase).removeAddress(hostnameId);
    invalidate(projectId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function refreshAddressAction(
  projectId: string,
  hostnameId: string,
): Promise<AddressResult<DomainHostname>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    const host = await service(ctx.supabase).refreshAddress(hostnameId);
    invalidate(projectId);
    return { ok: true, data: host };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function checkDomainAction(
  projectId: string,
  domainId: string,
): Promise<AddressResult<Domain>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    const result = await service(ctx.supabase).checkDomain(domainId);
    invalidate(projectId);
    return { ok: true, data: result.domain };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function setMainAddressAction(
  projectId: string,
  hostnameId: string,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    await service(ctx.supabase).setMainAddress(hostnameId);
    invalidate(projectId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function removeDomainAction(
  projectId: string,
  domainId: string,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    await service(ctx.supabase).removeDomain(domainId);
    invalidate(projectId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function reassignDomainAction(
  projectId: string,
  domainId: string,
  targetProjectId: string,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  const { data: target } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", targetProjectId)
    .eq("team_id", ctx.current.team.teamId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!target) return { ok: false, error: "We could not find that website." };
  try {
    await service(ctx.supabase).reassignDomain(domainId, targetProjectId);
    invalidate(projectId);
    invalidate(targetProjectId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function detachDomainAction(
  projectId: string,
  domainId: string,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  try {
    await service(ctx.supabase).detachDomain(domainId);
    invalidate(projectId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function saveAutoPublishAction(
  projectId: string,
  enabled: boolean,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  const { error } = await ctx.supabase
    .from("project_settings")
    .upsert(
      { project_id: projectId, auto_publish_on_domain: enabled },
      { onConflict: "project_id" },
    );
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  invalidate(projectId);
  return { ok: true, data: null };
}

export async function saveAddressOptionsAction(
  projectId: string,
  formData: FormData,
): Promise<AddressResult<null>> {
  const ctx = await context(projectId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Please try again." };
  const redirect = formData.get("redirect_free_address") === "true";
  const { error } = await ctx.supabase
    .from("projects")
    .update({ redirect_free_address: redirect })
    .eq("id", projectId)
    .eq("team_id", ctx.current.team.teamId);
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("subdomain, primary_host")
    .eq("id", projectId)
    .maybeSingle();
  if (project?.primary_host) {
    const { patchLivePointer } = await import("@/lib/publishing/live-pointer");
    await patchLivePointer(String(project.subdomain), {
      redirectToPrimary: redirect,
    }).catch(() => undefined);
  }
  invalidate(projectId);
  return { ok: true, data: null };
}
