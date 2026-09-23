import * as THREE from "three";
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
});
