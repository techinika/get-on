import { Suspense } from "react";
import { MailCheck } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const instant = false;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  if (params.message) {
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
            If that address has an account, a reset link is on its way.
          </p>
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
