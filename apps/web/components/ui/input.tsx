import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  /** Height/typography preset for the wizard business-name field. */
  inputSize?: "md" | "lg";
  /** Read-only suffix rendered inside the right edge (e.g. ".get-on.tech"). */
  suffix?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, inputSize = "md", suffix, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="relative w-full">
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "w-full rounded-input border-[1.5px] bg-surface text-text font-body transition-colors duration-150",
            "placeholder:text-text-muted",
            inputSize === "md" ? "h-12 px-3.5" : "h-14 px-3.5 text-lg",
            error ? "border-danger" : "border-border-strong focus:border-primary",
            suffix && "pr-32",
            className,
          )}
          {...props}
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center rounded-r-input border-[1.5px] border-l-0 border-border-strong bg-surface-muted px-3 text-base text-text-muted"
          >
            {suffix}
          </span>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-text">
            <AlertCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="relative w-full">
        <textarea
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "min-h-[140px] w-full rounded-input border-[1.5px] bg-surface px-3.5 py-3 font-body text-base text-text transition-colors duration-150",
            error ? "border-danger" : "border-border-strong focus:border-primary",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-text">
            <AlertCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export function Label({
  children,
  optional,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  optional?: boolean;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-semibold text-text", className)}>
      {children}
      {optional ? <span className="font-normal text-text-muted"> (optional)</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-text">
      <AlertCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

export { Input, Textarea };
