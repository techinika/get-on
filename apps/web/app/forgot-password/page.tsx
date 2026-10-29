import { Suspense } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.sent === "1") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-pill bg-primary-soft text-primary"
          >
            <MailCheck size={26} strokeWidth={1.75} />
          </span>
          <h1 className="mt-4 text-h3">Check your email</h1>
          <p className="mt-2 text-base text-text-muted">
            If that address has an account, a reset link is on its way. The link works for 30 minutes and can be
            used once.
          </p>
          <Link href="/login" className="mt-6 text-sm font-semibold text-primary">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeader title="Reset your password" subtitle="Enter your email and we will send you a link." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
