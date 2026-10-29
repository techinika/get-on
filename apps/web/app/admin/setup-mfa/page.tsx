import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./mfa-challenge-form";
import { MfaSetupForm } from "./mfa-setup-form";

export const metadata = {
  title: "Set up your authenticator | Get-On",
  robots: { index: false, follow: false },
};

export default async function StaffMfaSetupPage() {
  const staff = await getStaffSession();
  if (!staff) notFound();
  if (staff.mfaSatisfied) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (data?.totp ?? []).some(
    (factor) => factor.status === "verified",
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">
        {hasVerifiedFactor
          ? "Enter your authenticator code"
          : "Set up your authenticator"}
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        {hasVerifiedFactor
          ? "This account already has an authenticator. Enter the current six-digit code to open the staff console."
          : "Staff accounts need an authenticator app before you can open the staff console. Add the code below to your app, then enter the six-digit code."}
      </p>
      {hasVerifiedFactor ? <MfaChallengeForm /> : <MfaSetupForm />}
    </main>
  );
}
