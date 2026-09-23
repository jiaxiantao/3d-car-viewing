"use client";

import type { ThreeEvent } from "@react-three/fiber";

/** Track active hover count so rapid mount/unmount cycles don't leak `cursor: pointer`. */
let activeHoverCount = 0;

export function applyHoverCursor(delta: 1 | -1) {
  activeHoverCount = Math.max(0, activeHoverCount + delta);
  if (typeof document === "undefined") {
    return;
  }
  document.body.style.cursor = activeHoverCount > 0 ? "pointer" : "";
}

export function resetHoverCursor() {
  activeHoverCount = 0;
  if (typeof document !== "undefined") {
    document.body.style.cursor = "";
  }
}

export const interactivePointerHandlers = {
  onPointerOver: (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    applyHoverCursor(1);
  },
  onPointerOut: () => {
    applyHoverCursor(-1);
  },
};
