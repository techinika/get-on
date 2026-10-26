import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashTransferToken, normalizeTransferEmail } from "@/lib/team/transfers";
import { TransferActions } from "./transfer-actions";

type Params = { params: Promise<{ token: string }> };

type TeamOption = {
  id: string;
  name: string;
  role: string;
  canAccept: boolean;
  reason?: string;
};

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] items-center justify-center p-6">
      <div className="w-full rounded-card bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Get-On</p>
        <h1 className="mt-2 font-heading text-[28px] font-bold text-text">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default async function TransferPage({ params }: Params) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/transfer/${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: transfer } = await admin
    .from("ownership_transfers")
    .select("id, project_id, from_team_id, to_email, status, expires_at, message")
    .eq("token_hash", hashTransferToken(token))
    .maybeSingle();

  if (!transfer) {
    return (
      <Shell title="This link is not valid">
        <p className="mt-3 text-[15px] leading-6 text-text-muted">
          Ask the person who sent it to start the transfer again.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary">
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  if (transfer.status !== "pending") {
    const label =
      transfer.status === "accepted"
        ? "This website has already been accepted."
        : transfer.status === "declined"
          ? "This transfer was declined."
          : transfer.status === "expired"
            ? "This transfer has ended."
            : "This transfer was cancelled.";
    return (
      <Shell title="Nothing to do">
        <p className="mt-3 text-[15px] leading-6 text-text-muted">{label}</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary">
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  if (normalizeTransferEmail(transfer.to_email ?? "") !== normalizeTransferEmail(user.email ?? "")) {
    return (
      <Shell title="This is for a different email">
        <p className="mt-3 text-[15px] leading-6 text-text-muted">
          This transfer was sent to {transfer.to_email}. You are signed in as {user.email}.
          Sign in with the other address to accept it.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary">
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  const [{ data: project }, { data: fromTeam }, { data: memberships }] = await Promise.all([
    admin
      .from("projects")
      .select("id, name, subdomain, deleted_at")
      .eq("id", transfer.project_id)
      .maybeSingle(),
    admin.from("teams").select("name").eq("id", transfer.from_team_id).maybeSingle(),
    admin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"]),
  ]);

  if (!project || project.deleted_at) {
    return (
      <Shell title="This website is no longer available">
        <p className="mt-3 text-[15px] leading-6 text-text-muted">
          It was deleted before the transfer was accepted.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary">
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  const teamIds = (memberships ?? []).map((row) => row.team_id);
  const [{ data: teams }, pageTotal, { data: siteRows }] = await Promise.all([
    teamIds.length
      ? admin.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    admin.from("pages").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    teamIds.length
      ? admin.from("projects").select("team_id").in("team_id", teamIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as Array<{ team_id: string }> }),
  ]);

  type Limits = { maxWebsites: number | null; maxPagesPerSite: number | null };
  const accessRows = await Promise.all(
    (teams ?? []).map(async (team) => {
      const { data } = await admin.rpc("billing_resolve_team", { p_team: team.id });
      const limits = (data as { limits?: Limits } | null)?.limits;
      return [team.id, limits ?? null] as const;
    }),
  );
  const limitsByTeam = new Map(accessRows);
  const sitesByTeam = new Map<string, number>();
  for (const row of siteRows ?? []) {
    sitesByTeam.set(row.team_id, (sitesByTeam.get(row.team_id) ?? 0) + 1);
  }
  const pages = pageTotal.count ?? 0;
  const roleByTeam = new Map((memberships ?? []).map((row) => [row.team_id, row.role]));

  const options: TeamOption[] = (teams ?? []).map((team) => {
    const limits = limitsByTeam.get(team.id);
    const used = sitesByTeam.get(team.id) ?? 0;
    const siteRoom =
      !limits ||
      limits.maxWebsites === null ||
      used < limits.maxWebsites;
    const pageRoom =
      !limits ||
      limits.maxPagesPerSite === null ||
      pages <= limits.maxPagesPerSite;
    return {
      id: team.id,
      name: team.name,
      role: roleByTeam.get(team.id) ?? "owner",
      canAccept: siteRoom && pageRoom,
      reason: !siteRoom
        ? "No room for another website on this plan."
        : !pageRoom
          ? "This plan allows fewer pages than the website has."
          : undefined,
    };
  });

  return (
    <Shell title="A website is waiting for you">
      <p className="mt-3 text-[15px] leading-6 text-text-muted">
        {fromTeam?.name ?? "Another team"} wants to send you a website.
        The website and its pages move to the team you choose. Your current team is not changed.
      </p>
      <div className="mt-5 rounded-card border border-border bg-surface-muted p-4">
        <p className="text-[17px] font-semibold text-text">{project.name}</p>
        <p className="mt-1 text-sm text-text-muted">
          {project.subdomain}.get-on.tech · from {fromTeam?.name ?? "another team"}
        </p>
        {transfer.message ? (
          <p className="mt-3 whitespace-pre-wrap rounded-input bg-surface p-3 text-sm text-text">
            {transfer.message}
          </p>
        ) : null}
      </div>
      <TransferActions token={token} teams={options} />
      <p className="mt-5 text-xs leading-5 text-text-muted">
        This link ends on{" "}
        {new Date(transfer.expires_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        . Accepting never publishes the website. Plan limits are checked when you accept.
      </p>
    </Shell>
  );
}
