import { Suspense } from "react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import env from "@/lib/env";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ next?: string; email?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, email } = await searchParams;
  return (
    <AuthShell>
      <AuthHeader title="Welcome back" subtitle="Log in to manage your website." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <LoginForm enableGoogleAuth={env.enableGoogleAuth} next={next} email={email} />
      <AuthFooter prompt="New here?" action="Create a free account" href="/signup" />
    </AuthShell>
  );
}
