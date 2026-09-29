import { describe, expect, it } from "vitest";

import {
  driveTargetSpeedMps,
  repeatWindow,
  sceneryShiftX,
  stepDriveSpeedMps,
  wrapRange,
  wrappedTextureOffset,
} from "@/lib/showroom-drive";

describe("showroom drive speed", () => {
  it("rolls forward only while the engine is on", () => {
    expect(driveTargetSpeedMps(true, 36)).toBe(10);
    expect(driveTargetSpeedMps(false, 36)).toBe(0);
  });

  it("brakes toward the target faster than coasting", () => {
    const coast = stepDriveSpeedMps(0, 10, false, 0.1);
    const brake = stepDriveSpeedMps(10, 0, true, 0.1);
    const coastStop = stepDriveSpeedMps(10, 0, false, 0.1);

    expect(coast).toBeGreaterThan(0);
    expect(coast).toBeLessThan(10);
    expect(10 - brake).toBeGreaterThan(10 - coastStop);
  });
});

describe("road scenery relative motion", () => {
  it("slides the world toward +X when the car drives forward", () => {
    expect(sceneryShiftX(8, 0.5)).toBe(4);
  });

  it("slides the world toward −X when the car reverses", () => {
    expect(sceneryShiftX(-8, 0.5)).toBe(-4);
  });

  it("moves the asphalt pattern with the scenery, and reverses with it", () => {
    const tile = 84 / 16;
    expect(wrappedTextureOffset(tile, 84, 16)).toBeCloseTo(0);
    expect(wrappedTextureOffset(tile * 0.25, 84, 16)).toBeCloseTo(0.75);
    expect(wrappedTextureOffset(-tile * 0.25, 84, 16)).toBeCloseTo(0.25);
  });

  it("sends a tree that leaves the back of a row to the front", () => {
    const window = repeatWindow(-22, 16, 9);
    expect(wrapRange(16 + 9, window.min, window.span)).toBeCloseTo(-22);
  });

  it("sends a tree that leaves the front of a row to the back", () => {
    const window = repeatWindow(-22, 16, 9);
    expect(wrapRange(-22 - 0.5, window.min, window.span)).toBeCloseTo(window.min + window.span - 0.5);
  });
});
