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

  it("keeps focus in the confirm input when the parent re-renders with a new onClose", () => {
    function Harness({ onClose }: { onClose: () => void }) {
      const [value, setValue] = React.useState("");
      return (
        <Dialog open onClose={onClose} title="Delete website">
          <input
            aria-label="Type the website name to confirm"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Dialog>
      );
    }

    act(() => root.render(<Harness onClose={() => {}} />));
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    act(() => input?.focus());
    expect(document.activeElement).toBe(input);

    act(() => root.render(<Harness onClose={() => {}} />));
    expect(document.activeElement).toBe(input);
  });
});
