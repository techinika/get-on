import { Suspense } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeader title="Set a new password" subtitle="Choose a password with at least 8 characters." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <ResetPasswordForm />
    </AuthShell>
  );
}
