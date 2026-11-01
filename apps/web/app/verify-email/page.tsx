import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { readPendingSignup } from "@/lib/auth/pending";

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
      <CodeStep
        title="Check your email"
        description="We sent a 6-digit code to {email}. It expires after a short time."
        maskedEmail={pending.maskedEmail}
        verifyUrl="/api/auth/verify-email"
        resendUrl="/api/auth/signup/resend"
        next={pending.next}
        helpText={
          <details className="rounded-xl border border-border bg-surface-muted p-4">
            <summary className="cursor-pointer text-sm font-semibold text-text">I did not get the email</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
              <li>Check your spam or junk folder.</li>
              <li>Check the address is spelled right.</li>
              <li>Wait a minute, then send a new code.</li>
            </ol>
            <p className="mt-2 text-sm text-text-muted">
              Still stuck? Write to{" "}
              <a href="mailto:team@get-on.tech" className="font-semibold text-primary underline">
                team@get-on.tech
              </a>
              .
            </p>
          </details>
        }
        footer={
          <p>
            Wrong email?{" "}
            <Link href="/signup" className="font-semibold text-primary underline">
              Start again
            </Link>
          </p>
        }
      />
    </AuthShell>
  );
}
