import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { describe, expect, it } from "vitest";

import { discoverAssetCarRig } from "@/lib/asset-car-rig";

function mesh(
  name: string,
  position: [number, number, number],
  size: [number, number, number] = [0.35, 0.45, 0.12],
) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({ color: "#888888", name: `${name}_Mat` });
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  return object;
}

describe("discoverAssetCarRig", () => {
  it("discovers doors, trunk, lights, and wheels from mesh names", () => {
    const root = new THREE.Group();
    root.name = "TestCar";
    // Body reference span ~3.2 x 1.6 (depth x width in showroom coords).
    root.add(mesh("Body_Carpaint", [0, 0.5, 0], [3.2, 0.8, 1.6]));
    // Localized door panels on the front half, left (+Z) / right (-Z).
    root.add(mesh("Door_Black_Plastic_L", [-0.6, 0.4, 0.75], [0.7, 0.5, 0.1]));
    root.add(mesh("Door_Black_Plastic_R", [-0.6, 0.4, -0.75], [0.7, 0.5, 0.1]));
    root.add(mesh("Boot_ext_Lid", [1.35, 0.7, 0], [0.35, 0.25, 1.0]));
    root.add(mesh("HL1_Lamp_L", [-1.5, 0.45, 0.45], [0.12, 0.1, 0.18]));
    root.add(mesh("HL1_Lamp_R", [-1.5, 0.45, -0.45], [0.12, 0.1, 0.18]));
    root.add(mesh("Tail_upper_Red_L", [1.5, 0.45, 0.45], [0.12, 0.1, 0.18]));
    root.add(mesh("Tail_upper_Red_R", [1.5, 0.45, -0.45], [0.12, 0.1, 0.18]));
    root.add(mesh("Wheel_FL", [-1.1, 0.22, 0.7], [0.4, 0.4, 0.22]));
    root.add(mesh("Wheel_FR", [-1.1, 0.22, -0.7], [0.4, 0.4, 0.22]));
    root.add(mesh("Wheel_RL", [1.1, 0.22, 0.7], [0.4, 0.4, 0.22]));
    root.add(mesh("Wheel_RR", [1.1, 0.22, -0.7], [0.4, 0.4, 0.22]));
    root.add(mesh("Roof_glass_Sunroof", [0, 1.05, 0], [0.6, 0.05, 0.7]));

    const rig = discoverAssetCarRig(root, "models/market/test-generic.glb");

    expect(rig.capabilities.leftDoor).toBe(true);
    expect(rig.capabilities.rightDoor).toBe(true);
    expect(rig.capabilities.trunk).toBe(true);
    expect(rig.capabilities.headLights).toBe(true);
    expect(rig.capabilities.tailLights).toBe(true);
    expect(rig.capabilities.wheels).toBe(true);
    expect(rig.capabilities.sunroof).toBe(true);
    expect(rig.leftDoorPivot).not.toBeNull();
    expect(rig.rightDoorPivot).not.toBeNull();
    expect(rig.trunkPivot).not.toBeNull();
    expect(rig.frontWheels.length + rig.rearWheels.length).toBeGreaterThanOrEqual(2);
  });

  it("reports missing interactive parts for a bare body mesh", () => {
    const root = new THREE.Group();
    root.add(mesh("Merged_Body", [0, 0.5, 0], [3, 1, 1.5]));
    const rig = discoverAssetCarRig(root);

    expect(rig.capabilities.leftDoor).toBe(false);
    expect(rig.capabilities.rightDoor).toBe(false);
    expect(rig.capabilities.trunk).toBe(false);
    expect(rig.capabilities.wheels).toBe(false);
  });

  it("keeps door hinges world-aligned under scaled/offset root", () => {
    const root = new THREE.Group();
    root.name = "ScaledCar";
    root.add(mesh("Body_Carpaint", [0, 0.5, 0], [3.2, 0.8, 1.6]));
    root.add(mesh("Door_Black_Plastic_L", [-0.6, 0.4, 0.75], [0.7, 0.5, 0.1]));
    root.add(mesh("Door_Black_Plastic_R", [-0.6, 0.4, -0.75], [0.7, 0.5, 0.1]));
    root.add(mesh("Roof_glass_Sunroof", [0, 1.05, 0], [0.6, 0.05, 0.7]));

    root.scale.setScalar(0.4);
    root.position.set(0.5, -0.2, -0.3);
    root.updateWorldMatrix(true, true);

    const rig = discoverAssetCarRig(root, "models/market/test-generic.glb");
    expect(rig.leftDoorPivot).not.toBeNull();
    expect(rig.rightDoorPivot).not.toBeNull();
    expect(rig.leftDoorPivot!.userData.showroomOpenSign).toBe(-1);
    expect(rig.rightDoorPivot!.userData.showroomOpenSign).toBe(1);

    const leftWorld = new THREE.Vector3();
    const leftUp = new THREE.Vector3(0, 1, 0);
    rig.leftDoorPivot!.getWorldPosition(leftWorld);
    leftUp.applyQuaternion(rig.leftDoorPivot!.getWorldQuaternion(new THREE.Quaternion()));

    expect(leftWorld.z).toBeGreaterThan(0);
    expect(leftUp.y).toBeGreaterThan(0.95);

    const sunroof = rig.sunroofNodes[0];
    expect(sunroof.userData.showroomSunroofBasePos).toBeInstanceOf(THREE.Vector3);
    expect(sunroof.userData.showroomSunroofOpenDelta).toBeInstanceOf(THREE.Vector3);
  });

  it("parents only the front-door slice of a shared beltline cover", () => {
    const root = new THREE.Group();
    root.name = "Q3";
    root.add(mesh("Body_Carpaint", [0, 0.5, 0], [3.2, 0.8, 1.6]));
    root.add(mesh("polySurface2908_Mesh_142", [-0.5, 0.55, -0.8], [0.9, 1.0, 0.1]));
    root.add(mesh("polySurface5638_Mesh_165", [-0.5, 0.7, -0.78], [0.7, 0.5, 0.06]));
    root.add(mesh("polySurface2889_Mesh_140", [-0.5, 0.55, 0.8], [0.9, 1.0, 0.1]));
    root.add(mesh("polySurface5632_Mesh_162", [-0.5, 0.7, 0.78], [0.7, 0.5, 0.06]));

    const cover = new THREE.Mesh(
      mergeGeometries([
        new THREE.BoxGeometry(0.5, 0.08, 0.04).translate(-0.5, 0.75, -0.8),
        new THREE.BoxGeometry(0.5, 0.08, 0.04).translate(-0.5, 0.75, 0.8),
        new THREE.BoxGeometry(0.4, 0.08, 0.04).translate(0.9, 0.75, -0.8),
      ]),
      new THREE.MeshStandardMaterial({ name: "AO_Plastic_Door" }),
    );
    cover.name = "Q3_Technology7_Mesh_232_Door_Black_Plastic_Pattern";
    root.add(cover);

    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    expect(rig.leftDoorPivot).not.toBeNull();
    expect(rig.rightDoorPivot).not.toBeNull();
    const leftHinge = new THREE.Vector3();
    const rightHinge = new THREE.Vector3();
    rig.leftDoorPivot!.getWorldPosition(leftHinge);
    rig.rightDoorPivot!.getWorldPosition(rightHinge);
    expect(leftHinge.z).toBeGreaterThan(0);
    expect(rightHinge.z).toBeLessThan(0);

    const covers = root.children.flatMap((child) => {
      const found: THREE.Mesh[] = [];
      child.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh && mesh.name.includes("Technology7")) {
          found.push(mesh);
        }
      });
      return found;
    });
    const under = (object: THREE.Object3D, pivot: THREE.Object3D | null) => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current === pivot) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };
    const leftPiece = covers.find((item) => under(item, rig.leftDoorPivot));
    const rightPiece = covers.find((item) => under(item, rig.rightDoorPivot));
    const rearPiece = covers.find(
      (item) => !under(item, rig.leftDoorPivot) && !under(item, rig.rightDoorPivot),
    );
    expect(leftPiece).toBeDefined();
    expect(rightPiece).toBeDefined();
    expect(rearPiece).toBeDefined();

    const centerOf = (object: THREE.Object3D) =>
      new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    const rightBefore = centerOf(rightPiece!);
    const rearBefore = centerOf(rearPiece!);
    const leftBefore = centerOf(leftPiece!);

    const openSign = rig.leftDoorPivot!.userData.showroomOpenSign as number;
    rig.leftDoorPivot!.rotation.y = openSign * 0.9;
    root.updateWorldMatrix(true, true);

    expect(centerOf(leftPiece!).distanceTo(leftBefore)).toBeGreaterThan(0.05);
    expect(centerOf(rightPiece!).distanceTo(rightBefore)).toBeLessThan(0.001);
    expect(centerOf(rearPiece!).distanceTo(rearBefore)).toBeLessThan(0.001);
  });
});
