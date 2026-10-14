import { describe, expect, it } from "vitest";

import { showroomCapabilityNote } from "@/lib/showroom-capability-note";

const open = {
  modelLabel: "小米 SU7 Ultra",
  leftDoor: true,
  rightDoor: true,
  trunk: true,
  sunroof: true,
  wheels: true,
};

describe("showroomCapabilityNote", () => {
  it("stays quiet when the current car can move every listed part", () => {
    expect(showroomCapabilityNote(open)).toBeNull();
  });

  it("names the parts that stay fused to the body", () => {
    expect(
      showroomCapabilityNote({
        ...open,
        modelLabel: "巴博斯 G900",
        leftDoor: false,
        rightDoor: false,
        trunk: false,
      }),
    ).toBe(
      "巴博斯 G900不能单独打开左门、右门、后备箱，这些部件和车身连在一起，按钮已禁用。车灯、双闪和启动仍然可用。",
    );
  });
});
