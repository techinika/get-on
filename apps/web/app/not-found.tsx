import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft">
        <SearchX size={56} strokeWidth={1.75} aria-hidden className="text-accent-text" />
      </span>
      <h1 className="text-h1 mt-6">We could not find that page</h1>
      <p className="mt-2 max-w-[420px] text-base text-text-muted">
        The page may have been moved or deleted. Your websites are still safe.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-6")}>
        Back to my websites
      </Link>
    </main>
  );
}
