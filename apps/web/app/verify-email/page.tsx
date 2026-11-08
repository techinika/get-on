import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { readPendingSignup } from "@/lib/auth/pending";
import { ResendSignupEmail } from "./resend-signup-email";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const pending = await readPendingSignup();
  if (!pending) redirect("/signup");

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
          We sent a confirmation link to {pending.maskedEmail}. Open it to confirm
          your email, then come back and log in.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          After you log in, you will set up your authenticator app.
        </p>

        <ResendSignupEmail />

        <Link href="/login" className="text-sm font-semibold text-primary">
          Back to log in
        </Link>
      </div>

      <details className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text">
          I did not get the email
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
          <li>Check your spam or junk folder.</li>
          <li>Check the address is spelled right.</li>
          <li>Wait a minute, then send the email again.</li>
        </ol>
        <p className="mt-2 text-sm text-text-muted">
          Still stuck? Write to{" "}
          <a href="mailto:team@get-on.tech" className="font-semibold text-primary underline">
            team@get-on.tech
          </a>
          .
        </p>
      </details>

      <p className="mt-4 text-center text-sm text-text-muted">
        Wrong email?{" "}
        <Link href="/signup" className="font-semibold text-primary underline">
          Start again
        </Link>
      </p>
    </AuthShell>
  );
}
