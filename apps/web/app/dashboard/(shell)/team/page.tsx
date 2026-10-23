import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { AppCard } from "@/components/app/card";
import { ListRow } from "@/components/app/list-row";
import { InfoBox } from "@/components/app/info-box";
import { SettingsSection } from "@/components/app/settings-section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TeamNameForm } from "@/components/app/team-name-form";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { PLAN_BY_ID } from "@/lib/plans";
import Link from "next/link";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_DESCRIPTION: { role: string; description: string }[] = [
  { role: "Owner", description: "Everything, including billing and deleting the team." },
  { role: "Admin", description: "Manage people and settings. Cannot delete the team." },
  { role: "Editor", description: "Edit pages and pictures." },
  { role: "Viewer", description: "Look at the website. Cannot change anything." },
];

export default async function TeamPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: membershipRows } = await supabase
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", data.currentTeam.id);

  const members = membershipRows ?? [];
  const userIds = members.map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile] as const),
  );

  const plan = PLAN_BY_ID[data.currentTeam.planId] ?? PLAN_BY_ID.free;
  const canEdit = data.currentTeam.role === "owner" || data.currentTeam.role === "admin";
  const seats = plan.maxMembers;
  const seatsUsed = members.length;

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

      <Section title="Members">
        <AppCard className="p-0">
          {members.length === 0 ? (
            <p className="px-5 py-6 text-[15px] text-text-muted">No members yet.</p>
          ) : (
            members.map((member) => {
              const profile = profileById.get(member.user_id);
              const name = profile?.full_name ?? "Team member";
              const email = profile?.email ?? "";
              const isYou = member.user_id === data.user.id;
              const role = member.role ?? "viewer";
              return (
                <ListRow
                  key={member.user_id}
                  leading={
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text"
                    >
                      {name
                        .split(/[\s@._-]+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part: string) => part[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </span>
                  }
                  title={
                    <span className="flex items-center gap-2">
                      {name}
                      {isYou ? (
                        <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-xs font-semibold text-text-muted">
                          You
                        </span>
                      ) : null}
                    </span>
                  }
                  supporting={email}
                  trailing={
                    <Badge variant={role === "owner" ? "primary" : "neutral"}>
                      {ROLE_LABEL[role] ?? role}
                    </Badge>
                  }
                />
              );
            })
          )}
        </AppCard>
      </Section>

      <Section title="Invite people">
        <AppCard className="p-5">
          <InfoBox variant={seats === 1 ? "warning" : "info"} className="mb-5">
            {seats === 1 ? (
              <span>
                Your {plan.name} plan includes 1 team member.{" "}
                <Link
                  href="/dashboard/plan"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  Upgrade to add more people.
                </Link>
              </span>
            ) : seats === null ? (
              <span>Invitations are coming soon.</span>
            ) : (
              <span>
                {seatsUsed} of {seats} seats used. Invitations are coming soon.
              </span>
            )}
          </InfoBox>

          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-[1fr_200px_auto] min-[640px]:items-end">
            <div>
              <label
                htmlFor="invite-email"
                className="block text-sm font-semibold text-text"
              >
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                disabled
                aria-disabled="true"
                placeholder="name@example.com"
                className="mt-1.5 h-12 w-full cursor-not-allowed rounded-input border-[1.5px] border-border bg-surface px-3.5 text-base text-text-muted opacity-60"
              />
            </div>
            <div>
              <label
                htmlFor="invite-role"
                className="block text-sm font-semibold text-text"
              >
                Role
              </label>
              <select
                id="invite-role"
                disabled
                aria-disabled="true"
                defaultValue="editor"
                className="mt-1.5 h-12 w-full cursor-not-allowed rounded-input border-[1.5px] border-border bg-surface px-3.5 text-base text-text-muted opacity-60"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "w-full cursor-not-allowed opacity-50 min-[640px]:w-auto",
              })}
            >
              Send invite
            </button>
          </div>
        </AppCard>
      </Section>

      <Section title="What each role can do">
        <AppCard className="p-0">
          {ROLE_DESCRIPTION.map((entry, index) => (
            <div
              key={entry.role}
              className={
                index === 0
                  ? "flex flex-col gap-1 px-5 py-4"
                  : "flex flex-col gap-1 border-t border-border px-5 py-4"
              }
            >
              <Badge variant={entry.role === "Owner" ? "primary" : "neutral"} className="self-start">
                {entry.role}
              </Badge>
              <p className="text-[15px] text-text-muted">{entry.description}</p>
            </div>
          ))}
        </AppCard>
      </Section>

      <Section title="Team settings">
        <AppCard className="px-5">
          <SettingsSection title="Team name" description="The name your team sees.">
            <TeamNameForm teamName={data.currentTeam.name} canEdit={canEdit} />
          </SettingsSection>
        </AppCard>
      </Section>
    </AppPage>
  );
}
