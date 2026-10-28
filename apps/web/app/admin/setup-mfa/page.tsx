import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin";
import { MfaSetupForm } from "./mfa-setup-form";

export const metadata = {
  title: "Set up your authenticator | Get-On",
  robots: { index: false, follow: false },
};

export default async function StaffMfaSetupPage() {
  const staff = await getStaffSession();
  if (!staff) notFound();
  if (staff.mfaSatisfied) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">Set up your authenticator</h1>
      <p className="mt-2 text-sm text-text-muted">
        Staff accounts need an authenticator app before you can open the staff
        console. Add the code below to your app, then enter the six-digit code.
      </p>
      <MfaSetupForm />
    </main>
  );
}
