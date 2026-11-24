"use client";

import * as React from "react";
import { AssistantMessage } from "@/components/agent/assistant-message";
import { cn } from "@/lib/utils";

export type VirtualChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  credits?: number;
  createdAt?: string;
};

const DEFAULT_VIEWPORT_HEIGHT = 600;
const DEFAULT_CONTAINER_WIDTH = 360;
const DEFAULT_OVERSCAN = 6;
const MIN_ROW_HEIGHT = 56;
const ROW_GAP_PX = 12;

export function estimateMessageHeight(
  message: Pick<VirtualChatMessage, "content" | "credits">,
  containerWidth = DEFAULT_CONTAINER_WIDTH,
): number {
  const usableWidth = Math.max(180, containerWidth * 0.88 - 28);
  const charsPerLine = Math.max(16, Math.floor(usableWidth / 7.8));
  const text = message.content;

  let lines = 1;
  let col = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      lines += 1;
      col = 0;
    } else {
      col += 1;
      if (col >= charsPerLine) {
        lines += 1;
        col = 0;
      }
    }
  }

  const creditsHeight = (message.credits ?? 0) > 0 ? 20 : 0;
  return Math.max(MIN_ROW_HEIGHT, 24 + lines * 24 + creditsHeight + ROW_GAP_PX);
}

export function computeMessageLayout(
  messages: ReadonlyArray<Pick<VirtualChatMessage, "id" | "content" | "credits">>,
  measuredHeights: ReadonlyMap<string, number>,
  containerWidth = DEFAULT_CONTAINER_WIDTH,
): { offsets: number[]; sizes: number[]; totalHeight: number } {
  const count = messages.length;
  const offsets = new Array<number>(count);
  const sizes = new Array<number>(count);
  let y = 0;

  for (let i = 0; i < count; i += 1) {
    const message = messages[i]!;
    const size = measuredHeights.get(message.id) ?? estimateMessageHeight(message, containerWidth);
    offsets[i] = y;
    sizes[i] = size;
    y += size;
  }

  return { offsets, sizes, totalHeight: y };
}

export function findVisibleMessageRange(
  offsets: ReadonlyArray<number>,
  sizes: ReadonlyArray<number>,
  scrollTop: number,
  viewportHeight: number,
  overscan = DEFAULT_OVERSCAN,
): { startIndex: number; endIndex: number } {
  const count = offsets.length;
  if (count === 0) {
    return { startIndex: 0, endIndex: -1 };
  }

  const top = Math.max(0, scrollTop);
  const bottom = top + Math.max(1, viewportHeight);

  // Binary search for the first row whose bottom edge exceeds `top`.
  let lo = 0;
  let hi = count - 1;
  let firstVisible = count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid]! + sizes[mid]! > top) {
      firstVisible = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Binary search for the last row whose top edge is above `bottom`.
  lo = firstVisible;
  hi = count - 1;
  let lastVisible = firstVisible;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid]! < bottom) {
      lastVisible = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    startIndex: Math.max(0, firstVisible - overscan),
    endIndex: Math.min(count - 1, lastVisible + overscan),
  };
}

const ChatMessageItem = React.memo(function ChatMessageItem({
  message,
}: {
  message: VirtualChatMessage;
}) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-[14px] px-3.5 py-2.5",
        message.role === "user"
          ? "self-end bg-primary text-on-primary"
          : "self-start bg-surface-muted text-text",
      )}
    >
      {message.role === "assistant" ? (
        <AssistantMessage text={message.content} />
      ) : (
        <p className="whitespace-pre-wrap break-words text-[15px]">{message.content}</p>
      )}
      {message.role === "assistant" && (message.credits ?? 0) > 0 ? (
        <p className="mt-1 text-xs opacity-70">
          {message.credits} credit{message.credits === 1 ? "" : "s"} used
        </p>
      ) : null}
    </div>
  );
});

type VirtualizedMessageListProps = {
  messages: VirtualChatMessage[];
  stickTrigger: string;
  emptyState: React.ReactNode;
  loadingState: React.ReactNode;
  loading: boolean;
  hasTrailingContent: boolean;
  footer?: React.ReactNode;
  error?: React.ReactNode;
};

export function VirtualizedMessageList({
  messages,
  stickTrigger,
  emptyState,
  loadingState,
  loading,
  hasTrailingContent,
  footer,
  error,
}: VirtualizedMessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowNodesRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const rowObserverRef = React.useRef<ResizeObserver | null>(null);
  const stickToBottomRef = React.useRef(true);
  const scrollRafRef = React.useRef<number | null>(null);
  const measureRafRef = React.useRef<number | null>(null);
  const pendingHeightsRef = React.useRef<Map<string, number>>(new Map());
  const lastWidthRef = React.useRef(DEFAULT_CONTAINER_WIDTH);

  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewport, setViewport] = React.useState({
    width: DEFAULT_CONTAINER_WIDTH,
    height: 0,
  });
  const [measuredHeights, setMeasuredHeights] = React.useState<Map<string, number>>(
    () => new Map(),
  );

  const layout = React.useMemo(
    () => computeMessageLayout(messages, measuredHeights, viewport.width),
    [messages, measuredHeights, viewport.width],
  );

  const layoutRef = React.useRef(layout);
  const messagesRef = React.useRef(messages);
  const measuredHeightsRef = React.useRef(measuredHeights);

  React.useEffect(() => {
    layoutRef.current = layout;
    messagesRef.current = messages;
    measuredHeightsRef.current = measuredHeights;
  }, [layout, messages, measuredHeights]);

  // Cleanup animation frames on unmount.
  React.useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
      if (measureRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(measureRafRef.current);
      }
      rowObserverRef.current?.disconnect();
    };
  }, []);

  // Observe viewport dimensions.
  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const updateViewport = () => {
      const nextWidth = Math.max(180, node.clientWidth - 32);
      const nextHeight = node.clientHeight;
      if (Math.abs(nextWidth - lastWidthRef.current) > 4) {
        lastWidthRef.current = nextWidth;
        pendingHeightsRef.current.clear();
        setMeasuredHeights(new Map());
      }
      setViewport((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    };

    const initRaf =
      typeof window !== "undefined" ? window.requestAnimationFrame(updateViewport) : null;
    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (initRaf !== null && typeof window !== "undefined") {
          window.cancelAnimationFrame(initRaf);
        }
      };
    }
    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);
    return () => {
      if (initRaf !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(initRaf);
      }
      observer.disconnect();
    };
  }, []);

  // Single shared ResizeObserver for dynamic-height virtualized message rows.
  React.useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      let changed = false;
      let scrollDelta = 0;
      const scroller = scrollRef.current;
      const currentScrollTop = scroller ? scroller.scrollTop : 0;
      const currentMessages = messagesRef.current;
      const currentOffsets = layoutRef.current.offsets;
      const knownHeights = measuredHeightsRef.current;

      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.virtualId;
        if (!id) continue;

        const measured =
          entry.borderBoxSize?.[0]?.blockSize ??
          (el.offsetHeight > 0 ? el.offsetHeight : entry.contentRect.height);
        if (measured <= 0) continue;

        const prev = pendingHeightsRef.current.get(id) ?? knownHeights.get(id);
        const indexAttr = el.dataset.index;
        const idx = indexAttr !== undefined ? Number(indexAttr) : -1;
        const fallbackEstimate =
          idx >= 0 && currentMessages[idx]
            ? estimateMessageHeight(currentMessages[idx]!, lastWidthRef.current)
            : measured;
        const previousSize = prev ?? fallbackEstimate;

        if (Math.abs(measured - previousSize) > 0.5) {
          pendingHeightsRef.current.set(id, measured);
          changed = true;

          // Keep scroll position anchored when scrolled above newly measured rows.
          if (
            !stickToBottomRef.current &&
            idx >= 0 &&
            idx < currentOffsets.length &&
            currentOffsets[idx]! < currentScrollTop
          ) {
            scrollDelta += measured - previousSize;
          }
        }
      }

      if (changed) {
        if (scroller && scrollDelta !== 0) {
          scroller.scrollTop += scrollDelta;
          setScrollTop(scroller.scrollTop);
        }
        if (measureRafRef.current === null && typeof window !== "undefined") {
          measureRafRef.current = window.requestAnimationFrame(() => {
            measureRafRef.current = null;
            const pending = pendingHeightsRef.current;
            if (pending.size === 0) return;
            const updates = new Map(pending);
            pending.clear();
            setMeasuredHeights((prevMap) => {
              const nextMap = new Map(prevMap);
              for (const [id, height] of updates) {
                nextMap.set(id, height);
              }
              return nextMap;
            });
          });
        }
      }
    });

    rowObserverRef.current = observer;
    for (const node of rowNodesRef.current.values()) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      rowObserverRef.current = null;
    };
  }, []);

  const registerRow = React.useCallback((id: string, node: HTMLElement | null) => {
    const prev = rowNodesRef.current.get(id);
    if (prev && prev !== node) {
      rowObserverRef.current?.unobserve(prev);
      rowNodesRef.current.delete(id);
    }
    if (node) {
      rowNodesRef.current.set(id, node);
      rowObserverRef.current?.observe(node);
    }
  }, []);

  const handleScroll = React.useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
    stickToBottomRef.current = distanceFromBottom <= 48;
    setScrollTop(node.scrollTop);
  }, []);

  // Snap to bottom when sticky (on initial load, new messages, or streaming tokens).
  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottomRef.current || typeof window === "undefined") return;
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const current = scrollRef.current;
      if (!current || !stickToBottomRef.current) return;
      const target = Math.max(0, current.scrollHeight - current.clientHeight);
      if (Math.abs(current.scrollTop - target) > 1) {
        current.scrollTop = target;
        setScrollTop(current.scrollTop);
      }
    });
  }, [messages.length, layout.totalHeight, stickTrigger, loading]);

  const effectiveViewportHeight = viewport.height > 0 ? viewport.height : DEFAULT_VIEWPORT_HEIGHT;
  const effectiveScrollTop =
    viewport.height > 0
      ? scrollTop
      : Math.max(0, layout.totalHeight - effectiveViewportHeight);

  const range = React.useMemo(
    () =>
      findVisibleMessageRange(
        layout.offsets,
        layout.sizes,
        effectiveScrollTop,
        effectiveViewportHeight,
        DEFAULT_OVERSCAN,
      ),
    [layout.offsets, layout.sizes, effectiveScrollTop, effectiveViewportHeight],
  );

  const renderedRows: React.ReactNode[] = [];
  for (let i = range.startIndex; i <= range.endIndex; i += 1) {
    const message = messages[i];
    if (!message) continue;
    const top = layout.offsets[i] ?? 0;
    renderedRows.push(
      <div
        key={message.id}
        ref={(node) => registerRow(message.id, node)}
        data-virtual-id={message.id}
        data-index={i}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${top}px)`,
        }}
        className="flex flex-col pb-3"
      >
        <ChatMessageItem message={message} />
      </div>,
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4">
      {loading ? (
        loadingState
      ) : messages.length === 0 && !hasTrailingContent ? (
        emptyState
      ) : (
        <div className="flex flex-col">
          {messages.length > 0 ? (
            <div
              className="relative w-full"
              style={{ height: `${layout.totalHeight}px` }}
              data-virtual-list-canvas
            >
              {renderedRows}
            </div>
          ) : null}
          {footer ? <div className="flex flex-col gap-3">{footer}</div> : null}
        </div>
      )}
      {error}
    </div>
  );
}
