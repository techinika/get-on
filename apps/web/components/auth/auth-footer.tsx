import Link from "next/link";

export function AuthFooter({
  prompt,
  action,
  href,
}: {
  prompt: string;
  action: string;
  href: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-text-muted">
      {prompt}{" "}
      <Link href={href} className="font-semibold text-primary">
        {action}
      </Link>
    </p>
  );
}
