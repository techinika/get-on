import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { readPendingChallenge } from "@/lib/auth/pending";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter your sign-in code",
  robots: { index: false, follow: false },
};

export default async function LoginVerifyPage() {
  const pending = await readPendingChallenge("login");
  if (!pending) redirect("/login");

  return (
    <AuthShell>
      <CodeStep
        title="Enter your sign-in code"
        description="We sent a 6-digit code to {email}. It expires in 10 minutes."
        maskedEmail={pending.maskedEmail}
        verifyUrl="/api/auth/otp/verify"
        next={pending.next}
        helpText={
          <details className="rounded-xl border border-border bg-surface-muted p-4">
            <summary className="cursor-pointer text-sm font-semibold text-text">Having trouble?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
              <li>Check your spam or junk folder.</li>
              <li>Wait a minute, then send a new code.</li>
              <li>Make sure you are using the newest code.</li>
            </ol>
            <p className="mt-2 text-sm text-text-muted">
              We cannot skip this step for you. It keeps your websites safe even if someone learns your password.
            </p>
          </details>
        }
        footer={
          <div className="space-y-2">
            <p>
              <Link href="/login" className="font-semibold text-primary underline">
                Use a different account
              </Link>
            </p>
            <p className="text-[13px]">
              This was not you?{" "}
              <Link href="/forgot-password" className="font-semibold text-primary underline">
                Change your password
              </Link>
            </p>
          </div>
        }
      />
    </AuthShell>
  );
}
