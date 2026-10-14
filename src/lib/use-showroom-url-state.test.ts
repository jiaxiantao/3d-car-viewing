import { describe, expect, it } from "vitest";

import { SHOWROOM_DEFAULT_PAINT_ID, resolveShowroomPaint } from "@/lib/showroom-paint-options";
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
      venue: "studio",
      lighting: "night",
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
      venue: undefined,
      lighting: undefined,
    });
  });

  it("builds share urls with required keys", () => {
    const url = buildShowroomShareUrl({
      category: "offroad",
      paintId: "obsidian-black",
      cameraPreset: "rear",
      venue: "road",
      lighting: "night",
    });
    expect(url).toContain("model=offroad");
    expect(url).toContain("paint=obsidian-black");
    expect(url).toContain("camera=rear");
    expect(url).toContain("mode=road");
    expect(url).toContain("light=night");
  });

  it("accepts a highway venue with independent night lighting", () => {
    const legacy = new URLSearchParams("model=sedan&paint=factory&camera=overview&mode=road");
    expect(parseShowroomUrlSearchParams(legacy)).toMatchObject({
      venue: "road",
      lighting: "day",
    });
    const combined = new URLSearchParams(
      "model=sedan&paint=factory&camera=overview&mode=road&light=night",
    );
    expect(parseShowroomUrlSearchParams(combined)).toMatchObject({
      venue: "road",
      lighting: "night",
    });
  });

  it("keeps a custom paint hex and still drops unknown names", () => {
    expect(parseShowroomUrlSearchParams(new URLSearchParams("paint=custom-c5c9ce")).paintId).toBe(
      "custom-c5c9ce",
    );
    expect(parseShowroomUrlSearchParams(new URLSearchParams("paint=neon")).paintId).toBeUndefined();
    expect(resolveShowroomPaint("custom-c5c9ce")).toMatchObject({
      label: "银色",
      primary: "#c5c9ce",
    });
  });

  it("accepts the factory paint id and treats it as the default", () => {
    const params = new URLSearchParams("model=su7-max&paint=factory&camera=overview&mode=studio");
    expect(parseShowroomUrlSearchParams(params).paintId).toBe("factory");
    expect(SHOWROOM_DEFAULT_PAINT_ID).toBe("factory");
    expect(resolveShowroomPaint(undefined).factory).toBe(true);
    expect(resolveShowroomPaint("missing").factory).toBe(true);
  });
});
