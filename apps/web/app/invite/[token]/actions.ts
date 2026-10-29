"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/team/invitations";
import { TEAM_COOKIE } from "@/lib/dashboard";
import { logTeamActivity } from "@/lib/activity/log";
import { enqueueEmail } from "@/lib/email/enqueue";
import { teamNoticeEmail } from "@get-on/email";
import env from "@/lib/env";

export type InviteActionResult = { ok: true } | { ok: false; error: string };

function code(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error);
  const match = message.match(/\b(SEATS_FULL|INVITE_EXPIRED|INVITE_EMAIL_MISMATCH|INVITE_EMAIL_UNVERIFIED|NOT_ALLOWED)\b/);
  return match?.[1] ?? "UNKNOWN";
}

function message(error: string): string {
  switch (error) {
    case "SEATS_FULL":
      return "This team has no free seats right now. Ask the person who invited you to make room.";
    case "INVITE_EMAIL_MISMATCH":
      return "This invitation was sent to a different email address.";
    case "INVITE_EMAIL_UNVERIFIED":
      return "Please confirm your email address first, then try again.";
    case "INVITE_EXPIRED":
      return "This invitation has ended. Ask for a new one.";
    default:
      return "That did not work. Please try again.";
  }
}

export async function acceptInvitation(token: string): Promise<InviteActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: hashInviteToken(token),
  });
  if (data && typeof data === "object" && "team_id" in data) {
    const teamId = String((data as { team_id: string }).team_id);
    const store = await cookies();
    store.set(TEAM_COOKIE, teamId, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    try {
      const admin = createAdminClient();
      const { data: invitation } = await admin
        .from("team_invitations")
        .select("invited_by, email")
        .eq("token_hash", hashInviteToken(token))
        .maybeSingle();
      if (invitation?.invited_by) {
        const { data: inviter } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", invitation.invited_by)
          .maybeSingle();
        const { data: team } = await admin.from("teams").select("name").eq("id", teamId).maybeSingle();
        if (inviter?.email) {
          const base = (env.siteUrl || env.appOrigin || "https://get-on.tech").replace(/\/$/, "");
          const mail = teamNoticeEmail({
            title: `${invitation.email} joined ${team?.name ?? "your team"}`,
            intro: `${invitation.email} accepted your invitation.`,
            details: [{ label: "Team", value: team?.name ?? "Your team" }],
            actionUrl: `${base}/dashboard/team`,
            actionLabel: "See the team",
          });
          await enqueueEmail({
            kind: "invite_accepted",
            toEmail: inviter.email,
            relatedType: "team",
            relatedId: teamId,
            dedupeKey: `invite-accepted:${teamId}:${invitation.email}`,
            payload: {
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
            },
          });
        }
      }
    } catch (mailError) {
      console.error("[invite] accepted email failed", mailError);
    }
    redirect("/dashboard/team?joined=1");
  }
  return { ok: false, error: message(code(error)) };
}

export async function declineInvitation(token: string): Promise<InviteActionResult> {
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("team_invitations")
    .select("id, team_id, email, invited_by, status")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invitation || invitation.status !== "pending") {
    return { ok: false, error: "This invitation has ended. Ask for a new one." };
  }
  const { error } = await admin
    .from("team_invitations")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", invitation.id);
  if (error) return { ok: false, error: "That did not work. Please try again." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const actor = auth.user && auth.user.email?.toLowerCase() === invitation.email.toLowerCase()
    ? { userId: auth.user.id }
    : { userId: null, kind: "system" as const, name: "Get-On" };
  try {
    if (invitation.invited_by) {
      const { data: inviter } = await admin
        .from("profiles")
        .select("email")
        .eq("id", invitation.invited_by)
        .maybeSingle();
      const { data: team } = await admin.from("teams").select("name").eq("id", invitation.team_id).maybeSingle();
      if (inviter?.email) {
        const mail = teamNoticeEmail({
          title: `Your invitation to ${invitation.email} was declined`,
          intro: `${invitation.email} declined the invitation to ${team?.name ?? "your team"}.`,
          details: [{ label: "Team", value: team?.name ?? "Your team" }],
        });
        await enqueueEmail({
          kind: "invite_declined",
          toEmail: inviter.email,
          relatedType: "team",
          relatedId: invitation.team_id,
          dedupeKey: `invite-declined:${invitation.id}`,
          payload: {
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          },
        });
      }
    }
  } catch (mailError) {
    console.error("[invite] declined email failed", mailError);
  }
  await logTeamActivity({
    teamId: invitation.team_id,
    actor,
    event: "invite_declined",
    summary: actor.userId
      ? `${auth.user?.email ?? "Someone"} declined the invitation`
      : `The invitation for ${invitation.email} was declined`,
    target: { type: "invitation", id: invitation.id, name: invitation.email },
  });
  return { ok: true };
}
