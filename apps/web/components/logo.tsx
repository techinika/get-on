import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={32}
      height={32}
      aria-hidden
      className={cn("h-8 w-8 shrink-0 rounded-[10px]", className)}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading text-[22px] font-bold leading-none tracking-tight", className)}>
      GETON
    </span>
  );
}

/** Logo mark + wordmark, links to `/`. */
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
      aria-label="Get-On home"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark />
      <Wordmark className={wordmarkClassName} />
    </Link>
  );
}

/** Logo with white wordmark for the dark footer. */
export function LogoInverse({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Get-On home" className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <Wordmark className="text-white" />
    </Link>
  );
}
