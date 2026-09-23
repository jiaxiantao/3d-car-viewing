import type { AssetCarRig } from "@/lib/asset-car-rig";
import type { ShowroomCameraPreset } from "@/lib/showroom-camera";
import type { ShowroomSceneMode } from "@/lib/showroom-scene-modes";
import type { RefObject } from "react";
import type * as THREE from "three";

export type OrbitControlsLike = {
  target: THREE.Vector3;
  update: () => void;
};

export type CarCameraPreset = ShowroomCameraPreset;

export type CarShowroomState = {
  leftDoorOpen: boolean;
  rightDoorOpen: boolean;
  trunkOpen: boolean;
  lightsOn: boolean;
  engineOn: boolean;
  seatDriverOffset: number;
  seatPassengerOffset: number;
  steeringAngle: number;
  hazardOn: boolean;
  sunroofOpen: boolean;
  bodyColor: string;
  bodyColorSecondary: string | null;
  speedKph: number;
  braking: boolean;
};

export type AssetRigCapabilities = AssetCarRig["capabilities"];
export type AssetRigDebug = AssetCarRig["debug"];

export type ShowroomSceneHandle = {
  captureScreenshot: () => Promise<Blob | null>;
  requestFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
};

export type AssetLoadState = "idle" | "loading" | "ready" | "error";

export type CarShowroomSceneProps = {
  state: CarShowroomState;
  cameraPreset: CarCameraPreset;
  autoTour: boolean;
  useAssetModel: boolean;
  modelUrl?: string;
  modelAlternateUrls?: string[];
  modelFallbackUrl?: string;
  sceneMode?: ShowroomSceneMode;
  /** Respect prefers-reduced-motion: steadier lights, less idle shake. */
  reduceMotion?: boolean;
  onAssetRigCapabilities?: (capabilities: AssetRigCapabilities | null) => void;
  onAssetRigDebug?: (debug: AssetRigDebug | null) => void;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  /** Imperative handle for screenshot / fullscreen actions. */
  controlHandleRef?: RefObject<ShowroomSceneHandle | null>;
};

export type CarModelProps = {
  state: CarShowroomState;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  overlayOnly?: boolean;
  reduceMotion?: boolean;
};

export const ENGINE_IGNITION_DURATION = 0.9;
export const HAZARD_MIN_EMISSIVE = { minActiveIntensity: 0 };
/** Keep overlay visible long enough to perceive when GLB is cached locally. */
export const MIN_LOADING_OVERLAY_MS = 480;
