import { AuthMessage } from "@/components/auth-message";

export const instant = false;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-3xl">Reset your password</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">We will send you a reset link by email.</p>
      <AuthMessage error={params.error} message={params.message} />
      <form action="/auth/forgot-password" method="post" className="mt-4 space-y-4">
        <label className="block text-sm">
          Email
          <input type="email" name="email" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <button className="min-h-11 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-primary-foreground)]">
          Send reset link
        </button>
      </form>
    </main>
  );
}
