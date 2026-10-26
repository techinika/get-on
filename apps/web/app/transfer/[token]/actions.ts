"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TEAM_COOKIE } from "@/lib/dashboard";
import { logTeamActivity } from "@/lib/activity/log";
import {
  friendlyTransferError,
  hashTransferToken,
  normalizeTransferEmail,
} from "@/lib/team/transfers";

export type TransferActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function code(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error);
  const match = message.match(
    /\b(TRANSFER_NOT_FOUND|TRANSFER_NOT_PENDING|TRANSFER_EXPIRED|TRANSFER_EMAIL_MISMATCH|TRANSFER_STALE|TRANSFER_DELETED|TRANSFER_SAME_TEAM|TRANSFER_FORBIDDEN|TRANSFER_SITE_LIMIT|TRANSFER_PAGE_LIMIT|PROJECT_BUSY|NOT_ALLOWED)\b/,
  );
  return match?.[1] ?? "UNKNOWN";
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function acceptTransfer(token: string, teamId: string): Promise<TransferActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { data, error } = await supabase.rpc("accept_ownership_transfer", {
    p_token_hash: hashTransferToken(token),
    p_team: teamId,
  });
  if (error || !data || typeof data !== "object") {
    return { ok: false, error: friendlyTransferError(code(error)) };
  }

  const result = data as {
    project_id: string;
    project_name: string;
    from_team_id: string;
    from_team_name: string;
    to_team_id: string;
    to_team_name: string;
  };

  const store = await cookies();
  store.set(TEAM_COOKIE, result.to_team_id, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const actorName = profile?.full_name || profile?.email || user.email || "Someone";
  const project = { id: result.project_id, name: result.project_name };

  await logTeamActivity({
    teamId: result.from_team_id,
    actor: { userId: user.id, name: actorName },
    event: "website_transferred_out",
    summary: `${actorName} accepted ${result.project_name}, so it moved to ${result.to_team_name}`,
    project,
  });
  await logTeamActivity({
    teamId: result.to_team_id,
    actor: { userId: user.id, name: actorName },
    event: "website_transferred_in",
    summary: `${actorName} accepted ${result.project_name} from ${result.from_team_name}`,
    project,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team/activity");
  revalidatePath(`/dashboard/projects/${result.project_id}`);
  return {
    ok: true,
    message: `${result.project_name} is now in ${result.to_team_name}.`,
  };
}

export async function declineTransfer(token: string): Promise<TransferActionResult> {
  const { user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const admin = createAdminClient();
  const hash = hashTransferToken(token);
  const { data: transfer } = await admin
    .from("ownership_transfers")
    .select("id, project_id, from_team_id, to_email, status, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!transfer) return { ok: false, error: friendlyTransferError("TRANSFER_NOT_FOUND") };
  if (transfer.status !== "pending") {
    return { ok: false, error: friendlyTransferError("TRANSFER_NOT_PENDING") };
  }
  if (new Date(transfer.expires_at).getTime() <= Date.now()) {
    await admin
      .from("ownership_transfers")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", transfer.id)
      .eq("status", "pending");
    return { ok: false, error: friendlyTransferError("TRANSFER_EXPIRED") };
  }
  if (normalizeTransferEmail(transfer.to_email ?? "") !== normalizeTransferEmail(user.email ?? "")) {
    return { ok: false, error: friendlyTransferError("TRANSFER_EMAIL_MISMATCH") };
  }

  const { error } = await admin
    .from("ownership_transfers")
    .update({
      status: "declined",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", transfer.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "That did not work. Please try again." };

  const [{ data: project }, { data: profile }] = await Promise.all([
    admin.from("projects").select("name").eq("id", transfer.project_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
  ]);
  const actorName = profile?.full_name || profile?.email || user.email || "Someone";
  await logTeamActivity({
    teamId: transfer.from_team_id,
    actor: { userId: user.id, name: actorName },
    event: "website_transfer_declined",
    summary: `${actorName} declined the transfer of ${project?.name ?? "the website"}`,
    project: { id: transfer.project_id, name: project?.name ?? "Website" },
    target: { type: "transfer", id: transfer.id, name: transfer.to_email },
  });
  revalidatePath("/dashboard/team/activity");
  return { ok: true, message: "You declined the transfer." };
}
