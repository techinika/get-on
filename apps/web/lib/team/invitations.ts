import { createHmac, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/enqueue";
import { teamInviteEmail } from "@get-on/email";
import env from "@/lib/env";
import { logTeamActivity } from "@/lib/activity/log";
import type { Role } from "@get-on/permissions";

export const INVITE_DAYS = 7;

export function invitePepper(): string {
  return process.env.INVITE_TOKEN_PEPPER ?? "dev-invite-pepper-change-me";
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHmac("sha256", invitePepper()).update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function inviteLink(token: string): string {
  const base = env.siteUrl || env.appOrigin || "https://get-on.tech";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export function roleAbilities(role: Role): string[] {
  if (role === "admin") {
    return [
      "manage people, websites and settings",
      "invite editors and viewers",
      "use everything except changing the owner or the plan",
    ];
  }
  if (role === "editor") {
    return ["edit pages, pictures and design", "publish changes", "use AI and backups"];
  }
  return ["see websites, pages and pictures", "see who is in the team", "use their own referral link"];
}

export async function sendInviteEmail(input: {
  to: string;
  teamId: string;
  invitationId: string;
  inviterName: string;
  teamName: string;
  role: Role;
  message?: string | null;
  token: string;
  expiresAt: string;
}): Promise<"sent" | "queued" | "failed" | "suppressed"> {
  const template = teamInviteEmail({
    inviterName: input.inviterName,
    teamName: input.teamName,
    role: input.role as "admin" | "editor" | "viewer",
    message: input.message,
    acceptUrl: inviteLink(input.token),
    expiresAt: new Date(input.expiresAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    abilities: roleAbilities(input.role),
  });
  const result = await enqueueEmail({
    kind: "team_invite",
    toEmail: input.to,
    relatedType: "team_invitation",
    relatedId: input.invitationId,
    dedupeKey: `invite:${input.invitationId}`,
    payload: {
      subject: template.subject,
      text: template.text,
      html: template.html,
    },
  });
  return result.ok ? ("queued" as const) : ("failed" as const);
}

export async function recordInviteEmailState(
  invitationId: string,
  status: "sent" | "queued" | "failed" | "suppressed",
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("team_invitations")
    .update({
      email_state:
        status === "sent" ? "sent" : status === "suppressed" ? "suppressed" : status === "failed" ? "failed" : "queued",
    })
    .eq("id", invitationId);
}

export async function logInvite(
  teamId: string,
  actor: { userId: string; name: string; role: string },
  event: "invite_sent" | "invite_resent" | "invite_revoked" | "invite_declined" | "invite_expired",
  email: string,
  invitationId: string,
): Promise<void> {
  const verb = {
    invite_sent: "invited",
    invite_resent: "resent the invitation to",
    invite_revoked: "cancelled the invitation for",
    invite_declined: "declined the invitation for",
    invite_expired: "expired the invitation for",
  }[event];
  await logTeamActivity({
    teamId,
    actor: { userId: actor.userId, name: actor.name, role: actor.role },
    event,
    summary: `${actor.name} ${verb} ${email}`,
    target: { type: "invitation", id: invitationId, name: email },
  });
}
