import { describe, expect, it } from "vitest";

import {
  approxBytesForModelUrl,
  CAR_CATEGORIES,
  CAR_CATEGORY_OPTIONS,
  DEFAULT_CAR_CATEGORY_KEY,
  carCategoryForModelUrl,
  glbCandidateUrls,
  isCarCategoryKey,
  resolveCarCategoryKey,
} from "@/lib/car-categories";

describe("car-categories", () => {
  it("lists models in the showroom picker order", () => {
    expect(CAR_CATEGORY_OPTIONS.map((category) => category.label)).toEqual([
      "小米 SU7 Ultra",
      "小米 YU7",
      "小米 SU7 Max",
      "奥迪 Q3",
      "巴博斯 G900",
      "宝马 M2",
    ]);
  });

  it("tries the selected GLB first, then every other GLB, before a geometric fallback", () => {
    expect(glbCandidateUrls("su7-ultra")).toEqual(
      CAR_CATEGORY_OPTIONS.map((category) => category.primaryUrl),
    );
    expect(glbCandidateUrls("sedan")).toEqual([
      CAR_CATEGORIES.sedan.primaryUrl,
      CAR_CATEGORIES["su7-ultra"].primaryUrl,
      CAR_CATEGORIES.yu7.primaryUrl,
      CAR_CATEGORIES["su7-max"].primaryUrl,
      CAR_CATEGORIES.suv.primaryUrl,
      CAR_CATEGORIES.offroad.primaryUrl,
    ]);
    expect(new Set(glbCandidateUrls("yu7")).size).toBe(CAR_CATEGORY_OPTIONS.length);
    expect(carCategoryForModelUrl(CAR_CATEGORIES.suv.primaryUrl)?.key).toBe("suv");
    expect(carCategoryForModelUrl("missing.glb")).toBeUndefined();
  });

  it("defaults to SU7 Ultra for unknown keys", () => {
    expect(DEFAULT_CAR_CATEGORY_KEY).toBe("su7-ultra");
    expect(resolveCarCategoryKey("nope")).toBe("su7-ultra");
    expect(resolveCarCategoryKey(undefined)).toBe("su7-ultra");
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
