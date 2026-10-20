export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-h1">{title}</h1>
      <p className="mt-2 text-base text-text-muted">{subtitle}</p>
    </header>
  );
}
