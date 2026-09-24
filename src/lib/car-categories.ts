/**
 * Built-in GLB category keys and their public asset paths.
 */

import { publicAssetPath } from "@/lib/public-asset-path";

export type CarCategoryKey =
  | "suv"
  | "sedan"
  | "offroad"
  | "su7-max"
  | "su7-ultra"
  | "yu7";

export type CarCategory = {
  key: CarCategoryKey;
  label: string;
  primaryUrl: string;
  /** Approximate compressed GLB size for progress when Content-Length is missing. */
  approxBytes: number;
  /** True when wheels are baked into body meshes (no independent spin). */
  bakedWheels: boolean;
  /** Short capability hint shown in the category picker. */
  capabilityHint?: string;
};

export const CAR_CATEGORIES: Record<CarCategoryKey, CarCategory> = {
  suv: {
    key: "suv",
    label: "奥迪 Q3",
    primaryUrl: publicAssetPath("/models/market/suv-mainstream.glb"),
    approxBytes: 14_500_000,
    bakedWheels: false,
    capabilityHint: "",
  },
  sedan: {
    key: "sedan",
    label: "宝马 M2",
    primaryUrl: publicAssetPath("/models/market/sedan-mainstream.glb"),
    approxBytes: 2_800_000,
    bakedWheels: false,
    capabilityHint: "",
  },
  offroad: {
    key: "offroad",
    label: "巴博斯 G900",
    primaryUrl: publicAssetPath("/models/market/offroad-mainstream.glb"),
    approxBytes: 9_500_000,
    bakedWheels: false,
    capabilityHint: "",
  },
  "su7-max": {
    key: "su7-max",
    label: "小米 SU7 Max",
    primaryUrl: publicAssetPath("/models/market/2024_xiaomi_su7_max.glb"),
    approxBytes: 5_500_000,
    bakedWheels: false,
    capabilityHint: "",
  },
  "su7-ultra": {
    key: "su7-ultra",
    label: "小米 SU7 Ultra",
    primaryUrl: publicAssetPath("/models/market/2025_xiaomi_su7_ultra.glb"),
    approxBytes: 32_000_000,
    bakedWheels: false,
    capabilityHint: "",
  },
  yu7: {
    key: "yu7",
    label: "小米 YU7",
    primaryUrl: publicAssetPath("/models/market/2025_xiaomi_yu7.glb"),
    approxBytes: 29_000_000,
    bakedWheels: false,
    capabilityHint: "",
  },
};

export const CAR_CATEGORY_OPTIONS: CarCategory[] = Object.values(CAR_CATEGORIES);

/** Default showroom category — lightest model with full wheel rig. */
export const DEFAULT_CAR_CATEGORY_KEY: CarCategoryKey = "sedan";

export function isCarCategoryKey(value: unknown): value is CarCategoryKey {
  return (
    value === "suv" ||
    value === "sedan" ||
    value === "offroad" ||
    value === "su7-max" ||
    value === "su7-ultra" ||
    value === "yu7"
  );
}

export function resolveCarCategoryKey(value: unknown): CarCategoryKey {
  return isCarCategoryKey(value) ? value : DEFAULT_CAR_CATEGORY_KEY;
}

export function approxBytesForModelUrl(url: string): number {
  const match = CAR_CATEGORY_OPTIONS.find(
    (category) => category.primaryUrl === url || url.endsWith(category.primaryUrl),
  );
  return match?.approxBytes ?? 8_000_000;
}
