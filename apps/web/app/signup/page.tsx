import { Suspense } from "react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import env from "@/lib/env";
import { SignupForm } from "./signup-form";

type Props = { searchParams: Promise<{ next?: string; email?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { next, email } = await searchParams;
  return (
    <AuthShell>
      <AuthHeader title="Create your free account" subtitle="It takes less than a minute." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <SignupForm enableGoogleAuth={env.enableGoogleAuth} next={next} email={email} />
      <AuthFooter prompt="Already have an account?" action="Log in" href="/login" />
    </AuthShell>
  );
}
