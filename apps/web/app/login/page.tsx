import { Suspense } from "react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import env from "@/lib/env";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ next?: string; email?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, email, error } = await searchParams;
  return (
    <AuthShell>
      <AuthHeader title="Welcome back" subtitle="Log in to manage your website." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <div className="mt-6 flex items-start gap-2.5 rounded-input border border-info-border bg-info-soft px-3.5 py-3 text-sm text-info-text">
        <span>We added two-step sign-in. After you log in, we email you a code.</span>
      </div>
      <LoginForm enableGoogleAuth={env.enableGoogleAuth} next={next} email={email} showTurnstile={Boolean(error)} />
      <AuthFooter prompt="New here?" action="Create a free account" href="/signup" />
    </AuthShell>
  );
}
