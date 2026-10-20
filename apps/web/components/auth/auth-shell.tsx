import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function AuthShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className="min-h-screen bg-bg px-4 pb-16">
      <div className="mt-8 flex justify-center">
        <Logo />
      </div>
      <section
        className={cn(
          "mx-auto mt-8 w-full max-w-[440px] rounded-dialog border border-border bg-surface p-6 shadow-card sm:mt-12 sm:p-8",
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
}
