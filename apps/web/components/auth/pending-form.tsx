"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

const PendingContext = React.createContext(false);

/**
 * Native POST form (action points at a route handler) that tracks the pending
 * state of the first submit. The page navigates away, so pending never resets.
 */
export function PendingForm({ onSubmit, ...formProps }: React.FormHTMLAttributes<HTMLFormElement>) {
  const [pending, setPending] = React.useState(false);

  return (
    <PendingContext.Provider value={pending}>
      <form
        {...formProps}
        onSubmit={(event) => {
          onSubmit?.(event);
          if (!event.defaultPrevented) {
            setPending(true);
          }
        }}
      />
    </PendingContext.Provider>
  );
}

export function SubmitButton({ loading, loadingLabel, children, ...props }: ButtonProps) {
  const pending = React.useContext(PendingContext);

  return (
    <Button {...props} type="submit" loading={pending || loading} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}
