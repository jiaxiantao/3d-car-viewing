import { describe, expect, it } from "vitest";

import {
  buildShowroomShareUrl,
  parseShowroomUrlSearchParams,
} from "@/lib/use-showroom-url-state";

describe("showroom url state", () => {
  it("parses valid query params", () => {
    const params = new URLSearchParams(
      "model=sedan&paint=lava-red&camera=front&mode=night",
    );
    expect(parseShowroomUrlSearchParams(params)).toEqual({
      category: "sedan",
      paintId: "lava-red",
      cameraPreset: "front",
      sceneMode: "night",
    });
  });

  it("drops invalid values", () => {
    const params = new URLSearchParams(
      "model=truck&paint=neon&camera=zoom&mode=disco",
    );
    expect(parseShowroomUrlSearchParams(params)).toEqual({
      category: undefined,
      paintId: undefined,
      cameraPreset: undefined,
      sceneMode: undefined,
    });
  });

  it("builds share urls with required keys", () => {
    const url = buildShowroomShareUrl({
      category: "offroad",
      paintId: "obsidian-black",
      cameraPreset: "rear",
      sceneMode: "day",
    });
    expect(url).toContain("model=offroad");
    expect(url).toContain("paint=obsidian-black");
    expect(url).toContain("camera=rear");
    expect(url).toContain("mode=day");
  });
});
