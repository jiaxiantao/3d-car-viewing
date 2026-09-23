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
    expect(CAR_CATEGORIES.sedan.bakedWheels).toBe(false);
    expect(CAR_CATEGORIES.suv.bakedWheels).toBe(true);
    expect(approxBytesForModelUrl(CAR_CATEGORIES.sedan.primaryUrl)).toBe(
      CAR_CATEGORIES.sedan.approxBytes,
    );
    expect(approxBytesForModelUrl("unknown.glb")).toBe(8_000_000);
  });
});
