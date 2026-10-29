export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-text">Check your email</h1>
        <p className="mt-2 text-sm text-text-muted">
          We sent a 6-digit code to your email. Enter it here to verify your account.
        </p>
        <form className="mt-6 flex flex-col gap-4" method="post" action="/api/auth/verify-email">
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            aria-label="Verification code"
            className="h-12 rounded-xl border border-border-strong px-4 text-center text-2xl tracking-widest"
            required
          />
          <button
            type="submit"
            className="h-12 rounded-xl bg-primary text-white font-semibold"
          >
            Verify
          </button>
        </form>
      </section>
    </main>
  );
}
