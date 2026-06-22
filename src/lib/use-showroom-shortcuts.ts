"use client";

import { useEffect } from "react";

type ShowroomShortcutHandlers = {
  onCameraOverview?: () => void;
  onCameraFront?: () => void;
  onCameraSideLeft?: () => void;
  onCameraSideRight?: () => void;
  onCameraRear?: () => void;
  onCameraCockpit?: () => void;
  onToggleAutoTour?: () => void;
  onToggleEngine?: () => void;
  onToggleLights?: () => void;
  onToggleHazard?: () => void;
  onToggleLeftDoor?: () => void;
  onToggleRightDoor?: () => void;
  onToggleTrunk?: () => void;
  onCaptureScreenshot?: () => void;
  onToggleFullscreen?: () => void;
  onCopyShareLink?: () => void;
};

function isTextEntryActive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Lightweight keyboard shortcut layer for the showroom. Skips when modifiers
 * (Cmd / Ctrl) are pressed or while the user is typing in form controls.
 */
export function useShowroomShortcuts(handlers: ShowroomShortcutHandlers) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handle = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isTextEntryActive(event.target)) {
        return;
      }

      switch (event.key) {
        case "1":
          handlers.onCameraOverview?.();
          break;
        case "2":
          handlers.onCameraFront?.();
          break;
        case "3":
          handlers.onCameraSideLeft?.();
          break;
        case "4":
          handlers.onCameraSideRight?.();
          break;
        case "5":
          handlers.onCameraRear?.();
          break;
        case "6":
          handlers.onCameraCockpit?.();
          break;
        case "t":
        case "T":
          handlers.onToggleAutoTour?.();
          break;
        case "e":
        case "E":
          handlers.onToggleEngine?.();
          break;
        case "l":
        case "L":
          handlers.onToggleLights?.();
          break;
        case "h":
        case "H":
          handlers.onToggleHazard?.();
          break;
        case "d":
        case "D":
          handlers.onToggleLeftDoor?.();
          break;
        case "a":
        case "A":
          handlers.onToggleRightDoor?.();
          break;
        case "b":
        case "B":
          handlers.onToggleTrunk?.();
          break;
        case "s":
        case "S":
          handlers.onCaptureScreenshot?.();
          break;
        case "f":
        case "F":
          handlers.onToggleFullscreen?.();
          break;
        case "c":
        case "C":
          handlers.onCopyShareLink?.();
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handlers]);
}
