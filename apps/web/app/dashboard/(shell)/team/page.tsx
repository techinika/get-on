import * as React from "react";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { AppCard } from "@/components/app/card";
import { SettingsSection } from "@/components/app/settings-section";
import { TeamNameForm } from "@/components/app/team-name-form";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { PLAN_BY_ID } from "@/lib/plans";
import { can } from "@/lib/permissions";
import { matrix, type Role } from "@get-on/permissions";
import matrixJson from "@get-on/permissions/matrix.json";
import { TeamManager, type InvitationItem, type TeamMemberItem } from "./team-manager";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const GROUPS: Array<{ label: string; actions: string[] }> = [
  { label: "Websites", actions: ["site.view", "site.create", "site.delete", "site.restore", "site.purge", "site.transfer"] },
  { label: "Pages and design", actions: ["page.edit", "page.publish", "site.settings", "site.domains", "site.plugins", "site.backups", "messages.read"] },
  { label: "Templates and AI", actions: ["template.use", "template.manage", "template.delete", "ai.use", "ai.limits", "ai.ledger.all"] },
  { label: "Team", actions: ["team.view", "team.invite.admin", "team.invite.member", "team.role.admin", "team.role.member", "team.remove.admin", "team.remove.member", "team.rename", "team.transfer", "team.leave", "team.activity", "site.activity"] },
  { label: "Plan and referrals", actions: ["plan.view", "plan.manage", "referral.use"] },
];

export default async function TeamPage() {
  const data = await getShellData();
  if (!data) redirect("/login");

  const supabase = await createClient();
  const role = data.currentTeam.role as Role;

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, plan_id, is_personal")
    .eq("id", data.currentTeam.id)
    .maybeSingle();

  const [{ data: membershipRows }, { data: seatData }] = await Promise.all([
    supabase
      .from("team_members")
      .select("user_id, role, status, joined_at")
      .eq("team_id", data.currentTeam.id),
    supabase.rpc("team_seat_usage", { p_team: data.currentTeam.id }),
  ]);

  const members = membershipRows ?? [];
  const userIds = members.map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));

  const canInvite = can(role, "team.invite.member") || can(role, "team.invite.admin");
  const { data: invitations } = canInvite
    ? await supabase
        .from("team_invitations")
        .select("id, email, role, created_at, expires_at, last_sent_at, email_state")
        .eq("team_id", data.currentTeam.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
    : { data: [] };

  const plan = PLAN_BY_ID[data.currentTeam.planId] ?? PLAN_BY_ID.free;
  const seats = (seatData ?? {}) as {
    active_members?: number;
    pending_invitations?: number;
    seats_used?: number;
    seats_limit?: number | null;
  };

  const memberItems: TeamMemberItem[] = members.map((member) => {
    const profile = profileById.get(member.user_id);
    const name = profile?.full_name ?? profile?.email ?? "Team member";
    return {
      userId: member.user_id,
      name,
      email: canInvite ? (profile?.email ?? "") : "",
      role: member.role as Role,
      status: (member.status ?? "active") as "active" | "paused",
      joinedAt: member.joined_at ?? new Date().toISOString(),
      isYou: member.user_id === data.user.id,
    };
  });

  const invitationItems: InvitationItem[] = (invitations ?? []).map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role as Role,
    createdAt: invitation.created_at,
    expiresAt: invitation.expires_at,
    lastSentAt: invitation.last_sent_at,
    emailState: invitation.email_state as InvitationItem["emailState"],
  }));

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: "Team" },
        ]}
        title="Team"
        description={`People who can work on ${data.currentTeam.name}.`}
      />

      <TeamManager
        teamName={data.currentTeam.name}
        currentUserId={data.user.id}
        role={role}
        planName={plan.name}
        seats={{
          used: seats.seats_used ?? members.length,
          limit: seats.seats_limit ?? plan.maxMembers,
          members: seats.active_members ?? members.filter((m) => m.status === "active").length,
          invitations: seats.pending_invitations ?? invitationItems.length,
        }}
        members={memberItems}
        invitations={invitationItems}
        canInvite={canInvite}
        canManageRoles={can(role, "team.role.member") || can(role, "team.role.admin")}
        canRemove={can(role, "team.remove.member") || can(role, "team.remove.admin")}
        canTransfer={can(role, "team.transfer") && !team?.is_personal}
        canLeave={can(role, "team.leave")}
      />

      <Section title="What can each role do?" className="mt-8">
        <AppCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">What each role can do</caption>
            <thead>
              <tr className="bg-surface-muted">
                <th scope="col" className="sticky left-0 bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.06em] text-text-muted">
                  Action
                </th>
                {(["owner", "admin", "editor", "viewer"] as Role[]).map((roleName) => (
                  <th key={roleName} scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-[0.06em] text-text-muted">
                    {ROLE_LABEL[roleName]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <React.Fragment key={group.label}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={5}
                      className="border-t border-border bg-surface px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
                    >
                      {group.label}
                    </th>
                  </tr>
                  {group.actions.map((action) => {
                    const meta = matrixJson.actions.find((entry) => entry.id === action);
                    const row = matrix[action as keyof typeof matrix];
                    if (!meta || !row) return null;
                    return (
                      <tr key={action} className="border-t border-border">
                        <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 text-sm font-medium text-text">
                          {meta.label}
                        </th>
                        {(["owner", "admin", "editor", "viewer"] as Role[]).map((roleName) => (
                          <td key={roleName} className="px-4 py-2.5 text-sm">
                            {row[roleName] ? (
                              <span aria-label="Yes" className="text-success-text">✓</span>
                            ) : (
                              <span aria-label="No" className="text-text-muted">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </AppCard>
      </Section>

      <Section title="Team details">
        <AppCard className="px-5">
          <SettingsSection title="Team name" description="The name your team sees.">
            <TeamNameForm teamName={data.currentTeam.name} canEdit={can(role, "team.rename")} />
          </SettingsSection>
        </AppCard>
      </Section>
    </AppPage>
  );
}
