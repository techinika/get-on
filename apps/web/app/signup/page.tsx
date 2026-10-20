import Link from "next/link";
import env from "@/lib/env";
import { AuthMessage } from "@/components/auth-message";

export const instant = false;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-3xl">Create your account</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
        Start free. No card needed.
      </p>
      <AuthMessage error={params.error} message={params.message} />
      <form action="/auth/sign-up" method="post" className="mt-4 space-y-4">
        <label className="block text-sm">
          Full name
          <input name="fullName" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <label className="block text-sm">
          Email
          <input type="email" name="email" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" name="password" minLength={8} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <button className="min-h-11 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-primary-foreground)]">
          Start free
        </button>
      </form>
      {env.enableGoogleAuth ? (
        <form action="/auth/google" method="post" className="mt-3">
          <button className="min-h-11 w-full rounded-xl border border-[var(--color-border)] px-4 py-2">
            Continue with Google
          </button>
        </form>
      ) : null}
      <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">
        Already have an account? <Link className="underline" href="/login">Log in</Link>
      </p>
    </main>
  );
}
