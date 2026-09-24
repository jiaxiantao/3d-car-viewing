/**
 * Built-in GLB category keys and their public asset paths.
 */

import { publicAssetPath } from "@/lib/public-asset-path";

export type CarCategoryKey = "suv" | "sedan" | "offroad";

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
};

export const CAR_CATEGORY_OPTIONS: CarCategory[] = Object.values(CAR_CATEGORIES);

/** Default showroom category — lightest model with full wheel rig. */
export const DEFAULT_CAR_CATEGORY_KEY: CarCategoryKey = "sedan";

export function isCarCategoryKey(value: unknown): value is CarCategoryKey {
  return value === "suv" || value === "sedan" || value === "offroad";
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
