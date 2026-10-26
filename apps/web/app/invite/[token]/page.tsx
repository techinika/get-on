import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken, roleAbilities } from "@/lib/team/invitations";
import { InviteButtons } from "./invite-buttons";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "a different address";
  return `${local.slice(0, 1)}***@${domain}`;
}

function roleLabel(role: string): string {
  return role === "admin" ? "Admin" : role === "editor" ? "Editor" : "Viewer";
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("team_invitations")
    .select("id, team_id, email, role, status, message, expires_at, invited_by, accepted_by")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  let teamName = "the team";
  let inviterName = "A teammate";
  if (invitation) {
    const [{ data: teamRow }, { data: inviter }] = await Promise.all([
      admin.from("teams").select("name").eq("id", invitation.team_id).maybeSingle(),
      invitation.invited_by
        ? admin.from("profiles").select("full_name, email").eq("id", invitation.invited_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    teamName = teamRow?.name ?? "the team";
    inviterName = inviter?.full_name ?? inviter?.email ?? "A teammate";
  }

  let emailVerified = false;
  if (user) {
    const { data: account } = await admin.auth.admin.getUserById(user.id);
    emailVerified = Boolean(account?.user?.email_confirmed_at);
  }

  const expired = !invitation || invitation.status !== "pending" || new Date(invitation.expires_at) < new Date();
  const acceptedByMe = invitation?.status === "accepted" && invitation.accepted_by === user?.id;
  const wrongEmail = Boolean(
    invitation && user && invitation.email.toLowerCase() !== (user.email ?? "").toLowerCase(),
  );

  const card = "mx-auto w-full max-w-[520px] rounded-[24px] border border-border bg-surface p-8 shadow-card";
  const iconCircle = "mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full";

  if (acceptedByMe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
        <div className={card}>
          <div className={`${iconCircle} bg-success-soft text-success-text`}>
            <CheckCircle2 size={32} aria-hidden />
          </div>
          <h1 className="mt-6 text-center font-heading text-[28px] font-bold text-text">
            Welcome to {teamName}!
          </h1>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-input bg-primary px-6 text-base font-semibold text-on-primary hover:bg-primary-hover"
            >
              Open the dashboard
            </Link>
            <Link
              href="/dashboard/team"
              className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
            >
              See the team
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (expired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
        <div className={card}>
          <div className={`${iconCircle} bg-surface-muted text-text-muted`}>
            <AlertCircle size={32} aria-hidden />
          </div>
          <h1 className="mt-6 text-center font-heading text-[26px] font-bold text-text">
            This invitation has ended
          </h1>
          <p className="mt-3 text-center text-base text-text-muted">
            Ask {inviterName} or the team to send a new one.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-input bg-primary px-6 text-base font-semibold text-on-primary hover:bg-primary-hover"
          >
            Go to my dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (wrongEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
        <div className={card}>
          <div className={`${iconCircle} bg-danger-soft text-danger-text`}>
            <AlertCircle size={32} aria-hidden />
          </div>
          <h1 className="mt-6 text-center font-heading text-[26px] font-bold text-text">
            This invitation is for a different email
          </h1>
          <p className="mt-3 text-center text-base text-text-muted">
            It was sent to {maskEmail(invitation.email)}. You are logged in as {user?.email}.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/login?next=/invite/${token}&email=${encodeURIComponent(invitation.email)}`}
              className="inline-flex h-11 items-center justify-center rounded-input bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-hover"
            >
              Log out and use {maskEmail(invitation.email)}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
            >
              Go to my dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className={card}>
        <div className={`${iconCircle} bg-accent-soft text-accent-text`}>
          <Users size={32} aria-hidden />
        </div>
        <h1 className="mt-6 text-center font-heading text-[28px] font-bold text-text">
          You have been invited
        </h1>
        <p className="mt-3 text-center text-base text-text-muted">
          {inviterName} invited you to join {teamName} as {roleLabel(invitation.role) === "Admin" ? "an" : "a"}{" "}
          <strong className="text-text">{roleLabel(invitation.role)}</strong>.
        </p>
        {invitation.message ? (
          <blockquote className="mt-5 rounded-info bg-surface-muted px-4 py-3 text-[15px] italic text-text">
            {invitation.message}
          </blockquote>
        ) : null}
        <div className="mt-6">
          <p className="text-sm font-semibold text-text">What you can do</p>
          <ul className="mt-2 space-y-2">
            {roleAbilities(invitation.role as "admin" | "editor" | "viewer").map((ability) => (
              <li key={ability} className="flex items-start gap-2 text-sm text-text-muted">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text" aria-hidden />
                {ability}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-[13px] text-text-muted">
          This invitation ends on{" "}
          {new Date(invitation.expires_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>

        {user ? (
          emailVerified ? (
            <div className="mt-6">
              <InviteButtons token={token} teamName={teamName} />
            </div>
          ) : (
            <div className="mt-6 rounded-info bg-warning-soft p-4 text-sm text-warning-text">
              Please confirm your email address first. We sent you a link when you signed up.
            </div>
          )
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/login?next=/invite/${token}&email=${encodeURIComponent(invitation.email)}`}
              className="inline-flex h-12 items-center justify-center rounded-input bg-primary px-6 text-base font-semibold text-on-primary hover:bg-primary-hover"
            >
              Log in
            </Link>
            <Link
              href={`/signup?next=/invite/${token}&email=${encodeURIComponent(invitation.email)}`}
              className="inline-flex h-12 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-6 text-base font-semibold text-text hover:bg-surface-muted"
            >
              Create an account
            </Link>
            <p className="text-center text-[13px] text-text-muted">
              Use {invitation.email} so we can match your invitation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
