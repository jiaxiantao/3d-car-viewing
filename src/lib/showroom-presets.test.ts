import { describe, expect, it } from "vitest";

import { SHOWROOM_PRESETS, matchShowroomPreset } from "@/lib/showroom-presets";

describe("matchShowroomPreset", () => {
  it("marks welcome as selected when the car matches the welcome preset", () => {
    expect(matchShowroomPreset(SHOWROOM_PRESETS.welcome)).toBe("welcome");
  });

  it("marks drive as selected when the car matches the drive preset", () => {
    expect(SHOWROOM_PRESETS.drive.steeringAngle).toBe(0);
    expect(SHOWROOM_PRESETS.drive.lightsOn).toBe(true);
    expect(SHOWROOM_PRESETS.drive.engineOn).toBe(true);
    expect(SHOWROOM_PRESETS.drive.cameraPreset).toBe("cockpit");
    expect(SHOWROOM_PRESETS.drive.venue).toBe("road");
    expect(matchShowroomPreset(SHOWROOM_PRESETS.drive)).toBe("drive");
  });

  it("clears drive when the cockpit or highway is left", () => {
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.drive, cameraPreset: "overview" })).toBeNull();
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.drive, venue: "studio" })).toBeNull();
  });

  it("clears the selection when the car no longer matches either preset", () => {
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.welcome, lightsOn: false })).toBeNull();
    expect(matchShowroomPreset({ ...SHOWROOM_PRESETS.drive, speedKph: 28 })).toBeNull();
  });

  it("still matches welcome when disabled doors stay shut", () => {
    expect(
      matchShowroomPreset(
        { ...SHOWROOM_PRESETS.welcome, leftDoorOpen: false, rightDoorOpen: false },
        ["leftDoorOpen", "rightDoorOpen"],
      ),
    ).toBe("welcome");
  });
});
