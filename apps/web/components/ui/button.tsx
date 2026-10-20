import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-input font-body font-semibold whitespace-nowrap transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:bg-primary-hover active:translate-y-px",
        secondary:
          "bg-surface text-text border-[1.5px] border-border-strong hover:bg-surface-muted",
        ghost: "bg-transparent text-text hover:bg-surface-muted",
        danger:
          "bg-danger text-white hover:bg-danger-hover active:translate-y-px",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** When set, swaps the leading icon for a spinner and sets aria-busy. */
    loading?: boolean;
    loadingLabel?: string;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingLabel, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 size={18} strokeWidth={1.75} className="shrink-0 animate-spin" aria-hidden />
        ) : null}
        {loading && loadingLabel ? loadingLabel : children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
