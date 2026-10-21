import { Suspense } from "react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import env from "@/lib/env";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthHeader title="Create your free account" subtitle="It takes less than a minute." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <SignupForm enableGoogleAuth={env.enableGoogleAuth} />
      <AuthFooter prompt="Already have an account?" action="Log in" href="/login" />
    </AuthShell>
  );
}
