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

export function matchShowroomPreset(state: ShowroomPresetSnapshot): ShowroomPresetId | null {
  return PRESET_IDS.find((id) => presetEquals(state, SHOWROOM_PRESETS[id])) ?? null;
}

function presetEquals(left: ShowroomPresetSnapshot, right: ShowroomPresetSnapshot): boolean {
  return (
    left.leftDoorOpen === right.leftDoorOpen &&
    left.rightDoorOpen === right.rightDoorOpen &&
    left.trunkOpen === right.trunkOpen &&
    left.lightsOn === right.lightsOn &&
    left.engineOn === right.engineOn &&
    left.steeringAngle === right.steeringAngle &&
    left.hazardOn === right.hazardOn &&
    left.sunroofOpen === right.sunroofOpen &&
    left.speedKph === right.speedKph &&
    left.braking === right.braking &&
    left.cameraPreset === right.cameraPreset &&
    left.autoTour === right.autoTour
  );
}
