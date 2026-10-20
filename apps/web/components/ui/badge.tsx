import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 font-body text-xs font-bold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-muted",
        draft: "bg-warning-soft text-warning-text",
        live: "bg-success-soft text-success-text",
        primary: "bg-primary-soft text-primary",
        accent: "bg-accent-soft text-accent-text",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Show a small status dot (used by the "live" variant). */
    dot?: boolean;
  };

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
