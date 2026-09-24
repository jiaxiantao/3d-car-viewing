import { describe, expect, it } from "vitest";

import {
  approxBytesForModelUrl,
  CAR_CATEGORIES,
  DEFAULT_CAR_CATEGORY_KEY,
  isCarCategoryKey,
  resolveCarCategoryKey,
} from "@/lib/car-categories";

describe("car-categories", () => {
  it("defaults to sedan for unknown keys", () => {
    expect(DEFAULT_CAR_CATEGORY_KEY).toBe("sedan");
    expect(resolveCarCategoryKey("nope")).toBe("sedan");
    expect(resolveCarCategoryKey(undefined)).toBe("sedan");
  });

  it("validates category keys", () => {
    expect(isCarCategoryKey("sedan")).toBe(true);
    expect(isCarCategoryKey("suv")).toBe(true);
    expect(isCarCategoryKey("truck")).toBe(false);
  });

  it("exposes approxBytes for progress fallback", () => {
    expect(CAR_CATEGORIES.sedan.approxBytes).toBeGreaterThan(0);
    expect(CAR_CATEGORIES.suv.label).toBe("奥迪 Q3");
    expect(CAR_CATEGORIES.sedan.label).toBe("宝马 M2");
    expect(CAR_CATEGORIES.offroad.label).toBe("巴博斯 G900");
    expect(CAR_CATEGORIES["su7-max"].label).toBe("小米 SU7 Max");
    expect(CAR_CATEGORIES["su7-ultra"].label).toBe("小米 SU7 Ultra");
    expect(CAR_CATEGORIES.yu7.label).toBe("小米 YU7");
    expect(isCarCategoryKey("su7-max")).toBe(true);
    expect(isCarCategoryKey("su7-ultra")).toBe(true);
    expect(isCarCategoryKey("yu7")).toBe(true);
    expect(CAR_CATEGORIES.sedan.bakedWheels).toBe(false);
    expect(CAR_CATEGORIES.suv.bakedWheels).toBe(false);
    expect(CAR_CATEGORIES.offroad.bakedWheels).toBe(false);
    expect(CAR_CATEGORIES.yu7.bakedWheels).toBe(false);
    expect(approxBytesForModelUrl(CAR_CATEGORIES.sedan.primaryUrl)).toBe(
      CAR_CATEGORIES.sedan.approxBytes,
    );
    expect(approxBytesForModelUrl("unknown.glb")).toBe(8_000_000);
  });
});
