"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asDomainError } from "@/lib/domains/errors";
import { DomainService } from "@/lib/domains/service";

export type AdminDomainResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ id: string; email: string }> {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
  return { id: data.user.id, email: data.user.email };
}

function refresh(domainId: string) {
  revalidatePath("/admin/domains");
  revalidatePath(`/admin/domains/${domainId}`);
}

async function audit(
  action: string,
  projectId: string | null,
  reason: string | null,
  metadata: Record<string, unknown>,
) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    admin_email: adminUser.email,
    action,
    project_id: projectId,
    reason,
    metadata,
  });
}

export async function recheckDomainAction(domainId: string): Promise<AdminDomainResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: domain } = await admin
    .from("domains")
    .select("id, project_id")
    .eq("id", domainId)
    .maybeSingle();
  if (!domain) return { ok: false, error: "We could not find that domain." };

  try {
    await new DomainService({ supabase: admin }).checkDomain(domainId);
  } catch (error) {
    return { ok: false, error: asDomainError(error).message };
  }
  await audit("domain_recheck", domain.project_id ?? null, null, { domainId });
  refresh(domainId);
  return { ok: true };
}

export async function retryHostnameAction(hostnameId: string): Promise<AdminDomainResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: host } = await admin
    .from("domain_hostnames")
    .select("id, domain_id, project_id")
    .eq("id", hostnameId)
    .maybeSingle();
  if (!host) return { ok: false, error: "We could not find that address." };

  try {
    await new DomainService({ supabase: admin }).refreshAddress(hostnameId);
  } catch (error) {
    return { ok: false, error: asDomainError(error).message };
  }
  await audit("domain_retry_validation", host.project_id ?? null, null, {
    hostnameId,
  });
  refresh(host.domain_id);
  return { ok: true };
}

export async function approveDomainAction(domainId: string): Promise<AdminDomainResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: domain } = await admin
    .from("domains")
    .select("id, project_id, review_state")
    .eq("id", domainId)
    .maybeSingle();
  if (!domain) return { ok: false, error: "We could not find that domain." };

  const { error } = await admin
    .from("domains")
    .update({ review_state: "approved" })
    .eq("id", domainId);
  if (error) return { ok: false, error: "We could not save that." };
  await admin.from("domain_events").insert({
    domain_id: domainId,
    event: "review_approved",
    summary: "Domain approved by support",
  });
  await audit("domain_approve", domain.project_id ?? null, null, { domainId });
  refresh(domainId);
  return { ok: true };
}

export async function rejectDomainAction(
  domainId: string,
  reason: string,
): Promise<AdminDomainResult> {
  await requireAdmin();
  const cleaned = reason.trim();
  if (cleaned.length < 3) {
    return { ok: false, error: "Add a short reason first." };
  }
  const admin = createAdminClient();
  const { data: domain } = await admin
    .from("domains")
    .select("id, project_id, status")
    .eq("id", domainId)
    .maybeSingle();
  if (!domain) return { ok: false, error: "We could not find that domain." };

  const { error } = await admin
    .from("domains")
    .update({
      review_state: "rejected",
      status: "failed",
      status_reason: "blocked",
    })
    .eq("id", domainId);
  if (error) return { ok: false, error: "We could not save that." };
  await admin.from("domain_events").insert({
    domain_id: domainId,
    event: "review_rejected",
    summary: cleaned.slice(0, 200),
  });
  await audit("domain_reject", domain.project_id ?? null, cleaned, { domainId });
  refresh(domainId);
  return { ok: true };
}
