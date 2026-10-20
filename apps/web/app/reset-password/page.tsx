import { AuthMessage } from "@/components/auth-message";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-3xl">Set a new password</h1>
      <AuthMessage error={params.error} message={params.message} />
      <form action="/auth/reset-password" method="post" className="mt-4 space-y-4">
        <label className="block text-sm">
          New password
          <input type="password" name="password" minLength={8} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" required />
        </label>
        <button className="min-h-11 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-primary-foreground)]">
          Save password
        </button>
      </form>
    </main>
  );
}
