/**
 * Built-in GLB category keys and their public asset paths.
 */

export type CarCategoryKey = "suv" | "sedan" | "offroad";

export type CarCategory = {
  key: CarCategoryKey;
  label: string;
  primaryUrl: string;
};

export const CAR_CATEGORIES: Record<CarCategoryKey, CarCategory> = {
  suv: {
    key: "suv",
    label: "SUV",
    primaryUrl: "/models/market/suv-mainstream.glb",
  },
  sedan: {
    key: "sedan",
    label: "小轿车",
    primaryUrl: "/models/market/sedan-mainstream.glb",
  },
  offroad: {
    key: "offroad",
    label: "越野车",
    primaryUrl: "/models/market/offroad-mainstream.glb",
  },
};

export const CAR_CATEGORY_OPTIONS: CarCategory[] = Object.values(CAR_CATEGORIES);

export function isCarCategoryKey(value: unknown): value is CarCategoryKey {
  return value === "suv" || value === "sedan" || value === "offroad";
}

export function resolveCarCategoryKey(value: unknown): CarCategoryKey {
  return isCarCategoryKey(value) ? value : "suv";
}
