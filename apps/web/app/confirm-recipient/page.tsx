import type { Metadata } from "next";
import { createHash } from "node:crypto";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Confirm your email address - Get-On",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type State =
  | { kind: "success"; site: string; email: string }
  | { kind: "expired" }
  | { kind: "invalid" };

async function confirm(token: string): Promise<State> {
  if (!token || token.length < 20) return { kind: "invalid" };
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("contact_recipients")
    .select("id, project_id, email, verified_at, token_expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!recipient) return { kind: "invalid" };

  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", recipient.project_id)
    .maybeSingle();

  if (recipient.verified_at) {
    return { kind: "success", site: project?.name ?? "your website", email: recipient.email };
  }

  if (!recipient.token_expires_at || new Date(recipient.token_expires_at).getTime() < Date.now()) {
    return { kind: "expired" };
  }

  const { error } = await admin
    .from("contact_recipients")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", recipient.id)
    .is("verified_at", null);
  if (error) return { kind: "invalid" };

  return { kind: "success", site: project?.name ?? "your website", email: recipient.email };
}

export default async function ConfirmRecipientPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  let state: State;
  try {
    state = await confirm(query.token ?? "");
  } catch {
    state = { kind: "invalid" };
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app-bg px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-[440px] rounded-dialog border border-border bg-surface p-8 text-center">
        {state.kind === "success" ? (
          <>
            <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-soft text-success-text">
              <Check size={32} strokeWidth={2} aria-hidden />
            </span>
            <h1 className="mt-5 font-heading text-[28px] font-bold text-text">Email confirmed</h1>
            <p className="mt-2 text-base text-text-muted">
              You will now get messages from {state.site} at {state.email}.
            </p>
          </>
        ) : state.kind === "expired" ? (
          <>
            <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-warning-soft text-warning-text">
              <AlertTriangle size={30} strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="mt-5 font-heading text-[28px] font-bold text-text">This link has expired</h1>
            <p className="mt-2 text-base text-text-muted">
              Ask the website owner to send a new one.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-soft text-danger-text">
              <AlertCircle size={30} strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="mt-5 font-heading text-[28px] font-bold text-text">
              We could not use this link
            </h1>
            <p className="mt-2 text-base text-text-muted">
              Ask the website owner to send a new one.
            </p>
          </>
        )}

        <Link
          href={state.kind === "success" ? "/dashboard" : "/"}
          className={`${buttonVariants({ variant: "secondary", size: "md" })} mt-6`}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
          Go to Get-On
        </Link>
      </div>
    </main>
  );
}
