import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { SHOWROOM_GROUND_Y } from "@/components/showroom-environment";
import { galleryFloorTopY, hideGalleryFloorSlab, placeGalleryOnGround } from "@/components/showroom-studio-gallery";

describe("studio gallery placement", () => {
  it("treats the lowest wide slab as the floor and seats it on the showroom ground", () => {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.06, 40));
    floor.position.y = -5;
    const step = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 20));
    step.position.y = -4.7;
    root.add(floor, step);

    expect(galleryFloorTopY(root)).toBeCloseTo(-4.97, 2);

    placeGalleryOnGround(root);

    expect(galleryFloorTopY(root)).toBeCloseTo(SHOWROOM_GROUND_Y, 3);
    expect(floor.receiveShadow).toBe(true);
    expect(floor.castShadow).toBe(false);
    expect(floor.visible).toBe(false);
    expect(step.visible).toBe(true);

    floor.visible = true;
    hideGalleryFloorSlab(root);
    expect(floor.visible).toBe(false);
  });
});
