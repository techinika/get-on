"use server";

import { revalidatePath } from "next/cache";
import { recordStaffAction, requireStaffAction } from "@/lib/admin";
import { asDomainError } from "@/lib/domains/errors";
import {
  approveDomain,
  deleteProviderHostname,
  pauseDomain,
  reassignHostname,
  recheckDomain,
  rejectDomain,
  resumeDomain,
  restorePlanLapse,
  retryHostname,
  simulatePlanLapse,
} from "@/lib/domains/admin-actions";

export type AdminDomainResult = { ok: true } | { ok: false; error: string };

function refresh(domainId: string) {
  revalidatePath("/admin/domains");
  revalidatePath(`/admin/domains/${domainId}`);
}

function failed(error: unknown): AdminDomainResult {
  return { ok: false, error: asDomainError(error).message };
}

export async function recheckDomainAction(domainId: string): Promise<AdminDomainResult> {
  await requireStaffAction("domain.recheck");
  try {
    const result = await recheckDomain(domainId);
    if (!result.ok) return result;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.recheck",
    targetType: "domain",
    targetId: domainId,
  });
  refresh(domainId);
  return { ok: true };
}

export async function retryHostnameAction(hostnameId: string): Promise<AdminDomainResult> {
  await requireStaffAction("domain.recheck");
  let domainId = hostnameId;
  try {
    const result = await retryHostname(hostnameId);
    if (!result.ok) return result;
    domainId = result.domainId ?? hostnameId;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.retry_validation",
    targetType: "hostname",
    targetId: hostnameId,
  });
  refresh(domainId);
  return { ok: true };
}

export async function reassignHostnameAction(
  hostnameId: string,
  projectId: string,
  note: string,
): Promise<AdminDomainResult> {
  const staff = await requireStaffAction("domain.remove.approve");
  const cleaned = note.trim();
  if (cleaned.length < 3) {
    return { ok: false, error: "Add a short reason first." };
  }
  let domainId = "";
  try {
    const result = await reassignHostname(hostnameId, projectId, staff.userId);
    if (!result.ok) return result;
    domainId = result.domainId ?? "";
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.reassign_hostname",
    targetType: "hostname",
    targetId: hostnameId,
    reason: cleaned,
    details: { targetProjectId: projectId },
  });
  if (domainId) refresh(domainId);
  revalidatePath(`/admin/sites/${projectId}`);
  return { ok: true };
}

async function togglePause(
  domainId: string,
  pause: boolean,
): Promise<AdminDomainResult> {
  await requireStaffAction("domain.plan_lapse.approve");
  try {
    const result = pause ? await pauseDomain(domainId) : await resumeDomain(domainId);
    if (!result.ok) return result;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: pause ? "domain.pause" : "domain.resume",
    targetType: "domain",
    targetId: domainId,
  });
  refresh(domainId);
  return { ok: true };
}

export async function pauseDomainAction(domainId: string): Promise<AdminDomainResult> {
  return togglePause(domainId, true);
}

export async function resumeDomainAction(domainId: string): Promise<AdminDomainResult> {
  return togglePause(domainId, false);
}

async function togglePlanLapse(
  domainId: string,
  lapse: boolean,
): Promise<AdminDomainResult> {
  await requireStaffAction("domain.plan_lapse.approve");
  try {
    const result = lapse
      ? await simulatePlanLapse(domainId)
      : await restorePlanLapse(domainId);
    if (!result.ok) return result;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: lapse ? "domain.simulate_plan_lapse" : "domain.restore_plan_lapse",
    targetType: "domain",
    targetId: domainId,
  });
  refresh(domainId);
  return { ok: true };
}

export async function simulatePlanLapseAction(
  domainId: string,
): Promise<AdminDomainResult> {
  return togglePlanLapse(domainId, true);
}

export async function restorePlanLapseAction(
  domainId: string,
): Promise<AdminDomainResult> {
  return togglePlanLapse(domainId, false);
}

export async function deleteProviderHostnameAction(
  hostnameId: string,
  confirmation: string,
): Promise<AdminDomainResult> {
  await requireStaffAction("domain.remove.approve");
  let domainId = "";
  try {
    const result = await deleteProviderHostname(hostnameId, confirmation);
    if (!result.ok) return result;
    domainId = result.domainId ?? "";
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.delete_provider_hostname",
    targetType: "hostname",
    targetId: hostnameId,
  });
  if (domainId) refresh(domainId);
  return { ok: true };
}

export async function approveDomainAction(domainId: string): Promise<AdminDomainResult> {
  await requireStaffAction("domain.review.approve");
  try {
    const result = await approveDomain(domainId);
    if (!result.ok) return result;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.review_approved",
    targetType: "domain",
    targetId: domainId,
  });
  refresh(domainId);
  return { ok: true };
}

export async function rejectDomainAction(
  domainId: string,
  reason: string,
): Promise<AdminDomainResult> {
  await requireStaffAction("domain.review.approve");
  const cleaned = reason.trim();
  if (cleaned.length < 3) {
    return { ok: false, error: "Add a short reason first." };
  }
  try {
    const result = await rejectDomain(domainId, cleaned);
    if (!result.ok) return result;
  } catch (error) {
    return failed(error);
  }
  await recordStaffAction({
    action: "domain.review_rejected",
    targetType: "domain",
    targetId: domainId,
    reason: cleaned,
  });
  refresh(domainId);
  return { ok: true };
}
