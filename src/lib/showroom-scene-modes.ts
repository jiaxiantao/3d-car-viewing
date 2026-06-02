/**
 * Showroom scene presets — cycle between studio (current default), bright daylight,
 * and a moody night look. Lighting / floor / fog values are consumed by
 * `CarShowroomScene` and `ShowroomReflectiveFloor` to keep the look consistent.
 */

export type ShowroomSceneMode = "studio" | "day" | "night";

export type ShowroomSceneModeConfig = {
  label: string;
  description: string;
  background: string;
  themeColor: string;
  floorColor: string;
  floorRoughness: number;
  floorMetalness: number;
  environmentIntensity: { base: number; headlightsOn: number };
  ambient: { base: number; headlightsOn: number };
  directional: { base: number; headlightsOn: number };
  directionalColor: string;
  hemisphere: { intensity: number; sky: string; ground: string };
  fillPoint: number;
  rimDirectional: number;
  headlightSpot: number;
  fog?: { color: string; near: number; far: number };
};

const STUDIO: ShowroomSceneModeConfig = {
  label: "影棚",
  description: "经典暗调展厅，强调金属漆面与车灯辉光",
  background: "#070d18",
  themeColor: "#0c1120",
  floorColor: "#3d4f63",
  floorRoughness: 0.82,
  floorMetalness: 0.22,
  environmentIntensity: { base: 0.72, headlightsOn: 0.88 },
  ambient: { base: 0.58, headlightsOn: 0.52 },
  directional: { base: 1.35, headlightsOn: 1.12 },
  directionalColor: "#ffffff",
  hemisphere: { intensity: 0.3, sky: "#cbd5e1", ground: "#1e293b" },
  fillPoint: 0.32,
  rimDirectional: 0.28,
  headlightSpot: 34,
};

const DAY: ShowroomSceneModeConfig = {
  label: "白天",
  description: "柔和天光下的真实色彩，适合查看车漆细节",
  background: "#dbe7f5",
  themeColor: "#cfddee",
  floorColor: "#7a8a9c",
  floorRoughness: 0.62,
  floorMetalness: 0.12,
  environmentIntensity: { base: 1.1, headlightsOn: 1.15 },
  ambient: { base: 0.92, headlightsOn: 0.85 },
  directional: { base: 2.6, headlightsOn: 2.4 },
  directionalColor: "#fff8ec",
  hemisphere: { intensity: 0.55, sky: "#bfe2ff", ground: "#94a3b8" },
  fillPoint: 0.38,
  rimDirectional: 0.32,
  headlightSpot: 18,
  fog: { color: "#cdd9e8", near: 14, far: 38 },
};

const NIGHT: ShowroomSceneModeConfig = {
  label: "夜晚",
  description: "夜间城市氛围，凸显大灯投射与尾灯霓虹",
  background: "#02050d",
  themeColor: "#02060e",
  floorColor: "#1a2335",
  floorRoughness: 0.36,
  floorMetalness: 0.62,
  environmentIntensity: { base: 0.28, headlightsOn: 0.5 },
  ambient: { base: 0.18, headlightsOn: 0.24 },
  directional: { base: 0.48, headlightsOn: 0.78 },
  directionalColor: "#a8b6d4",
  hemisphere: { intensity: 0.18, sky: "#1e293b", ground: "#020617" },
  fillPoint: 0.55,
  rimDirectional: 0.62,
  headlightSpot: 64,
  fog: { color: "#020413", near: 9, far: 26 },
};

export const SHOWROOM_SCENE_MODES: Record<ShowroomSceneMode, ShowroomSceneModeConfig> = {
  studio: STUDIO,
  day: DAY,
  night: NIGHT,
};

export const SHOWROOM_SCENE_MODE_ORDER: ShowroomSceneMode[] = ["studio", "day", "night"];

export function isShowroomSceneMode(value: unknown): value is ShowroomSceneMode {
  return value === "studio" || value === "day" || value === "night";
}

export function resolveShowroomSceneMode(value: unknown): ShowroomSceneMode {
  return isShowroomSceneMode(value) ? value : "studio";
}
