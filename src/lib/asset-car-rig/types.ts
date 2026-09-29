/** Public rig types and showroom light/paint constants. */
import * as THREE from "three";

export const ASSET_DOOR_MAX_OPEN_RADIANS = (70 * Math.PI) / 180;
export const ASSET_TRUNK_MAX_OPEN_RADIANS = (75 * Math.PI) / 180;

/** Upper bound for GLB headlamp emissive (toneMapped off on lens materials). */
export const SHOWROOM_HEADLAMP_INTENSITY = {
  on: 10,
  engineOn: 12,
  minEmissive: 16,
  emissiveScale: 3.4,
} as const;

/** Hazard blink — keep saturation; high HDR intensity reads white on screen. */
export const SHOWROOM_HAZARD_INTENSITY = {
  on: 5.5,
  withHeadlights: 2.2,
  /** Cap emissive so red stays red (not blown out to white). */
  tailMax: 6.2,
  tailMin: 2.8,
} as const;

export const SHOWROOM_TAIL_LAMP_COLOR = 0xc81e1e;

export type ShowroomSpinAxis = "x" | "y" | "z";

export type ShowroomMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial
  | THREE.MeshPhongMaterial
  | THREE.MeshLambertMaterial;

export type AssetRigDebugPart = {
  key:
    | "leftDoor"
    | "rightDoor"
    | "trunk"
    | "sunroof"
    | "headLights"
    | "tailLights"
    | "hazardLights"
    | "paint"
    | "frontWheels"
    | "rearWheels";
  label: string;
  interactive: boolean;
  count: number;
  items: string[];
};

export type AssetCarRig = {
  bounds: THREE.Box3;
  leftDoorPivot: THREE.Group | null;
  rightDoorPivot: THREE.Group | null;
  /**
   * Extra hinges driven by the same left/right toggles.
   * G900 opens the rear door on that side together with the front door.
   */
  companionDoorPivots: THREE.Group[];
  trunkPivot: THREE.Group | null;
  sunroofNodes: THREE.Object3D[];
  headLightMaterials: ShowroomMaterial[];
  /** World-space lamp centers for showroom spotlight placement. */
  headLightPositions: THREE.Vector3[];
  /** Body paint materials (profile-driven or auto-discovered). */
  paintMaterials: ShowroomMaterial[];
  tailLightMaterials: ShowroomMaterial[];
  hazardMaterials: ShowroomMaterial[];
  /**
   * Real GLB wheel nodes that spin in place about their own axle.
   * No helper/pivot nodes are added — each node carries `userData.showroomWheel`
   * spin metadata and is rotated via {@link applyWheelMotion}.
   */
  frontWheels: THREE.Object3D[];
  rearWheels: THREE.Object3D[];
  /** Effective rolling radius for wheel spin speed (meters, post-normalize). */
  wheelRollRadius: number;
  /** World-space center of the steering wheel rim, when the GLB has one. */
  steeringWheelCenter: THREE.Vector3 | null;
  /** Human-readable summary for UI / debugging. */
  capabilities: {
    leftDoor: boolean;
    rightDoor: boolean;
    trunk: boolean;
    sunroof: boolean;
    headLights: boolean;
    tailLights: boolean;
    wheels: boolean;
    /** True when corner rollers are procedural (body has no separable wheel meshes). */
    wheelsSynthetic: boolean;
  };
  debug: {
    profileId: string | null;
    parts: AssetRigDebugPart[];
  };
};

