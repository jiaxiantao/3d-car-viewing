import { describe, expect, it } from "vitest";

import {
  SHOWROOM_LIGHTING_OPTIONS,
  SHOWROOM_VENUE_OPTIONS,
  parseShowroomSceneQuery,
  resolveShowroomSceneConfig,
} from "@/lib/showroom-scene-modes";

describe("showroom scene modes", () => {
  it("keeps venue and lighting as independent choices", () => {
    expect(SHOWROOM_VENUE_OPTIONS.map((option) => option.id)).toEqual(["studio", "hall", "road"]);
    expect(SHOWROOM_LIGHTING_OPTIONS.map((option) => option.id)).toEqual(["day", "night"]);
  });

  it("gives every venue its own day and night lighting", () => {
    const studioDay = resolveShowroomSceneConfig("studio", "day");
    const studioNight = resolveShowroomSceneConfig("studio", "night");
    const hallDay = resolveShowroomSceneConfig("hall", "day");
    const hallNight = resolveShowroomSceneConfig("hall", "night");
    const roadDay = resolveShowroomSceneConfig("road", "day");
    const roadNight = resolveShowroomSceneConfig("road", "night");

    expect(studioDay.background).not.toBe(studioNight.background);
    expect(hallDay.background).not.toBe(hallNight.background);
    expect(roadDay.background).not.toBe(roadNight.background);
    expect(roadDay.fog).toBeDefined();
    expect(roadNight.fog).toBeDefined();
    expect(roadDay.hemisphere.sky).not.toBe(roadDay.hemisphere.ground);
    expect(roadNight.headlightSpot).toBeGreaterThan(roadDay.headlightSpot);
  });

  it("maps legacy single mode links onto venue plus lighting", () => {
    expect(parseShowroomSceneQuery("night", null)).toEqual({
      venue: "studio",
      lighting: "night",
    });
    expect(parseShowroomSceneQuery("day", null)).toEqual({
      venue: "studio",
      lighting: "day",
    });
    expect(parseShowroomSceneQuery("road", null)).toEqual({
      venue: "road",
      lighting: "day",
    });
    expect(parseShowroomSceneQuery("road", "night")).toEqual({
      venue: "road",
      lighting: "night",
    });
    expect(parseShowroomSceneQuery("studio", "night")).toEqual({
      venue: "studio",
      lighting: "night",
    });
    expect(parseShowroomSceneQuery("hall", "night")).toEqual({
      venue: "hall",
      lighting: "night",
    });
  });
});
