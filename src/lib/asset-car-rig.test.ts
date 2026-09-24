import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { describe, expect, it } from "vitest";

import { applyWheelMotion, discoverAssetCarRig } from "@/lib/asset-car-rig";
import { getOrbitDistanceLimits, resolveShowroomCameraPose } from "@/lib/showroom-camera";

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

  it("hinges the Q3 liftgate on the roof seam and takes the rear glass with it", () => {
    const root = new THREE.Group();
    root.name = "Q3";
    root.add(mesh("Body_Carpaint", [0, 0.7, 0], [3.2, 1.2, 1.6]));
    // Painted shell: top-forward corner is the roof seam (min.x, max.y).
    root.add(mesh("Boot_ext2_Mesh_049_Carpaint_Q3", [1.55, 0.8, 0], [0.7, 0.8, 1.2]));
    root.add(mesh("Boot_ext3_Mesh_050_Windshild_Q3", [1.6, 1.05, 0], [0.4, 0.22, 1.05]));
    root.add(mesh("Boot_INT40_Mesh_054_Door_INT_Carpaint", [1.55, 0.8, 0], [0.66, 0.76, 1.1]));
    root.add(mesh("Boot_ext26_Mesh_192_Thrmoline_phong2mat", [1.58, 1.08, 0], [0.3, 0.04, 0.8]));
    // Front-screen defroster shares the Boot_ext26 prefix and must stay on the body.
    const frontDefroster = mesh("Boot_ext26_Mesh_192_Thrmoline1_phong2mat", [-1.2, 0.9, 0], [0.02, 0.04, 1.2]);
    root.add(frontDefroster);
    const hatchLamp = mesh("Door_Tail_lamp36_Mesh_136_Tail_Cover_Red", [1.85, 0.55, 0], [0.08, 0.06, 1.1]);
    const quarterLamp = mesh("polySurface3109_Mesh_188_Tail_Cover_Red", [1.7, 0.55, 0.85], [0.12, 0.1, 0.2]);
    root.add(hatchLamp);
    root.add(quarterLamp);

    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    expect(rig.trunkPivot).not.toBeNull();

    const underTrunk = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current === rig.trunkPivot) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };
    const find = (name: string) => {
      let found: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.name === name) {
          found = node;
        }
      });
      return found;
    };

    const glass = find("Boot_ext3_Mesh_050_Windshild_Q3");
    const inner = find("Boot_INT40_Mesh_054_Door_INT_Carpaint");
    const defroster = find("Boot_ext26_Mesh_192_Thrmoline_phong2mat");
    expect(glass && underTrunk(glass)).toBe(true);
    expect(inner && underTrunk(inner)).toBe(true);
    expect(defroster && underTrunk(defroster)).toBe(true);
    expect(underTrunk(hatchLamp)).toBe(true);
    expect(underTrunk(quarterLamp)).toBe(false);
    expect(underTrunk(frontDefroster)).toBe(false);

    const hinge = new THREE.Vector3();
    rig.trunkPivot!.getWorldPosition(hinge);
    const shell = new THREE.Box3().setFromObject(find("Boot_ext2_Mesh_049_Carpaint_Q3")!);
    expect(hinge.x).toBeCloseTo(shell.min.x, 2);
    expect(hinge.y).toBeCloseTo(shell.max.y, 2);
    expect(hinge.x).toBeLessThan(shell.max.x - 0.2);

    const glassBefore = new THREE.Box3().setFromObject(glass!).getCenter(new THREE.Vector3());
    const frontBefore = new THREE.Box3().setFromObject(frontDefroster).getCenter(new THREE.Vector3());
    rig.trunkPivot!.rotation.x = 1.1;
    root.updateWorldMatrix(true, true);
    const glassAfter = new THREE.Box3().setFromObject(glass!).getCenter(new THREE.Vector3());
    const frontAfter = new THREE.Box3().setFromObject(frontDefroster).getCenter(new THREE.Vector3());
    expect(glassAfter.distanceTo(glassBefore)).toBeGreaterThan(0.05);
    expect(frontAfter.distanceTo(frontBefore)).toBeLessThan(0.001);
  });

  it("splits Q3 tyre buffers into four spinning corners and leaves brake calipers fixed", () => {
    const root = new THREE.Group();
    root.name = "Q3";
    root.add(mesh("Body_Carpaint", [0, 0.6, 0], [3.2, 1.2, 1.6]));

    const corners: [number, number, number][] = [
      [-1.15, 0.22, 0.62],
      [-1.15, 0.22, -0.62],
      [1.15, 0.22, 0.62],
      [1.15, 0.22, -0.62],
    ];
    const merged = (name: string, size: [number, number, number]) => {
      const geometry = mergeGeometries(
        corners.map(([x, y, z]) => new THREE.BoxGeometry(...size).translate(x, y, z)),
      );
      const object = new THREE.Mesh(
        geometry!,
        new THREE.MeshStandardMaterial({ name: `${name}_Mat` }),
      );
      object.name = name;
      return object;
    };

    const tyre = merged("Q3_Tyre8_Mesh_243_Tyre_Nor", [0.22, 0.44, 0.44]);
    const rim = merged("Q3_Tyre2_Mesh_237_Alloy_rim", [0.16, 0.32, 0.32]);
    const caliper = merged("Q3_Tyre5_Mesh_240_Alloy_Break", [0.06, 0.12, 0.1]);
    root.add(tyre, rim, caliper);

    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    const wheels = [...rig.frontWheels, ...rig.rearWheels];
    expect(rig.capabilities.wheels).toBe(true);
    expect(rig.capabilities.wheelsSynthetic).toBe(false);
    expect(wheels).toHaveLength(8);
    expect(wheels.filter((node) => node.name.includes("Tyre_Nor"))).toHaveLength(4);
    expect(wheels.filter((node) => node.name.includes("Alloy_rim"))).toHaveLength(4);
    expect(wheels.some((node) => /Break/i.test(node.name))).toBe(false);
    expect(caliper.parent).toBe(root);

    root.updateWorldMatrix(true, true);
    const spinning = wheels.find((node) => node.name.includes("Tyre_Nor_FL")) as THREE.Mesh | undefined;
    expect(spinning).toBeDefined();
    const position = spinning!.geometry.getAttribute("position");
    const vertex = new THREE.Vector3().fromBufferAttribute(position, 0);
    const before = vertex.clone().applyMatrix4(spinning!.matrixWorld);
    const caliperBefore = new THREE.Box3().setFromObject(caliper).getCenter(new THREE.Vector3());

    applyWheelMotion(spinning!, 0.8, 0);
    spinning!.updateWorldMatrix(true, false);
    const after = new THREE.Vector3().fromBufferAttribute(position, 0).applyMatrix4(spinning!.matrixWorld);
    const caliperAfter = new THREE.Box3().setFromObject(caliper).getCenter(new THREE.Vector3());

    expect(after.distanceTo(before)).toBeGreaterThan(0.05);
    expect(caliperAfter.distanceTo(caliperBefore)).toBeLessThan(0.001);
    expect(rig.frontWheels.every((node) => node.name.endsWith("_FL") || node.name.endsWith("_FR"))).toBe(
      true,
    );
  });

  it("frames the cockpit on the steering rim from the driver's seat", () => {
    const root = new THREE.Group();
    root.add(mesh("Body_Carpaint", [0, 0.6, 0], [3.2, 1.2, 1.6]));
    root.add(mesh("Dasboard_Staring_Plastick", [0, 0.55, 0], [1.2, 0.45, 1.3]));
    root.add(mesh("Dasboard_Staring_Stich_SW", [-0.4, 0.66, -0.32], [0.12, 0.28, 0.28]));

    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.x).toBeCloseTo(-0.4, 1);
    expect(rig.steeringWheelCenter!.z).toBeCloseTo(-0.32, 1);

    const pose = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    const distance = pose.position.distanceTo(pose.target);
    const limits = getOrbitDistanceLimits(rig.bounds, "cockpit");
    expect(pose.target.y).toBeGreaterThan(rig.steeringWheelCenter!.y);
    expect(pose.target.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.2);
    expect(pose.position.x).toBeGreaterThan(pose.target.x);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(distance).toBeGreaterThan(limits.minDistance);
    expect(getOrbitDistanceLimits(rig.bounds, "overview").minDistance).toBeGreaterThan(2);

    const offset = pose.position.clone().sub(pose.target);
    const polar = Math.acos(offset.y / offset.length());
    expect(polar).toBeGreaterThan(0.6);
    expect(polar).toBeLessThan(1.5);
  });

  it("aims a cockpit without a named wheel at dash height, and finds a leather wheel", () => {
    const bare = new THREE.Group();
    bare.add(mesh("Body_Carpaint", [0, 0.6, 0], [3.2, 1.2, 1.6]));
    const bareRig = discoverAssetCarRig(bare, "models/market/sedan-mainstream.glb");
    expect(bareRig.steeringWheelCenter).toBeNull();
    const fallback = resolveShowroomCameraPose("cockpit", bareRig.bounds, null);
    const height = bareRig.bounds.max.y - bareRig.bounds.min.y;
    expect((fallback.target.y - bareRig.bounds.min.y) / height).toBeGreaterThan(0.55);
    expect(fallback.position.y).toBeGreaterThan(fallback.target.y);

    const root = new THREE.Group();
    root.add(mesh("Body_Carpaint", [0, 0.6, 0], [3.2, 1.2, 1.6]));
    root.add(mesh("leather_wheel", [-0.5, 0.8, 0.35], [0.16, 0.32, 0.32]));
    const rig = discoverAssetCarRig(root, "models/market/offroad-mainstream.glb");
    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.z).toBeGreaterThan(0.2);
    expect(rig.steeringWheelCenter!.y).toBeGreaterThan(0.6);
  });
});
