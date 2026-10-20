"use client";

import * as React from "react";

export type RadioOptionProps = {
  role: "radio";
  "aria-checked": boolean;
  tabIndex: number;
  ref: (node: HTMLElement | null) => void;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
};

/**
 * Roving-tabindex radio-group behaviour (spec §6, steps 2 and 4).
 * Left/Up and Right/Down move focus with wrap; Enter/Space selects.
 * `options` must be a stable array (module-level constant).
 */
export function useRadioGroup<T extends string>(
  options: readonly T[],
  selected: T | null,
  onSelect: (value: T) => void,
) {
  const nodes = React.useRef(new Map<T, HTMLElement>());
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [lastSelected, setLastSelected] = React.useState<T | null>(selected);

  if (selected !== lastSelected) {
    setLastSelected(selected);
    const index = selected ? options.indexOf(selected) : -1;
    if (index >= 0) setFocusIndex(index);
  }

  const focusAt = (index: number) => {
    const wrapped = (index + options.length) % options.length;
    setFocusIndex(wrapped);
    const value = options[wrapped];
    if (value !== undefined) nodes.current.get(value)?.focus();
  };

  const getOptionProps = (index: number): RadioOptionProps => {
    const value = options[index] as T;
    return {
      role: "radio",
      "aria-checked": selected === value,
      tabIndex: focusIndex === index ? 0 : -1,
      ref: (node) => {
        if (node) nodes.current.set(value, node);
        else nodes.current.delete(value);
      },
      onClick: () => {
        onSelect(value);
        setFocusIndex(index);
      },
      onKeyDown: (event) => {
        switch (event.key) {
          case "ArrowLeft":
          case "ArrowUp":
            event.preventDefault();
            focusAt(index - 1);
            break;
          case "ArrowRight":
          case "ArrowDown":
            event.preventDefault();
            focusAt(index + 1);
            break;
          case "Home":
            event.preventDefault();
            focusAt(0);
            break;
          case "End":
            event.preventDefault();
            focusAt(options.length - 1);
            break;
          case "Enter":
          case " ":
            event.preventDefault();
            onSelect(value);
            setFocusIndex(index);
            break;
          default:
            break;
        }
      },
    };
  };

  return { getOptionProps };
}
