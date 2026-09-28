import type { CarCameraPreset } from "@/components/showroom/types";

export type ShowroomPresetId = "welcome" | "drive";

export type ShowroomPresetSnapshot = {
  leftDoorOpen: boolean;
  rightDoorOpen: boolean;
  trunkOpen: boolean;
  lightsOn: boolean;
  engineOn: boolean;
  steeringAngle: number;
  hazardOn: boolean;
  sunroofOpen: boolean;
  speedKph: number;
  braking: boolean;
  cameraPreset: CarCameraPreset;
  autoTour: boolean;
};

export const SHOWROOM_PRESETS: Record<ShowroomPresetId, ShowroomPresetSnapshot> = {
  welcome: {
    leftDoorOpen: true,
    rightDoorOpen: true,
    trunkOpen: false,
    lightsOn: true,
    engineOn: false,
    steeringAngle: 0,
    hazardOn: true,
    sunroofOpen: false,
    speedKph: 0,
    braking: false,
    cameraPreset: "overview",
    autoTour: false,
  },
  drive: {
    leftDoorOpen: false,
    rightDoorOpen: false,
    trunkOpen: false,
    lightsOn: true,
    engineOn: true,
    steeringAngle: -16,
    hazardOn: false,
    sunroofOpen: false,
    speedKph: 45,
    braking: false,
    cameraPreset: "overview",
    autoTour: false,
  },
};

const PRESET_IDS: ShowroomPresetId[] = ["welcome", "drive"];

/** Body fields a model may ignore when matching the highlighted preset. */
export type ShowroomPresetBodyKey = "leftDoorOpen" | "rightDoorOpen" | "trunkOpen" | "sunroofOpen";

export function matchShowroomPreset(
  state: ShowroomPresetSnapshot,
  ignore: readonly ShowroomPresetBodyKey[] = [],
): ShowroomPresetId | null {
  return PRESET_IDS.find((id) => presetEquals(state, SHOWROOM_PRESETS[id], ignore)) ?? null;
}

function presetEquals(
  left: ShowroomPresetSnapshot,
  right: ShowroomPresetSnapshot,
  ignore: readonly ShowroomPresetBodyKey[] = [],
): boolean {
  const same = (key: keyof ShowroomPresetSnapshot) =>
    (ignore as readonly string[]).includes(key) || left[key] === right[key];
  return (
    same("leftDoorOpen") &&
    same("rightDoorOpen") &&
    same("trunkOpen") &&
    same("lightsOn") &&
    same("engineOn") &&
    same("steeringAngle") &&
    same("hazardOn") &&
    same("sunroofOpen") &&
    same("speedKph") &&
    same("braking") &&
    same("cameraPreset") &&
    same("autoTour")
  );
}
