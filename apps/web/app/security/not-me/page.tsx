import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { findAuthToken } from "@/lib/auth/recovery";
import { NotMeForm } from "./not-me-form";

export const metadata: Metadata = {
  title: "Secure your account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function NotMePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.done === "1") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-pill bg-success-soft text-success"
          >
            <CheckCircle2 size={26} strokeWidth={1.75} />
          </span>
          <h1 className="mt-4 text-h3">Your account is secured</h1>
          <p className="mt-2 text-base text-text-muted">
            We signed out every device. Check your email to choose a new password.
          </p>
          {params.error ? (
            <p className="mt-3 text-sm text-danger-text">
              We could not send the email just now. Use the reset link on the log in page instead.
            </p>
          ) : null}
          <Link href="/forgot-password" className="mt-6 text-sm font-semibold text-primary">
            Choose a new password
          </Link>
        </div>
      </AuthShell>
    );
  }

  const row = params.t ? await findAuthToken(params.t, "not_me") : null;
  if (!row) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-pill bg-warning-soft text-warning-text"
          >
            <AlertCircle size={26} strokeWidth={1.75} />
          </span>
          <h1 className="mt-4 text-h3">This link is no longer valid</h1>
          <p className="mt-2 text-base text-text-muted">
            Links like this work once and expire after a day. You can still change your password from the log in
            page.
          </p>
          <Link href="/forgot-password" className="mt-6 text-sm font-semibold text-primary">
            Reset my password
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-pill bg-warning-soft text-warning-text"
        >
          <AlertCircle size={26} strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-h3">Secure your account</h1>
        <p className="mt-2 text-base text-text-muted">
          If you did not try to sign in, we can sign out every device and ask you to choose a new password.
        </p>
      </div>
      <NotMeForm token={String(params.t)} />
      <p className="mt-4 text-center text-sm text-text-muted">
        This was me.{" "}
        <Link href="/login" className="font-semibold text-primary">
          Go to log in
        </Link>
      </p>
    </AuthShell>
  );
}
