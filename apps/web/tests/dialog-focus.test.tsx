import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dialog } from "@/components/ui/dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Dialog focus stability", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps focus in the confirm input while typing and re-rendering", () => {
    let setValue: ((value: string) => void) | null = null;

    function Harness({
      onClose,
      dismissible,
    }: {
      onClose: () => void;
      dismissible: boolean;
    }) {
      const [value, update] = React.useState("");
      setValue = update;
      return (
        <Dialog
          open
          onClose={onClose}
          title="Delete website"
          dismissible={dismissible}
        >
          <input
            aria-label="Type the website name to confirm"
            value={value}
            onChange={(event) => update(event.target.value)}
          />
        </Dialog>
      );
    }

    act(() => root.render(<Harness onClose={() => {}} dismissible />));
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    act(() => input?.focus());
    expect(document.activeElement).toBe(input);

    act(() => setValue?.("R"));
    expect(document.activeElement).toBe(input);

    act(() =>
      root.render(<Harness onClose={() => {}} dismissible={false} />),
    );
    expect(document.activeElement).toBe(input);

    act(() => root.render(<Harness onClose={() => {}} dismissible />));
    expect(document.activeElement).toBe(input);
  });

  it("does not refocus or restore focus when the focus ref identity changes", () => {
    let setValue: ((value: string) => void) | null = null;

    function Harness({ passRef }: { passRef: boolean }) {
      const [value, update] = React.useState("");
      setValue = update;
      const firstRef = React.useRef<HTMLInputElement>(null);
      const secondRef = React.useRef<HTMLInputElement>(null);
      return (
        <Dialog
          open
          onClose={() => {}}
          title="Delete website"
          initialFocusRef={passRef ? firstRef : secondRef}
        >
          <input
            ref={firstRef}
            aria-label="Confirm"
            value={value}
            onChange={(event) => update(event.target.value)}
          />
        </Dialog>
      );
    }

    act(() => root.render(<Harness passRef />));
    const input = container.querySelector("input");
    act(() => input?.focus());
    act(() => setValue?.("R"));
    act(() => root.render(<Harness passRef={false} />));
    expect(document.activeElement).toBe(input);
  });

  it("focuses the requested field when the dialog opens", () => {
    function Harness() {
      const inputRef = React.useRef<HTMLInputElement>(null);
      return (
        <Dialog
          open
          onClose={() => {}}
          title="Delete website"
          initialFocusRef={inputRef}
        >
          <input ref={inputRef} aria-label="Confirm" />
        </Dialog>
      );
    }

    act(() => root.render(<Harness />));
    const input = container.querySelector("input");
    expect(document.activeElement).toBe(input);
  });
});
