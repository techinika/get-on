"use server";

import { revalidatePath } from "next/cache";
import { recordStaffAction, requireStaffAction, removeSiteReport, requestSiteReview as requestSiteReviewRpc } from "@/lib/admin";
import {
  approveAndPublish,
  bringSiteOnline as bringSiteOnlineLib,
  rebuildSite as rebuildSiteLib,
  takeSiteOffline as takeSiteOfflineLib,
} from "@/lib/admin-actions/site";

export type AdminActionResult = { ok: true } | { ok: false; code: string };

function refresh(siteId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${siteId}`);
}

export async function takeSiteOffline(
  siteId: string,
  reason: string,
): Promise<AdminActionResult> {
  await requireStaffAction("website.takedown.direct");
  const cleaned = reason.trim();
  if (cleaned.length < 3) return { ok: false, code: "REASON_REQUIRED" };

  const result = await takeSiteOfflineLib(siteId, cleaned);
  if (!result.ok) return result;

  await recordStaffAction({
    action: "website.take_offline",
    targetType: "project",
    targetId: siteId,
    reason: cleaned,
  });
  refresh(siteId);
  return { ok: true };
}

export async function bringSiteOnline(siteId: string): Promise<AdminActionResult> {
  const staff = await requireStaffAction("website.reinstate.direct");
  const result = await bringSiteOnlineLib(siteId, staff.userId);
  if (!result.ok) return result;

  await recordStaffAction({
    action: "website.bring_online",
    targetType: "project",
    targetId: siteId,
  });
  refresh(siteId);
  return { ok: true };
}

export async function rebuildSite(siteId: string): Promise<AdminActionResult> {
  const staff = await requireStaffAction("platform.jobs.retry");
  const result = await rebuildSiteLib(siteId, staff.userId);
  if (!result.ok) {
    await recordStaffAction({
      action: "website.rebuild_failed",
      targetType: "project",
      targetId: siteId,
      details: { code: result.code },
    });
    refresh(siteId);
    return result;
  }

  await recordStaffAction({
    action: "website.rebuild",
    targetType: "project",
    targetId: siteId,
  });
  refresh(siteId);
  return { ok: true };
}

export async function requestSiteReview(siteId: string): Promise<AdminActionResult> {
  await requireStaffAction("website.flag");
  try {
    await requestSiteReviewRpc(siteId, "Requested from the admin console.");
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
  refresh(siteId);
  return { ok: true };
}

export async function approveSite(siteId: string): Promise<AdminActionResult> {
  const staff = await requireStaffAction("website.reinstate.direct");
  const result = await approveAndPublish(siteId, staff.userId);
  if (!result.ok) {
    await recordStaffAction({
      action: "website.approve_publish_failed",
      targetType: "project",
      targetId: siteId,
      details: { code: result.code },
    });
    refresh(siteId);
    return result;
  }

  await recordStaffAction({
    action: "website.approve_publish",
    targetType: "project",
    targetId: siteId,
  });
  refresh(siteId);
  return { ok: true };
}

export async function removeReport(
  siteId: string,
  reportId: string,
): Promise<AdminActionResult> {
  await requireStaffAction("abuse.decide");
  try {
    await removeSiteReport(reportId);
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
  refresh(siteId);
  return { ok: true };
}
