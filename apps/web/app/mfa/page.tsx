import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter your sign-in code | Get-On",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function MfaPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext, "/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp ?? []).some((factor) => factor.status === "verified");
  if (!hasTotp) {
    redirect(`/mfa/setup?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthShell>
      <h1 className="text-[28px] font-semibold leading-tight text-text">Enter your sign-in code</h1>
      <p className="mt-2 text-base text-text-muted">
        Open your authenticator app and enter the six-digit code for Get-On.
      </p>
      <MfaChallengeForm next={next} />
      <div className="mt-6 text-sm text-text-muted">
        <Link href="/login" className="font-semibold text-primary underline">
          Use a different account
        </Link>
      </div>
    </AuthShell>
  );
}
