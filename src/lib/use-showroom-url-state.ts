"use client";

import { useEffect, useRef } from "react";

import { isCarCategoryKey, type CarCategoryKey } from "@/lib/car-categories";
import { isShowroomSceneMode, type ShowroomSceneMode } from "@/lib/showroom-scene-modes";
import { SHOWROOM_PAINT_OPTIONS } from "@/lib/showroom-paint-options";

export type ShowroomUrlState = {
  category?: CarCategoryKey;
  paintId?: string;
  cameraPreset?: string;
  sceneMode?: ShowroomSceneMode;
};

const VALID_CAMERA_PRESETS = new Set([
  "overview",
  "front",
  "side-left",
  "side-right",
  "rear",
  "cockpit",
]);

export function readShowroomUrlState(): ShowroomUrlState {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const category = params.get("model");
  const paintId = params.get("paint");
  const cameraPreset = params.get("camera");
  const sceneMode = params.get("mode");

  return {
    category: isCarCategoryKey(category) ? category : undefined,
    paintId:
      paintId && SHOWROOM_PAINT_OPTIONS.some((p) => p.id === paintId)
        ? paintId
        : undefined,
    cameraPreset: cameraPreset && VALID_CAMERA_PRESETS.has(cameraPreset) ? cameraPreset : undefined,
    sceneMode: isShowroomSceneMode(sceneMode) ? sceneMode : undefined,
  };
}

export function buildShowroomShareUrl(state: {
  category: CarCategoryKey;
  paintId: string;
  cameraPreset: string;
  sceneMode: ShowroomSceneMode;
}): string {
  const params = new URLSearchParams();
  params.set("model", state.category);
  params.set("paint", state.paintId);
  params.set("camera", state.cameraPreset);
  params.set("mode", state.sceneMode);

  if (typeof window === "undefined") {
    return `?${params.toString()}`;
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export async function copyShowroomShareUrl(state: {
  category: CarCategoryKey;
  paintId: string;
  cameraPreset: string;
  sceneMode: ShowroomSceneMode;
}): Promise<string> {
  const url = buildShowroomShareUrl(state);
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }

  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return url;
}

/**
 * Mirror the showroom configuration into the URL so a deep link reproduces it.
 * Uses `replaceState` so the user's history is not polluted while they explore.
 */
export function useShowroomUrlState(state: {
  category: CarCategoryKey;
  paintId: string;
  cameraPreset: string;
  sceneMode: ShowroomSceneMode;
}) {
  const lastSerialized = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("model", state.category);
    params.set("paint", state.paintId);
    params.set("camera", state.cameraPreset);
    params.set("mode", state.sceneMode);

    const next = params.toString();
    if (next === lastSerialized.current) {
      return;
    }
    lastSerialized.current = next;

    const nextUrl = `${window.location.pathname}?${next}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [state.category, state.paintId, state.cameraPreset, state.sceneMode]);
}
