import type { AssetCarRig } from "@/lib/asset-car-rig";
import type { ShowroomCameraPreset } from "@/lib/showroom-camera";
import type { ShowroomLightingMode, ShowroomVenueMode } from "@/lib/showroom-scene-modes";
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
  /** True when the factory swatch is selected: leave the model's own paint alone. */
  bodyPaintFactory: boolean;
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
  venue?: ShowroomVenueMode;
  lighting?: ShowroomLightingMode;
  /** Respect prefers-reduced-motion: steadier lights, less idle shake. */
  reduceMotion?: boolean;
  onAssetRigCapabilities?: (capabilities: AssetRigCapabilities | null) => void;
  onAssetRigDebug?: (debug: AssetRigDebug | null) => void;
  /** Fired with the GLB url that actually loaded, including a later candidate. */
  onAssetModelResolved?: (url: string) => void;
  /** Fired only after every candidate GLB url has failed. */
  onAllAssetModelsFailed?: () => void;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  /**
   * When a flag is false, clicks and the hover cursor on that panel are ignored.
   * Omitted flags stay interactive.
   */
  bodyInteractions?: {
    leftDoor?: boolean;
    rightDoor?: boolean;
    trunk?: boolean;
  };
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
  /** Latest signed drive speed in m/s. Positive is showroom forward (−X). */
  driveSpeedRef?: RefObject<number>;
};

export const ENGINE_IGNITION_DURATION = 0.9;
export const HAZARD_MIN_EMISSIVE = { minActiveIntensity: 0 };
/** Brief hold so first-time loads still show the overlay; cache hits skip this. */
export const MIN_LOADING_OVERLAY_MS = 280;
export const CACHED_LOADING_OVERLAY_MS = 0;
