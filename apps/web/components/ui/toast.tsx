"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "success" | "error" | "info";

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

const toneBar: Record<ToastTone, string> = {
  neutral: "bg-border-strong",
  success: "bg-success",
  error: "bg-danger",
  info: "bg-info-text",
};

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "neutral") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "animate-toast-in pointer-events-auto flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-[14px] bg-surface p-3.5 shadow-raised",
            )}
          >
            <span aria-hidden className={cn("h-full w-1 self-stretch rounded", toneBar[t.tone])} />
            <p className="text-base text-text">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="ml-auto -mr-1 h-8 w-8 shrink-0 rounded-md text-text-muted hover:bg-surface-muted"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
