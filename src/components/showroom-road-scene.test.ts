import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  createMountainGeometry,
  MOUNTAIN_SEGMENTS,
  ROAD_SURFACE_TEXTURE,
  roadMarkWorldZ,
  roadRightLaneOffsetZ,
} from "@/components/showroom-road-scene";

describe("road right-hand lane", () => {
  it("maps the top of the road texture to the driver's right", () => {
    const laneCenterT = (0.25 + 0.472) / 2;
    const v = 1 - laneCenterT;
    const localY = (v - 0.5) * 10;
    const point = new THREE.Vector3(0, localY, 0).applyEuler(new THREE.Euler(-Math.PI / 2, 0, 0, "XYZ"));

    expect(point.z).toBeCloseTo(roadMarkWorldZ(laneCenterT), 5);
    expect(point.z).toBeLessThan(0);
  });

  it("shifts that lane onto the car at z = 0", () => {
    const offset = roadRightLaneOffsetZ();
    const laneCenterT = (0.25 + 0.472) / 2;

    expect(offset).toBeCloseTo(1.39, 5);
    expect(roadMarkWorldZ(laneCenterT) + offset).toBeCloseTo(0, 5);
  });
});

describe("road scene budgets", () => {
  it("keeps the asphalt texture and mountain grid small enough to build off a click", () => {
    expect(ROAD_SURFACE_TEXTURE.width * ROAD_SURFACE_TEXTURE.height).toBeLessThanOrEqual(512 * 256);
    const geometry = createMountainGeometry(-1);
    const vertices = geometry.getAttribute("position").count;
    geometry.dispose();

    expect(vertices).toBe((MOUNTAIN_SEGMENTS.across + 1) * (MOUNTAIN_SEGMENTS.depth + 1));
    expect(vertices).toBeLessThanOrEqual(129 * 49);
  });
});
