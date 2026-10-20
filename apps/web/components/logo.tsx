import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-primary",
        className,
      )}
    >
      <ArrowUpRight size={18} strokeWidth={1.75} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading text-[22px] font-bold leading-none", className)}>
      Get-On
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
      className={cn("inline-flex items-center gap-2", className)}
    >
      <LogoMark />
      <Wordmark className={wordmarkClassName} />
    </Link>
  );
}

/** Logo with white wordmark for the dark footer. */
export function LogoInverse({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Get-On home" className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <Wordmark className="text-[#FFFFFF]" />
    </Link>
  );
}
