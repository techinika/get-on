import { createAdminClient } from "@/lib/supabase/admin";
import { DomainService } from "@/lib/domains/service";

export type DomainActionResult = { ok: true } | { ok: false; error: string };

/**
 * Privileged domain operations. Provider calls and KV pointer writes need the
 * service role, but no customer content is read or returned. Staff screens call
 * these through server actions that check permissions first.
 */
export function canSimulatePlanLapse(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DOMAINS_ALLOW_SIMULATION === "true"
  );
}

async function domainRow(domainId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("domains")
    .select("id, project_id, status, review_state")
    .eq("id", domainId)
    .maybeSingle();
  return { admin, domain: data };
}

async function hostRow(hostnameId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("domain_hostnames")
    .select("id, domain_id, project_id, hostname, role, provider_id")
    .eq("id", hostnameId)
    .maybeSingle();
  return { admin, host: data };
}

export async function recheckDomain(domainId: string): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  await new DomainService({ supabase: admin }).checkDomain(domainId);
  return { ok: true };
}

export async function retryHostname(hostnameId: string): Promise<DomainActionResult & { domainId?: string }> {
  const { admin, host } = await hostRow(hostnameId);
  if (!host) return { ok: false, error: "We could not find that address." };
  await new DomainService({ supabase: admin }).refreshAddress(hostnameId);
  return { ok: true, domainId: String(host.domain_id) };
}

export async function reassignHostname(
  hostnameId: string,
  projectId: string,
  staffId: string,
): Promise<DomainActionResult & { domainId?: string }> {
  const { admin, host } = await hostRow(hostnameId);
  if (!host) return { ok: false, error: "We could not find that address." };
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "We could not find that website." };
  await new DomainService({ supabase: admin }).adminReassignHostname(
    hostnameId,
    projectId,
    staffId,
  );
  return { ok: true, domainId: String(host.domain_id) };
}

async function setPaused(domainId: string, paused: boolean): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  const service = new DomainService({ supabase: admin });
  if (paused) await service.pauseDomain(domainId);
  else await service.resumeDomain(domainId);
  return { ok: true };
}

export function pauseDomain(domainId: string): Promise<DomainActionResult> {
  return setPaused(domainId, true);
}

export function resumeDomain(domainId: string): Promise<DomainActionResult> {
  return setPaused(domainId, false);
}

async function setPlanLapse(domainId: string, lapse: boolean): Promise<DomainActionResult> {
  if (!canSimulatePlanLapse()) {
    return { ok: false, error: "Not available in production." };
  }
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  const service = new DomainService({ supabase: admin });
  if (lapse) await service.simulatePlanLapse(domainId);
  else await service.restorePlanLapse(domainId);
  return { ok: true };
}

export async function pauseDomainForPlan(domainId: string): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  await new DomainService({ supabase: admin }).pauseDomainForPlan(domainId);
  return { ok: true };
}

export function simulatePlanLapse(domainId: string): Promise<DomainActionResult> {
  return setPlanLapse(domainId, true);
}

export function restorePlanLapse(domainId: string): Promise<DomainActionResult> {
  return setPlanLapse(domainId, false);
}

export async function deleteProviderHostname(
  hostnameId: string,
  confirmation: string,
): Promise<DomainActionResult & { domainId?: string }> {
  const { admin, host } = await hostRow(hostnameId);
  if (!host) return { ok: false, error: "We could not find that address." };
  if (!host.provider_id) {
    return { ok: false, error: "This address has no provider hostname." };
  }
  if (confirmation.trim() !== host.hostname) {
    return { ok: false, error: "Type the address exactly to confirm." };
  }
  await new DomainService({ supabase: admin }).deleteProviderHostname(hostnameId);
  return { ok: true, domainId: String(host.domain_id) };
}

export async function removeDomain(domainId: string): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  await new DomainService({ supabase: admin }).removeDomain(domainId);
  return { ok: true };
}

export async function approveDomain(domainId: string): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
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
  return { ok: true };
}

export async function rejectDomain(
  domainId: string,
  reason: string,
): Promise<DomainActionResult> {
  const { admin, domain } = await domainRow(domainId);
  if (!domain) return { ok: false, error: "We could not find that domain." };
  await new DomainService({ supabase: admin }).blockDomain(domainId, reason);
  return { ok: true };
}
