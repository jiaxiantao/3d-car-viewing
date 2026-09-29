/**
 * Showroom scene presets. Venue (studio, indoor hall, outdoor highway) and
 * lighting (day vs night) combine independently. Lighting / floor / fog values
 * are consumed by `CarShowroomScene` and `ShowroomReflectiveFloor`. Studio,
 * hall, and highway each swap in their own backdrop.
 */

export type ShowroomVenueMode = "studio" | "hall" | "road";
export type ShowroomLightingMode = "day" | "night";

export const DEFAULT_SHOWROOM_VENUE: ShowroomVenueMode = "studio";
export const DEFAULT_SHOWROOM_LIGHTING: ShowroomLightingMode = "day";

export type ShowroomSceneModeConfig = {
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

const STUDIO_DAY: ShowroomSceneModeConfig = {
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
  fog: { color: "#d5e2f0", near: 34, far: 78 },
};

const STUDIO_NIGHT: ShowroomSceneModeConfig = {
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
  fog: { color: "#020413", near: 26, far: 70 },
};

const HALL_DAY: ShowroomSceneModeConfig = {
  background: "#c5d0dc",
  themeColor: "#c5d0dc",
  floorColor: "#6d7580",
  floorRoughness: 0.45,
  floorMetalness: 0.2,
  environmentIntensity: { base: 0.85, headlightsOn: 0.95 },
  ambient: { base: 0.55, headlightsOn: 0.5 },
  directional: { base: 1.7, headlightsOn: 1.55 },
  directionalColor: "#fff6e8",
  hemisphere: { intensity: 0.35, sky: "#d7e4f2", ground: "#8d8378" },
  fillPoint: 0.22,
  rimDirectional: 0.2,
  headlightSpot: 18,
  fog: { color: "#c5d0dc", near: 18, far: 42 },
};

const HALL_NIGHT: ShowroomSceneModeConfig = {
  background: "#070b12",
  themeColor: "#070b12",
  floorColor: "#1c2430",
  floorRoughness: 0.4,
  floorMetalness: 0.35,
  environmentIntensity: { base: 0.22, headlightsOn: 0.42 },
  ambient: { base: 0.16, headlightsOn: 0.22 },
  directional: { base: 0.32, headlightsOn: 0.5 },
  directionalColor: "#9eb0cc",
  hemisphere: { intensity: 0.12, sky: "#1a2436", ground: "#0b0e14" },
  fillPoint: 0.16,
  rimDirectional: 0.22,
  headlightSpot: 56,
  fog: { color: "#070b12", near: 16, far: 40 },
};

const ROAD_DAY: ShowroomSceneModeConfig = {
  background: "#8ebbe6",
  themeColor: "#9ec6ee",
  floorColor: "#3e4652",
  floorRoughness: 0.92,
  floorMetalness: 0.04,
  environmentIntensity: { base: 1.05, headlightsOn: 1.12 },
  ambient: { base: 0.7, headlightsOn: 0.64 },
  directional: { base: 2.4, headlightsOn: 2.2 },
  directionalColor: "#fff4dc",
  hemisphere: { intensity: 0.78, sky: "#7ec8ff", ground: "#6aaa45" },
  fillPoint: 0.18,
  rimDirectional: 0.16,
  headlightSpot: 16,
  fog: { color: "#b9d0ea", near: 70, far: 190 },
};

const ROAD_NIGHT: ShowroomSceneModeConfig = {
  background: "#07111e",
  themeColor: "#081018",
  floorColor: "#242a32",
  floorRoughness: 0.88,
  floorMetalness: 0.08,
  environmentIntensity: { base: 0.3, headlightsOn: 0.52 },
  ambient: { base: 0.2, headlightsOn: 0.26 },
  directional: { base: 0.36, headlightsOn: 0.62 },
  directionalColor: "#9eb0d0",
  hemisphere: { intensity: 0.2, sky: "#1a2744", ground: "#16301c" },
  fillPoint: 0.1,
  rimDirectional: 0.18,
  headlightSpot: 52,
  fog: { color: "#0a1422", near: 24, far: 110 },
};

const SCENE_CONFIGS: Record<
  `${ShowroomVenueMode}:${ShowroomLightingMode}`,
  ShowroomSceneModeConfig
> = {
  "studio:day": STUDIO_DAY,
  "studio:night": STUDIO_NIGHT,
  "hall:day": HALL_DAY,
  "hall:night": HALL_NIGHT,
  "road:day": ROAD_DAY,
  "road:night": ROAD_NIGHT,
};

export const SHOWROOM_VENUE_OPTIONS = [
  {
    id: "studio",
    label: "影棚",
    description: "白色圆形展厅，可搭配白天或夜晚光线",
  },
  {
    id: "hall",
    label: "大厅",
    description: "室内汽车展厅，车辆停在中央展示台",
  },
  {
    id: "road",
    label: "公路",
    description: "车辆停在右侧第一车道，两侧草地与天空",
  },
] as const satisfies readonly {
  id: ShowroomVenueMode;
  label: string;
  description: string;
}[];

export const SHOWROOM_LIGHTING_OPTIONS = [
  {
    id: "day",
    label: "白天",
    description: "柔和天光，适合查看车漆细节",
  },
  {
    id: "night",
    label: "夜晚",
    description: "夜间氛围，凸显大灯投射与尾灯",
  },
] as const satisfies readonly {
  id: ShowroomLightingMode;
  label: string;
  description: string;
}[];

export function isShowroomVenueMode(value: unknown): value is ShowroomVenueMode {
  return value === "studio" || value === "hall" || value === "road";
}

export function isShowroomLightingMode(value: unknown): value is ShowroomLightingMode {
  return value === "day" || value === "night";
}

export function resolveShowroomSceneConfig(
  venue: ShowroomVenueMode,
  lighting: ShowroomLightingMode,
): ShowroomSceneModeConfig {
  return SCENE_CONFIGS[`${venue}:${lighting}`];
}

/**
 * Read venue and lighting from `mode` plus optional `light`.
 * Legacy links used a single `mode`: `day` / `night` were studio lighting,
 * and `road` was the sunny highway.
 */
export function parseShowroomSceneQuery(
  mode: string | null,
  light: string | null,
): { venue?: ShowroomVenueMode; lighting?: ShowroomLightingMode } {
  const explicitLighting = isShowroomLightingMode(light) ? light : undefined;

  if (mode === "day" || mode === "night") {
    return { venue: "studio", lighting: explicitLighting ?? mode };
  }
  if (isShowroomVenueMode(mode)) {
    return { venue: mode, lighting: explicitLighting ?? DEFAULT_SHOWROOM_LIGHTING };
  }
  if (explicitLighting) {
    return { lighting: explicitLighting };
  }
  return {};
}
