import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The GET-ON wordmark. Every letter is drawn with square geometry so the name
 * itself is the logo. It uses `currentColor`, so it works on light and dark
 * backgrounds without a separate asset.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 80"
      role="img"
      aria-label="GET-ON"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-auto", className)}
    >
      <g>
        {/* G */}
        <rect x="0" y="8" width="50" height="13" />
        <rect x="0" y="8" width="13" height="64" />
        <rect x="0" y="59" width="50" height="13" />
        <rect x="37" y="46" width="13" height="26" />
        <rect x="24" y="33" width="26" height="13" />
        {/* E */}
        <rect x="60" y="8" width="13" height="64" />
        <rect x="60" y="8" width="44" height="13" />
        <rect x="60" y="30" width="32" height="13" />
        <rect x="60" y="59" width="44" height="13" />
        {/* T */}
        <rect x="114" y="8" width="48" height="13" />
        <rect x="131" y="8" width="14" height="64" />
        {/* hyphen */}
        <path d="M174 30 L198 30 L192 45 L168 45 Z" />
        {/* O */}
        <rect x="206" y="8" width="52" height="13" />
        <rect x="206" y="59" width="52" height="13" />
        <rect x="206" y="8" width="13" height="64" />
        <rect x="245" y="8" width="13" height="64" />
        {/* N */}
        <rect x="268" y="8" width="13" height="64" />
        <rect x="307" y="8" width="13" height="64" />
        <path d="M281 8 L294 8 L320 72 L307 72 Z" />
      </g>
    </svg>
  );
}

/** Logo wordmark, links to `/`. */
export function Logo({
  className,
  href = "/",
  wordmarkClassName,
}: {
  className?: string;
  href?: string;
  wordmarkClassName?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="GET-ON home"
      className={cn("inline-flex items-center text-text", className)}
    >
      <Wordmark className={wordmarkClassName} />
    </Link>
  );
}

/** Logo with a white wordmark for the dark footer. */
export function LogoInverse({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="GET-ON home"
      className={cn("inline-flex items-center text-white", className)}
    >
      <Wordmark />
    </Link>
  );
}
