import Link from "next/link";
import env from "@/lib/env";
import { AuthMessage } from "@/components/auth-message";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-3xl">Welcome back</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">Log in to manage your website.</p>
      <AuthMessage error={params.error} message={params.message} />
      <form action="/auth/login" method="post" className="mt-4 space-y-4">
        <label className="block text-sm">
          Email
          <input type="email" name="email" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" name="password" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <button className="min-h-11 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-primary-foreground)]">
          Log in
        </button>
      </form>
      {env.enableGoogleAuth ? (
        <form action="/auth/google" method="post" className="mt-3">
          <button className="min-h-11 w-full rounded-xl border border-[var(--color-border)] px-4 py-2">
            Continue with Google
          </button>
        </form>
      ) : null}
      <div className="mt-6 flex justify-between text-sm text-[var(--color-muted-foreground)]">
        <Link className="underline" href="/forgot-password">Forgot password?</Link>
        <Link className="underline" href="/signup">Create account</Link>
      </div>
    </main>
  );
}
