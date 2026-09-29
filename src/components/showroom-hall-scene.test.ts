import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { SHOWROOM_GROUND_Y } from "@/components/showroom-environment";
import { hallDisplayPadTopY, placeHallOnGround } from "@/components/showroom-hall-scene";

describe("hall placement", () => {
  it("seats the car-sized display pad on the showroom ground and yaws it along the car", () => {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 24));
    floor.position.y = -0.33;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2, 0.34, 4.4));
    pad.position.y = -0.15;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.09, 3.6));
    ceiling.position.y = 3.45;
    root.add(floor, pad, ceiling);

    expect(hallDisplayPadTopY(root)).toBeCloseTo(0.02, 2);

    placeHallOnGround(root);

    expect(root.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    expect(hallDisplayPadTopY(root)).toBeCloseTo(SHOWROOM_GROUND_Y, 3);
    expect(pad.receiveShadow).toBe(true);
    expect(pad.castShadow).toBe(false);
  });
});
