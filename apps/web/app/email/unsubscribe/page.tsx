import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, MailX } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { isUnsubscribeToken } from "@/lib/email/unsubscribe";
import { unsubscribeFromMarketing } from "./actions";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Message({
  icon,
  title,
  children,
}: {
  icon: "done" | "invalid";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = icon === "done" ? MailCheck : MailX;
  return (
    <div className="flex flex-col items-center text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-pill bg-primary-soft text-primary"
      >
        <Icon size={26} strokeWidth={1.75} />
      </span>
      <h1 className="mt-4 text-h3">{title}</h1>
      <div className="mt-2 text-base text-text-muted">{children}</div>
    </div>
  );
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const { token, done, error } = await searchParams;

  if (done) {
    return (
      <AuthShell>
        <Message icon="done" title="Marketing email is off">
          <p>You will still get receipts, security notices and other messages about your account.</p>
        </Message>
        <p className="mt-6 text-center text-sm text-text-muted">
          Changed your mind? Turn marketing email back on in{" "}
          <Link href="/dashboard/account" className="font-semibold text-primary underline">
            Account settings
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  if (error || !isUnsubscribeToken(token)) {
    return (
      <AuthShell>
        <Message icon="invalid" title="This link is not valid">
          <p>
            It may have expired, or the address may already be off our list. Open the latest email
            and use its link again.
          </p>
        </Message>
        <p className="mt-6 text-center text-sm text-text-muted">
          Still stuck? Email{" "}
          <a href="mailto:team@get-on.tech" className="font-semibold text-primary underline">
            team@get-on.tech
          </a>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-pill bg-primary-soft text-primary"
        >
          <MailX size={26} strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-h3">Turn off marketing email?</h1>
        <p className="mt-2 text-base text-text-muted">
          You will stop getting product news, tips and offers. Receipts, security notices and other
          messages about your account will still arrive.
        </p>
      </div>
      <form action={unsubscribeFromMarketing} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="primary" size="md" className="w-full">
          Turn off marketing email
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-muted">
        You can turn it back on at any time in Account settings.
      </p>
    </AuthShell>
  );
}
