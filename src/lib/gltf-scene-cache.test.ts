import { describe, expect, it } from "vitest";

import { selectOldestEvictableKey } from "@/lib/gltf-scene-cache";

describe("selectOldestEvictableKey", () => {
  it("skips the model on screen and the package just inserted", () => {
    expect(
      selectOldestEvictableKey(
        ["sedan", "suv", "offroad", "su7-ultra"],
        "su7-ultra",
        (key) => key === "sedan",
      ),
    ).toBe("suv");
  });

  it("keeps every on-screen model when nothing else can be dropped", () => {
    expect(
      selectOldestEvictableKey(["sedan", "suv"], "suv", () => true),
    ).toBeUndefined();
  });
});
