import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaSetupForm } from "@/components/auth/mfa-setup-form";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up two-step sign-in | Get-On",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function MfaSetupPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext, "/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp ?? []).some((factor) => factor.status === "verified");
  if (hasTotp) {
    redirect(`/mfa?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthShell>
      <h1 className="text-[28px] font-semibold leading-tight text-text">Set up two-step sign-in</h1>
      <p className="mt-2 text-base text-text-muted">
        Add Get-On to an authenticator app such as Google Authenticator, Microsoft Authenticator or
        1Password. Then enter the six-digit code it shows.
      </p>
      <MfaSetupForm next={next} />
    </AuthShell>
  );
}
