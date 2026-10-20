"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  helper,
  className,
  ...inputProps
}: InputProps & { helper?: string }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative w-full">
      <Input {...inputProps} type={visible ? "text" : "password"} className={cn("pr-14", className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center rounded-r-input text-text-muted transition-colors hover:text-text"
      >
        {visible ? (
          <EyeOff size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
        ) : (
          <Eye size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
        )}
      </button>
      {helper ? <p className="mt-1.5 text-sm text-text-muted">{helper}</p> : null}
    </div>
  );
}
