import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyWheelMotion, ASSET_DOOR_MAX_OPEN_RADIANS, discoverAssetCarRig } from "@/lib/asset-car-rig";
import { normalizeMarketModel } from "@/lib/normalize-market-model";
import { resolveShowroomCameraPose } from "@/lib/showroom-camera";

function sanitizeNodeName(name: string) {
  return name.replace(/\s/g, "_").replace(/[\[\].:\/]/g, "");
}

function toThreeNode(gltfNode: GltfNode): THREE.Object3D {
  const translation = gltfNode.getTranslation();
  const rotation = gltfNode.getRotation();
  const scale = gltfNode.getScale();
  const mesh = gltfNode.getMesh();
  let object: THREE.Object3D;
  if (mesh) {
    const meshes = mesh.listPrimitives().map((primitive) => {
      const geometry = new THREE.BufferGeometry();
      const position = primitive.getAttribute("POSITION");
      const positionValues = position?.getArray();
      if (position && positionValues) {
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(Float32Array.from(positionValues), position.getElementSize()),
        );
      }
      const indices = primitive.getIndices();
      const indexValues = indices?.getArray();
      if (indexValues) {
        const IndexArray = indexValues.BYTES_PER_ELEMENT === 4 ? Uint32Array : Uint16Array;
        geometry.setIndex(new THREE.BufferAttribute(IndexArray.from(indexValues), 1));
      }
      const materialName = primitive.getMaterial()?.getName() ?? "";
      return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: materialName }));
    });
    object = meshes.length === 1 ? meshes[0] : new THREE.Group();
    if (object instanceof THREE.Group) {
      for (const child of meshes) {
        object.add(child);
      }
    }
  } else {
    object = new THREE.Group();
  }
  object.name = sanitizeNodeName(gltfNode.getName());
  object.position.set(translation[0], translation[1], translation[2]);
  object.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
  object.scale.set(scale[0], scale[1], scale[2]);
  for (const child of gltfNode.listChildren()) {
    object.add(toThreeNode(child));
  }
  return object;
}

async function loadRig(fileName: string) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });
  const document = await io.read(path.join(process.cwd(), "public/models/market", fileName));
  const scene = document.getRoot().listScenes()[0];
  const root = new THREE.Group();
  for (const child of scene.listChildren()) {
    root.add(toThreeNode(child));
  }
  normalizeMarketModel(root);
  return discoverAssetCarRig(root, `models/market/${fileName}`);
}

function sunroofWorldTravel(node: THREE.Object3D) {
  const delta = (node.userData.showroomSunroofOpenDelta as THREE.Vector3).clone();
  const linear = node.parent!.matrixWorld.clone();
  linear.setPosition(0, 0, 0);
  return delta.applyMatrix4(linear);
}

/** How far the top of the outer rim lip slides sideways during one revolution. */
function rimLipLateralSpan(wheel: THREE.Object3D) {
  let hub: THREE.Mesh | null = null;
  wheel.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && /Hub/i.test(mesh.name) && !hub) {
      hub = mesh;
    }
  });
  expect(hub).toBeTruthy();
  const lip = hub as unknown as THREE.Mesh;
  lip.updateWorldMatrix(true, false);
  const center = new THREE.Box3().setFromObject(lip).getCenter(new THREE.Vector3());
  const position = lip.geometry.getAttribute("position");
  const sample = new THREE.Vector3();
  let maxRadius = 0;
  for (let index = 0; index < position.count; index += 1) {
    sample.fromBufferAttribute(position, index).applyMatrix4(lip.matrixWorld);
    maxRadius = Math.max(maxRadius, Math.hypot(sample.x - center.x, sample.y - center.y));
  }
  const outward = center.z >= 0 ? 1 : -1;
  const indices: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    sample.fromBufferAttribute(position, index).applyMatrix4(lip.matrixWorld);
    const radius = Math.hypot(sample.x - center.x, sample.y - center.y);
    if (radius > maxRadius * 0.92 && (sample.z - center.z) * outward > 0.02) {
      indices.push(index);
    }
  }
  expect(indices.length).toBeGreaterThan(12);

  const rest = new THREE.Vector3()
    .fromBufferAttribute(position, indices[0])
    .applyMatrix4(lip.matrixWorld);
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let step = 0; step < 24; step += 1) {
    applyWheelMotion(wheel, (step / 24) * Math.PI * 2, 0);
    lip.updateWorldMatrix(true, false);
    let topY = -Infinity;
    let topZ = 0;
    for (const index of indices) {
      sample.fromBufferAttribute(position, index).applyMatrix4(lip.matrixWorld);
      if (sample.y > topY) {
        topY = sample.y;
        topZ = sample.z;
      }
    }
    minZ = Math.min(minZ, topZ);
    maxZ = Math.max(maxZ, topZ);
  }
  applyWheelMotion(wheel, 0.8, 0);
  lip.updateWorldMatrix(true, false);
  const moved = new THREE.Vector3()
    .fromBufferAttribute(position, indices[0])
    .applyMatrix4(lip.matrixWorld)
    .distanceTo(rest);
  applyWheelMotion(wheel, 0, 0);
  return { span: maxZ - minZ, moved };
}

/** How far a round wheel's bounds center wanders during one revolution. */
function wheelCenterTravel(wheel: THREE.Object3D) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let step = 0; step < 24; step += 1) {
    applyWheelMotion(wheel, (step / 24) * Math.PI * 2, 0);
    const center = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
    minX = Math.min(minX, center.x);
    maxX = Math.max(maxX, center.x);
    minY = Math.min(minY, center.y);
    maxY = Math.max(maxY, center.y);
  }
  applyWheelMotion(wheel, 0, 0);
  return Math.hypot(maxX - minX, maxY - minY);
}

/** Outward travel of the door shell's leading edge at full open, in showroom meters. */
function leadingEdgeSwing(pivot: THREE.Object3D) {
  let shell: THREE.Mesh | null = null;
  pivot.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!shell && mesh.isMesh && /carPaint_\d/i.test(mesh.name)) {
      shell = mesh;
    }
  });
  if (!shell) {
    return { lead: 0, swing: 0, outset: 0 };
  }
  const door = shell as THREE.Mesh;
  const box = new THREE.Box3().setFromObject(door);
  const hinge = new THREE.Vector3();
  pivot.getWorldPosition(hinge);
  const openSign = pivot.userData.showroomOpenSign as number;
  const outerZ = openSign === -1 ? box.max.z : box.min.z;
  const defaultInward = Math.min(0.055, (box.max.z - box.min.z) * 0.4);
  const hingeFromOuter = openSign === -1 ? hinge.z - outerZ : outerZ - hinge.z;
  const outset = defaultInward + hingeFromOuter;
  const outward = -openSign;
  const rot = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    openSign * ASSET_DOOR_MAX_OPEN_RADIANS,
  );
  const position = door.geometry.getAttribute("position");
  door.updateWorldMatrix(true, true);
  const point = new THREE.Vector3();
  const limit = box.min.x + 0.04;
  let sum = 0;
  let count = 0;
  for (let index = 0; index < position.count; index += 2) {
    point.fromBufferAttribute(position, index).applyMatrix4(door.matrixWorld);
    if (point.x > limit) {
      continue;
    }
    const opened = point.clone().sub(hinge).applyQuaternion(rot).add(hinge);
    sum += (opened.z - point.z) * outward;
    count += 1;
  }
  return { lead: box.min.x - hinge.x, swing: count > 0 ? sum / count : 0, outset };
}

function partItems(rig: ReturnType<typeof discoverAssetCarRig>, key: string) {
  return rig.debug.parts.find((part) => part.key === key)?.items.join("\n") ?? "";
}

describe("Xiaomi showroom rigs", () => {
  it("spins SU7 Max wheels and lamps without tearing the fused body", async () => {
    const rig = await loadRig("2024_xiaomi_su7_max.glb");
    expect(rig.capabilities).toMatchObject({
      leftDoor: false,
      rightDoor: false,
      trunk: false,
      sunroof: false,
      headLights: true,
      tailLights: true,
      wheels: true,
    });
    expect(rig.headLightMaterials.some((material) => material.userData.showroomHeadlampLens)).toBe(
      true,
    );
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    expect(rig.frontWheels.length).toBeGreaterThanOrEqual(2);
    expect(rig.rearWheels.length).toBeGreaterThanOrEqual(2);
    const brakes: THREE.Object3D[] = [];
    rig.frontWheels[0]?.parent?.traverse((node) => {
      if (/brake/i.test(node.name)) {
        brakes.push(node);
      }
    });
    expect(brakes.length).toBeGreaterThan(0);
    for (const brake of brakes) {
      expect(brake.parent?.name ?? "").not.toMatch(/3DWheel/i);
    }
    for (const wheel of [...rig.frontWheels, ...rig.rearWheels]) {
      const { span, moved } = rimLipLateralSpan(wheel);
      expect(moved).toBeGreaterThan(0.05);
      // A cambered disc spun around world Z slides the rim lip sideways each turn.
      expect(span).toBeLessThan(0.004);
    }

    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.x).toBeGreaterThan(-0.6);
    expect(rig.steeringWheelCenter!.x).toBeLessThan(-0.2);
    expect(rig.steeringWheelCenter!.z).toBeGreaterThan(0.15);
    expect(rig.steeringWheelCenter!.y).toBeGreaterThan(0.45);
    const pose = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    expect(pose.position.x).toBeGreaterThan(rig.steeringWheelCenter!.x);
    expect(pose.target.x).toBeLessThan(pose.position.x);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(pose.target.y).toBeLessThan(rig.steeringWheelCenter!.y);
    // The unnamed fallback used to sit at x≈0.33, inside the rear cabin shell.
    expect(pose.position.x).toBeLessThan(0.15);
    expect(pose.position.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.8);
  }, 60_000);

  it("opens SU7 Ultra front doors, hatch, and roof glass", async () => {
    const rig = await loadRig("2025_xiaomi_su7_ultra.glb");
    expect(rig.capabilities).toMatchObject({
      leftDoor: true,
      rightDoor: true,
      trunk: true,
      sunroof: true,
      headLights: true,
      tailLights: true,
      wheels: true,
    });
    expect(partItems(rig, "leftDoor")).toMatch(/carPaint_4_carPaint_4/i);
    expect(partItems(rig, "rightDoor")).toMatch(/carPaint_6_carPaint_6/i);
    expect(partItems(rig, "leftDoor")).not.toMatch(/carPaint_1_carPaint_1/i);
    expect(partItems(rig, "trunk")).toMatch(/carPaint_8_carPaint_8/i);
    expect(partItems(rig, "trunk")).toMatch(/carSpoilers_/i);
    expect(partItems(rig, "trunk")).toMatch(/empennage_PlasticBack/i);
    expect(partItems(rig, "trunk")).toMatch(/carTailBracket_/i);
    expect(partItems(rig, "trunk")).toMatch(/carXiaoMi_1_/i);
    expect(partItems(rig, "trunk")).toMatch(/BrilliantBlack_4_2_/i);
    expect(partItems(rig, "trunk")).not.toMatch(/trunk_9/i);
    expect(partItems(rig, "trunk")).not.toMatch(/trunk_6_carPlastic/i);
    expect(partItems(rig, "trunk")).not.toMatch(/Glass_back_2_Side_carGlass/i);
    expect(partItems(rig, "trunk")).not.toMatch(/carGlass_back_1_carGlass_back_1/i);
    expect(partItems(rig, "trunk")).not.toMatch(/carHeaterStrip_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLightGlass_Back_2_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLightPlastic_BrilliantBlack_2_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLight_bulb_2_/i);
    expect(partItems(rig, "trunk")).not.toMatch(/carLightGlass_Back_1_/i);
    expect(partItems(rig, "trunk")).not.toMatch(/carLightPlastic_BrilliantBlack_1_/i);
    expect(partItems(rig, "tailLights")).toMatch(/carLightGlass_Back_1_/i);
    expect(partItems(rig, "tailLights")).toMatch(/carLightGlass_Back_2_/i);
    let heaterVisible = false;
    rig.trunkPivot?.parent?.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && /carHeaterStrip_/i.test(mesh.name)) {
        heaterVisible = mesh.visible;
      }
    });
    expect(heaterVisible).toBe(true);
    const findMesh = (pattern: RegExp) => {
      let found: THREE.Mesh | null = null;
      rig.trunkPivot?.parent?.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!found && mesh.isMesh && pattern.test(mesh.name)) {
          found = mesh;
        }
      });
      return found;
    };
    const sideLens = findMesh(/carLightGlass_Back_1_/i);
    const centerLens = findMesh(/carLightGlass_Back_2_/i);
    const centerHousing = findMesh(/carLightPlastic_BrilliantBlack_2_/i);
    expect(sideLens).toBeTruthy();
    expect(centerLens).toBeTruthy();
    expect(centerHousing).toBeTruthy();
    const sideRest = new THREE.Box3().setFromObject(sideLens!).getCenter(new THREE.Vector3());
    const centerRest = new THREE.Box3().setFromObject(centerLens!).getCenter(new THREE.Vector3());
    const housingRest = new THREE.Box3().setFromObject(centerHousing!).getCenter(new THREE.Vector3());
    const housingReach = new THREE.Box3().setFromObject(centerHousing!).max.z;
    // The cover already ends on the lamp line. A plane cut used to leave a straight stub.
    expect(housingReach).toBeGreaterThan(0.46);
    rig.trunkPivot!.rotation.x = 1.1;
    rig.trunkPivot!.updateWorldMatrix(true, true);
    expect(
      new THREE.Box3().setFromObject(sideLens!).getCenter(new THREE.Vector3()).distanceTo(sideRest),
    ).toBeLessThan(0.01);
    expect(
      new THREE.Box3()
        .setFromObject(centerLens!)
        .getCenter(new THREE.Vector3())
        .distanceTo(centerRest),
    ).toBeGreaterThan(0.08);
    expect(
      new THREE.Box3()
        .setFromObject(centerHousing!)
        .getCenter(new THREE.Vector3())
        .distanceTo(housingRest),
    ).toBeGreaterThan(0.08);
    expect(partItems(rig, "sunroof")).toMatch(/carRoof_su7Pro/i);
    expect(partItems(rig, "sunroof")).not.toMatch(/carGlass_front_2_carGlass_front_2/i);
    const ultraRoofTravel = sunroofWorldTravel(rig.sunroofNodes[0]);
    const ultraRoofSpan = new THREE.Box3()
      .setFromObject(rig.sunroofNodes[0])
      .getSize(new THREE.Vector3()).x;
    expect(ultraRoofTravel.x).toBeCloseTo(ultraRoofSpan * 0.275, 2);
    expect(ultraRoofTravel.y).toBeLessThan(0.012);
    expect(ultraRoofTravel.y).toBeGreaterThan(-0.08);
    expect(Math.abs(ultraRoofTravel.z)).toBeLessThan(0.02);
    expect(rig.frontWheels.length).toBeGreaterThanOrEqual(2);
    expect(rig.rearWheels.length).toBeGreaterThanOrEqual(2);
    expect(partItems(rig, "frontWheels")).not.toMatch(/BrakeDisc|Caliper/i);
    const tyres = [...rig.frontWheels, ...rig.rearWheels].filter((wheel) =>
      /tire|tyre/i.test(wheel.name),
    );
    expect(tyres.length).toBeGreaterThanOrEqual(4);
    for (const tyre of tyres) {
      // Hub-logo triangles used to pull the axle off the rim, so a round tyre hopped.
      expect(wheelCenterTravel(tyre)).toBeLessThan(0.004);
    }
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    for (const pivot of [rig.leftDoorPivot, rig.rightDoorPivot]) {
      const swing = leadingEdgeSwing(pivot!);
      expect(swing.lead).toBeCloseTo(0, 2);
      expect(swing.outset).toBeCloseTo(0.06, 2);
      expect(swing.swing).toBeGreaterThan(0);
      expect(swing.swing).toBeLessThan(0.05);
    }
  }, 60_000);

  it("opens YU7 front doors, hatch, and panoramic roof", async () => {
    const rig = await loadRig("2025_xiaomi_yu7.glb");
    expect(rig.capabilities).toMatchObject({
      leftDoor: true,
      rightDoor: true,
      trunk: true,
      sunroof: true,
      headLights: true,
      tailLights: true,
      wheels: true,
    });
    expect(partItems(rig, "leftDoor")).toMatch(/carPaint_4_carPaint_4/i);
    expect(partItems(rig, "rightDoor")).toMatch(/carPaint_4_1/i);
    expect(partItems(rig, "rightDoor")).not.toMatch(/carPaint_13/i);
    expect(partItems(rig, "trunk")).toMatch(/carPaint_8_carPaint_8/i);
    expect(partItems(rig, "trunk")).not.toMatch(/TrunkInternal/i);
    expect(partItems(rig, "trunk")).toMatch(/carDuckTail_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLightGlass_Back_2_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLightPlastic_BrilliantBlack_2_/i);
    expect(partItems(rig, "trunk")).toMatch(/carLight_bulb_2_/i);
    expect(partItems(rig, "trunk")).toMatch(/carXiaoMi_1_/i);
    expect(partItems(rig, "trunk")).toMatch(/carXiaoMi_3_yu7_/i);
    expect(partItems(rig, "trunk")).toMatch(/carXiaoMi_3_carXiaoMi_3/i);
    expect(partItems(rig, "trunk")).toMatch(/carGlass_back_1_carGlass_back_1/i);
    expect(partItems(rig, "trunk")).toMatch(/carHeaterStrip_/i);
    expect(partItems(rig, "trunk")).not.toMatch(/carLightGlass_Back_1_/i);
    expect(partItems(rig, "tailLights")).toMatch(/carLightGlass_Back_1_/i);
    expect(partItems(rig, "tailLights")).toMatch(/carLightGlass_Back_2_/i);
    let heaterVisible = false;
    rig.trunkPivot?.parent?.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && /carHeaterStrip_/i.test(mesh.name)) {
        heaterVisible = mesh.visible;
      }
    });
    expect(heaterVisible).toBe(true);
    const findMesh = (pattern: RegExp) => {
      let found: THREE.Mesh | null = null;
      rig.trunkPivot?.parent?.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!found && mesh.isMesh && pattern.test(mesh.name)) {
          found = mesh;
        }
      });
      return found;
    };
    const sideLens = findMesh(/carLightGlass_Back_1_/i);
    const centerLens = findMesh(/carLightGlass_Back_2_/i);
    const centerHousing = findMesh(/carLightPlastic_BrilliantBlack_2_/i);
    const rearGlass = findMesh(/carGlass_back_1_carGlass_back_1/i);
    const sideBadge = findMesh(/carXiaoMi_3_yu7_/i);
    expect(sideLens).toBeTruthy();
    expect(centerLens).toBeTruthy();
    expect(centerHousing).toBeTruthy();
    expect(rearGlass).toBeTruthy();
    expect(sideBadge).toBeTruthy();
    const sideRest = new THREE.Box3().setFromObject(sideLens!).getCenter(new THREE.Vector3());
    const centerRest = new THREE.Box3().setFromObject(centerLens!).getCenter(new THREE.Vector3());
    const housingRest = new THREE.Box3().setFromObject(centerHousing!).getCenter(new THREE.Vector3());
    const glassRest = new THREE.Box3().setFromObject(rearGlass!).getCenter(new THREE.Vector3());
    const badgeRest = new THREE.Box3().setFromObject(sideBadge!).getCenter(new THREE.Vector3());
    rig.trunkPivot!.rotation.x = 1.1;
    rig.trunkPivot!.updateWorldMatrix(true, true);
    expect(
      new THREE.Box3().setFromObject(sideLens!).getCenter(new THREE.Vector3()).distanceTo(sideRest),
    ).toBeLessThan(0.01);
    expect(
      new THREE.Box3().setFromObject(rearGlass!).getCenter(new THREE.Vector3()).distanceTo(glassRest),
    ).toBeGreaterThan(0.04);
    expect(
      new THREE.Box3().setFromObject(sideBadge!).getCenter(new THREE.Vector3()).distanceTo(badgeRest),
    ).toBeGreaterThan(0.08);
    expect(
      new THREE.Box3()
        .setFromObject(centerLens!)
        .getCenter(new THREE.Vector3())
        .distanceTo(centerRest),
    ).toBeGreaterThan(0.08);
    expect(
      new THREE.Box3()
        .setFromObject(centerHousing!)
        .getCenter(new THREE.Vector3())
        .distanceTo(housingRest),
    ).toBeGreaterThan(0.08);
    expect(partItems(rig, "sunroof")).toMatch(/carRoof_yu7/i);
    expect(partItems(rig, "sunroof")).not.toMatch(/carRoofSpoiler/i);
    const yu7RoofTravel = sunroofWorldTravel(rig.sunroofNodes[0]);
    const yu7RoofSpan = new THREE.Box3()
      .setFromObject(rig.sunroofNodes[0])
      .getSize(new THREE.Vector3()).x;
    expect(yu7RoofTravel.x).toBeCloseTo(yu7RoofSpan * 0.275, 2);
    expect(yu7RoofTravel.y).toBeLessThan(0.012);
    expect(yu7RoofTravel.y).toBeGreaterThan(-0.08);
    expect(Math.abs(yu7RoofTravel.z)).toBeLessThan(0.02);
    expect(rig.frontWheels.length).toBeGreaterThanOrEqual(2);
    expect(rig.rearWheels.length).toBeGreaterThanOrEqual(2);
    expect(partItems(rig, "frontWheels")).not.toMatch(/BrakeDisc|Caliper/i);
    expect(partItems(rig, "headLights")).not.toMatch(/carLight_bulb_3/i);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    for (const pivot of [rig.leftDoorPivot, rig.rightDoorPivot]) {
      const swing = leadingEdgeSwing(pivot!);
      expect(swing.lead).toBeCloseTo(0, 2);
      expect(swing.outset).toBeCloseTo(0.06, 2);
      expect(swing.swing).toBeGreaterThan(0);
      expect(swing.swing).toBeLessThan(0.05);
    }
  }, 60_000);
});
