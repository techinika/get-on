"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeam } from "@/lib/team";
import { can, type Action, type Role } from "@/lib/permissions";
import { logTeamActivity } from "@/lib/activity/log";
import { sendEmail } from "@/lib/email/send";
import { teamNoticeEmail } from "@get-on/email";
import env from "@/lib/env";
import {
  INVITE_DAYS,
  newInviteToken,
  normalizeEmail,
  inviteLink,
  recordInviteEmailState,
  sendInviteEmail,
} from "@/lib/team/invitations";

export type ActionResult = { ok: true } | { ok: false; error: string };

const INVITE_ROLES: Role[] = ["admin", "editor", "viewer"];

function errorCode(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error);
  const match = message.match(/\b(SEATS_FULL|INVITE_EXISTS|INVITE_MEMBER|INVITE_RATE|INVITE_ROLE|INVITE_EXPIRED|INVITE_EMAIL_MISMATCH|ROLE_NOT_ALLOWED|OWNER_PROTECTED|NOT_ALLOWED)\b/);
  return match?.[1] ?? "UNKNOWN";
}

function friendly(code: string): string {
  switch (code) {
    case "SEATS_FULL":
      return "Your plan has no free seats right now. Remove someone or upgrade to invite more.";
    case "INVITE_EXISTS":
      return "That person already has an invitation. You can resend it.";
    case "INVITE_MEMBER":
      return "That person is already on your team.";
    case "INVITE_RATE":
      return "You have sent a lot of invitations. Please try again later.";
    case "INVITE_ROLE":
      return "You cannot give that role.";
    case "INVITE_EXPIRED":
      return "This invitation has ended. Ask for a new one.";
    case "ROLE_NOT_ALLOWED":
      return "You cannot change that person's role.";
    case "OWNER_PROTECTED":
      return "The team owner cannot be removed or changed. Transfer ownership first.";
    case "NOT_ALLOWED":
      return "You do not have permission to do this.";
    default:
      return "That did not work. Please try again.";
  }
}

function selfEmailKey(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const withoutTag = local.split("+")[0] ?? local;
  const normalizedLocal = domain.toLowerCase() === "gmail.com"
    ? withoutTag.replace(/\./g, "")
    : withoutTag;
  return `${normalizedLocal}@${domain.toLowerCase()}`;
}


async function notifyMember(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  kind: string,
  title: string,
  intro: string,
  details: Array<{ label: string; value: string }>,
): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.email) return;
  const base = (env.siteUrl || env.appOrigin || "https://get-on.tech").replace(/\/$/, "");
  const mail = teamNoticeEmail({
    title,
    intro,
    details,
    actionUrl: `${base}/dashboard/team`,
    actionLabel: "Open the team",
  });
  await sendEmail({
    to: profile.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    kind,
    relatedType: "user",
    relatedId: userId,
  });
}

export async function updateTeamName(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Please use at least 2 characters." };
  if (name.length > 60) return { ok: false, error: "Please use 60 characters or fewer." };

  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.rename")) {
    return { ok: false, error: friendly("NOT_ALLOWED") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name })
    .eq("id", current.team.teamId)
    .eq("name", current.team.teamName);
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logTeamActivity({
    teamId: current.team.teamId,
    actor: { userId: current.user.id },
    event: "team_renamed",
    summary: `${current.user.email ?? "Someone"} renamed the team to ${name}`,
    meta: { from: current.team.teamName, to: name },
  });
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function inviteMembers(input: {
  items: Array<{ email: string; role: Role }>;
  message?: string;
}): Promise<
  | { ok: true; sent: number; warnings: string[]; links: Array<{ email: string; url: string }> }
  | { ok: false; error: string }
> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };

  const items = input.items
    .map((item) => ({ email: normalizeEmail(item.email), role: item.role }))
    .filter((item) => item.email.length > 0);
  if (items.length === 0) return { ok: false, error: "Please add an email address." };
  if (items.length > 5) return { ok: false, error: "You can invite up to 5 people at a time." };

  const seen = new Set<string>();
  for (const item of items) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
      return { ok: false, error: `Please check the email address ${item.email}.` };
    }
    if (seen.has(item.email)) return { ok: false, error: "You added the same email twice." };
    seen.add(item.email);
    if (!INVITE_ROLES.includes(item.role)) return { ok: false, error: friendly("INVITE_ROLE") };
    const action: Action = item.role === "admin" ? "team.invite.admin" : "team.invite.member";
    if (!can(current.team.role, action)) {
      return { ok: false, error: item.role === "admin" ? "Only the owner can invite an Admin." : friendly("NOT_ALLOWED") };
    }
    if (current.user.email && selfEmailKey(item.email) === selfEmailKey(current.user.email)) {
      return { ok: false, error: "You cannot invite yourself." };
    }
  }

  const message = String(input.message ?? "").trim().slice(0, 300);
  const admin = createAdminClient();
  const teamId = current.team.teamId;

  const { data: team } = await admin
    .from("teams")
    .select("name, plan_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "We could not find your team." };

  const [{ count: teamDay }, { count: userHour }, { data: members }, { data: pending }] =
    await Promise.all([
      admin.from("team_invitations").select("id", { count: "exact", head: true })
        .eq("team_id", teamId).gte("created_at", new Date(Date.now() - 864e5).toISOString()),
      admin.from("team_invitations").select("id", { count: "exact", head: true })
        .eq("invited_by", current.user.id).gte("created_at", new Date(Date.now() - 36e5).toISOString()),
      admin.from("team_members").select("user_id").eq("team_id", teamId),
      admin.from("team_invitations").select("email").eq("team_id", teamId).eq("status", "pending"),
    ]);
  if ((teamDay ?? 0) + items.length > 20 || (userHour ?? 0) + items.length > 10) {
    return { ok: false, error: friendly("INVITE_RATE") };
  }

  const memberIds = (members ?? []).map((row) => row.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, email").in("id", memberIds)
    : { data: [] as Array<{ id: string; email: string | null }> };
  const memberEmails = new Set((profiles ?? []).map((row) => normalizeEmail(row.email ?? "")));
  const pendingEmails = new Set((pending ?? []).map((row) => normalizeEmail(row.email)));

  for (const item of items) {
    if (memberEmails.has(item.email)) return { ok: false, error: `${item.email} is already on your team.` };
    if (pendingEmails.has(item.email)) return { ok: false, error: `${item.email} already has an invitation. You can resend it.` };
  }

  const warnings: string[] = [];
  const links: Array<{ email: string; url: string }> = [];
  let sent = 0;
  for (const item of items) {
    const { token, hash } = newInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
    const { data: invitation, error } = await admin
      .from("team_invitations")
      .insert({
        team_id: teamId,
        email: item.email,
        role: item.role,
        token_hash: hash,
        invited_by: current.user.id,
        message: message || null,
        expires_at: expiresAt,
        email_state: "queued",
      })
      .select("id")
      .maybeSingle();
    if (error || !invitation) {
      return { ok: false, error: friendly(errorCode(error)) };
    }

    const state = await sendInviteEmail({
      to: item.email,
      teamId,
      invitationId: invitation.id,
      inviterName: current.user.email ?? "A teammate",
      teamName: team.name,
      role: item.role,
      message,
      token,
      expiresAt,
    });
    await recordInviteEmailState(invitation.id, state);
    if (state === "suppressed" || state === "failed") {
      warnings.push(`We could not email ${item.email}. Copy the invitation link and send it another way.`);
      links.push({ email: item.email, url: inviteLink(token) });
    } else {
      sent += 1;
    }
    await logTeamActivity({
      teamId,
      actor: { userId: current.user.id },
      event: "invite_sent",
      summary: `${current.user.email ?? "Someone"} invited ${item.email}`,
      target: { type: "invitation", id: invitation.id, name: item.email },
      meta: { role: item.role },
    });
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true, sent, warnings, links };
}

export async function resendInvitation(invitationId: string): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.invite.member")) {
    return { ok: false, error: friendly("NOT_ALLOWED") };
  }

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("team_invitations")
    .select("id, email, role, status, last_sent_at, send_count, team_id")
    .eq("id", invitationId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!invitation || invitation.status !== "pending") {
    return { ok: false, error: friendly("INVITE_EXPIRED") };
  }
  if (invitation.role === "admin" && !can(current.team.role, "team.invite.admin")) {
    return { ok: false, error: "Only the owner can resend an Admin invitation." };
  }
  if (new Date(invitation.last_sent_at).getTime() > Date.now() - 864e5) {
    return { ok: false, error: "You can resend this invitation tomorrow." };
  }
  const { data: team } = await admin.from("teams").select("name").eq("id", current.team.teamId).maybeSingle();
  const { token, hash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
  const { error } = await admin
    .from("team_invitations")
    .update({
      token_hash: hash,
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
      send_count: Number(invitation.send_count ?? 1) + 1,
      email_state: "queued",
    })
    .eq("id", invitationId);
  if (error) return { ok: false, error: "We could not resend that invitation. Please try again." };

  const state = await sendInviteEmail({
    to: invitation.email,
    teamId: current.team.teamId,
    invitationId,
    inviterName: current.user.email ?? "A teammate",
    teamName: team?.name ?? current.team.teamName,
    role: invitation.role as Role,
    token,
    expiresAt,
  });
  await recordInviteEmailState(invitationId, state);
  await logTeamActivity({
    teamId: current.team.teamId,
    actor: { userId: current.user.id },
    event: "invite_resent",
    summary: `${current.user.email ?? "Someone"} resent the invitation to ${invitation.email}`,
    target: { type: "invitation", id: invitationId, name: invitation.email },
  });
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.invite.member")) {
    return { ok: false, error: friendly("NOT_ALLOWED") };
  }
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("team_invitations")
    .select("id, email, role, status")
    .eq("id", invitationId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!invitation || invitation.status !== "pending") {
    return { ok: false, error: friendly("INVITE_EXPIRED") };
  }
  if (invitation.role === "admin" && !can(current.team.role, "team.invite.admin")) {
    return { ok: false, error: "Only the owner can cancel an Admin invitation." };
  }
  const { error } = await admin
    .from("team_invitations")
    .update({ status: "revoked", resolved_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) return { ok: false, error: "We could not cancel that invitation. Please try again." };
  await logTeamActivity({
    teamId: current.team.teamId,
    actor: { userId: current.user.id },
    event: "invite_revoked",
    summary: `${current.user.email ?? "Someone"} cancelled the invitation for ${invitation.email}`,
    target: { type: "invitation", id: invitationId, name: invitation.email },
  });
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function changeMemberRole(userId: string, role: Role): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!["admin", "editor", "viewer"].includes(role)) {
    return { ok: false, error: friendly("INVITE_ROLE") };
  }
  const action: Action = role === "admin" ? "team.role.admin" : "team.role.member";
  if (!can(current.team.role, action)) {
    return { ok: false, error: friendly("ROLE_NOT_ALLOWED") };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_team: current.team.teamId,
    p_user: userId,
    p_role: role,
  });
  if (error) return { ok: false, error: friendly(errorCode(error)) };
  await notifyMember(
    createAdminClient(),
    userId,
    "member_role_changed",
    `Your role in ${current.team.teamName} changed`,
    `You are now ${role === "admin" ? "an Admin" : role === "editor" ? "an Editor" : "a Viewer"} in ${current.team.teamName}.`,
    [{ label: "Team", value: current.team.teamName }, { label: "New role", value: role }],
  ).catch((mailError) => console.error("[team] role email failed", mailError));
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.remove.member") && !can(current.team.role, "team.remove.admin")) {
    return { ok: false, error: friendly("NOT_ALLOWED") };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_team: current.team.teamId,
    p_user: userId,
  });
  if (error) return { ok: false, error: friendly(errorCode(error)) };
  await notifyMember(
    createAdminClient(),
    userId,
    "member_removed",
    `You were removed from ${current.team.teamName}`,
    `You no longer have access to ${current.team.teamName}. Your work stays on the websites.`,
    [{ label: "Team", value: current.team.teamName }],
  ).catch((mailError) => console.error("[team] removal email failed", mailError));
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function leaveTeam(): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.leave")) {
    return { ok: false, error: "The team owner cannot leave. Transfer ownership first." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_team", { p_team: current.team.teamId });
  if (error) return { ok: false, error: friendly(errorCode(error)) };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function transferOwnership(userId: string, confirmEmail: string): Promise<ActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "team.transfer")) {
    return { ok: false, error: friendly("NOT_ALLOWED") };
  }
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!target?.email) return { ok: false, error: "We could not find that person." };
  if (confirmEmail.trim().toLowerCase() !== target.email.trim().toLowerCase()) {
    return { ok: false, error: "Type the new owner's email exactly to confirm." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_team_ownership", {
    p_team: current.team.teamId,
    p_user: userId,
  });
  if (error) return { ok: false, error: friendly(errorCode(error)) };
  await notifyMember(
    createAdminClient(),
    userId,
    "team_ownership_transferred",
    `You are now the owner of ${current.team.teamName}`,
    `${current.user.email ?? "The previous owner"} made you the owner of ${current.team.teamName}.`,
    [{ label: "Team", value: current.team.teamName }],
  ).catch((mailError) => console.error("[team] ownership email failed", mailError));
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
