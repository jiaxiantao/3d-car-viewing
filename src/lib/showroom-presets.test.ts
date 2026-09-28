import { describe, expect, it } from "vitest";

import { SHOWROOM_PRESETS, matchShowroomPreset } from "@/lib/showroom-presets";

describe("matchShowroomPreset", () => {
  it("marks welcome as selected when the car matches the welcome preset", () => {
    expect(matchShowroomPreset(SHOWROOM_PRESETS.welcome)).toBe("welcome");
  });

  it("marks drive as selected when the car matches the drive preset", () => {
    expect(matchShowroomPreset(SHOWROOM_PRESETS.drive)).toBe("drive");
  });

  it("clears the selection when the car no longer matches either preset", () => {
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.welcome, lightsOn: false })).toBeNull();
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.drive, speedKph: 28 })).toBeNull();
  });
});
