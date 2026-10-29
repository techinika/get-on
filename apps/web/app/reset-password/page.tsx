import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthShell } from "@/components/auth/auth-shell";
import { findAuthToken } from "@/lib/auth/recovery";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

function Card({
  tone,
  title,
  body,
  action,
}: {
  tone: "success" | "warning";
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className={
            tone === "success"
              ? "flex h-14 w-14 items-center justify-center rounded-pill bg-success-soft text-success"
              : "flex h-14 w-14 items-center justify-center rounded-pill bg-warning-soft text-warning-text"
          }
        >
          <Icon size={26} strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-h3">{title}</h1>
        <p className="mt-2 text-base text-text-muted">{body}</p>
        <Link href={action.href} className="mt-6 text-sm font-semibold text-primary">
          {action.label}
        </Link>
      </div>
    </AuthShell>
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.done === "1") {
    return (
      <Card
        tone="success"
        title="Your password was changed"
        body="You were signed out on every device. Log in with your new password."
        action={{ href: "/login", label: "Log in" }}
      />
    );
  }

  const row = params.t ? await findAuthToken(params.t, "password_reset") : null;
  if (!row) {
    return (
      <Card
        tone="warning"
        title="That link is no longer valid"
        body="Reset links work once and expire after 30 minutes. Ask for a new one and we will email it to you."
        action={{ href: "/forgot-password", label: "Ask for a new link" }}
      />
    );
  }

  return (
    <AuthShell>
      <AuthHeader
        title="Choose a new password"
        subtitle="Use at least 10 characters. A few words that only you would put together works well."
      />
      <Suspense fallback={null}>
        <AuthMessage />
      </Suspense>
      <ResetPasswordForm token={String(params.t)} />
    </AuthShell>
  );
}
