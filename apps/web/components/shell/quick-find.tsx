"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Globe, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickFindItem } from "@/lib/quick-find";

type Group = { label: string; items: QuickFindItem[] };

type QuickFindResponse = {
  websites: QuickFindItem[];
  pages: QuickFindItem[];
  project: QuickFindItem[];
  goTo: QuickFindItem[];
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function IconFor({ icon }: { icon: QuickFindItem["icon"] }) {
  if (icon === "page") {
    return <FileText size={18} strokeWidth={1.75} aria-hidden />;
  }
  if (icon === "website") {
    return <Globe size={18} strokeWidth={1.75} aria-hidden />;
  }
  return <Search size={18} strokeWidth={1.75} aria-hidden />;
}

export type QuickFindProps = {
  open: boolean;
  onClose: () => void;
  /** Current project id, used to include that project's pages. */
  projectId?: string;
  /** Element to return focus to when the dialog closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

/** Quick find dialog (spec §5.9): Ctrl/Cmd+K or "/" opens it. */
export function QuickFind({ open, onClose, projectId, returnFocusRef }: QuickFindProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [data, setData] = React.useState<QuickFindResponse>({
    websites: [],
    pages: [],
    project: [],
    goTo: [],
  });
  const [activeIndex, setActiveIndex] = React.useState(0);

  const groups: Group[] = React.useMemo(() => {
    const result: Group[] = [];
    if (data.websites.length > 0) result.push({ label: "Websites", items: data.websites });
    if (data.pages.length > 0) result.push({ label: "Pages", items: data.pages });
    if ((data.project ?? []).length > 0) result.push({ label: "This website", items: data.project ?? [] });
    if (data.goTo.length > 0) result.push({ label: "Go to", items: data.goTo });
    return result;
  }, [data]);

  const flatItems = React.useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(focus);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (projectId) params.set("projectId", projectId);
      fetch(`/api/quick-find?${params.toString()}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: QuickFindResponse | null) => {
          if (json) {
            setData(json);
            setActiveIndex(0);
          }
        })
        .catch(() => undefined);
    }, query ? 180 : 0);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [open, query, projectId]);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = (returnFocusRef?.current ??
      document.activeElement) as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (flatItems.length ? (index + 1) % flatItems.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          flatItems.length ? (index - 1 + flatItems.length) % flatItems.length : 0,
        );
        return;
      }
      if (event.key === "Enter") {
        const item = flatItems[activeIndex];
        if (item) {
          event.preventDefault();
          router.push(item.href);
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open, flatItems, activeIndex, onClose, router, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] min-[640px]:px-0">
      <div className="absolute inset-0 bg-scrim-strong" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-surface shadow-raised outline-none",
          "min-[640px]:w-[min(560px,100vw-32px)]",
          "min-[640px]:rounded-card",
          "max-[639px]:h-full max-[639px]:rounded-none",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 px-4">
          <Search size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search websites, pages and settings"
            aria-label="Search websites, pages and settings"
            className="h-full flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-muted"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          <kbd className="hidden shrink-0 rounded-[6px] bg-kbd-bg px-1.5 py-0.5 text-xs font-semibold text-text-muted min-[640px]:inline-block">
            esc
          </kbd>
        </div>

        <div className="max-h-[360px] flex-1 overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-[15px] text-text-muted">
              Nothing found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="px-3 py-2 text-label-caps">{group.label}</p>
                {group.items.map((item) => {
                  const index = flatItems.indexOf(item);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={`${group.label}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        router.push(item.href);
                        onClose();
                      }}
                      className={cn(
                        "flex h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left transition-colors",
                        active ? "bg-primary-soft" : "hover:bg-row-hover",
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted"
                      >
                        <IconFor icon={item.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-text">
                          {item.title}
                        </span>
                        {item.detail ? (
                          <span className="block truncate text-sm text-text-muted">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <ArrowRight
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                          className="shrink-0 text-primary"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden h-10 shrink-0 items-center border-t border-border px-4 text-xs text-text-muted min-[640px]:flex">
          Up and down to move, Enter to open, Esc to close
        </div>
      </div>
    </div>
  );
}
