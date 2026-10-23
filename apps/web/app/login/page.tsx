import { Suspense } from "react";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import env from "@/lib/env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthHeader title="Welcome back" subtitle="Log in to manage your website." />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <LoginForm enableGoogleAuth={env.enableGoogleAuth} />
      <AuthFooter prompt="New here?" action="Create a free account" href="/signup" />
    </AuthShell>
  );
}
