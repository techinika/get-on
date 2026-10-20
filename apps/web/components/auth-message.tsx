export function AuthMessage({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) {
    return null;
  }

  return (
    <p
      className={`rounded-xl p-3 text-sm ${
        error
          ? "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      }`}
      role={error ? "alert" : "status"}
    >
      {error ?? message}
    </p>
  );
}
