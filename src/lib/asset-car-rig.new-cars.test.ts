import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  applyWheelMotion,
  ASSET_DOOR_MAX_OPEN_RADIANS,
  ASSET_TRUNK_MAX_OPEN_RADIANS,
  discoverAssetCarRig,
} from "@/lib/asset-car-rig";
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
  return { root, rig: discoverAssetCarRig(root, `models/market/${fileName}`) };
}

function under(object: THREE.Object3D, pivot: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === pivot) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function centerOf(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function namedUnder(pivot: THREE.Object3D | null, pattern: RegExp) {
  const found: THREE.Object3D[] = [];
  pivot?.traverse((node) => {
    if (node !== pivot && pattern.test(node.name)) {
      found.push(node);
    }
  });
  return found;
}

describe("mercedes g63 and jeep wrangler rigs", () => {
  it("opens G63 front doors, paints the body, and rolls each corner", async () => {
    const { root, rig } = await loadRig("2025_mercedes-benz_g-class_amg_g_63.glb");
    expect(rig.leftDoorPivot).toBeTruthy();
    expect(rig.rightDoorPivot).toBeTruthy();
    expect(rig.companionDoorPivots).toHaveLength(0);
    expect(rig.trunkPivot).toBeNull();
    expect(rig.sunroofNodes).toHaveLength(0);
    expect(rig.headLightMaterials.length).toBeGreaterThan(0);
    expect(rig.tailLightMaterials.length).toBeGreaterThan(0);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    expect(rig.debug.parts.find((part) => part.key === "paint")?.items.join(" ")).toMatch(
      /CarPaint_010/,
    );
    expect(rig.debug.parts.find((part) => part.key === "paint")?.items.join(" ")).not.toMatch(
      /Glass1|Lights1/,
    );
    expect(rig.frontWheels).toHaveLength(2);
    expect(rig.rearWheels).toHaveLength(2);
    expect(rig.frontWheels.map((node) => node.name).join(" ")).toMatch(/3DWheel_Front/);
    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.z).toBeGreaterThan(0.1);

    let hood: THREE.Object3D | null = null;
    let rearBody: THREE.Object3D | null = null;
    let leftSill: THREE.Object3D | null = null;
    let leftWindowLight: THREE.Object3D | null = null;
    let rightSill: THREE.Object3D | null = null;
    let steering: THREE.Object3D | null = null;
    let dashBridge: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!hood && /SM_Hood_/i.test(node.name)) {
        hood = node;
      }
      if (!rearBody && /SM_RearKit_/i.test(node.name) && /CarPaint_010/i.test(node.name)) {
        rearBody = node;
      }
      if (!leftSill && /MD_Body_15_/i.test(node.name)) {
        leftSill = node;
      }
      if (!leftWindowLight && /SM_Base_.*Lights1/i.test(node.name)) {
        leftWindowLight = node;
      }
      if (!rightSill && /MD_Body_14_/i.test(node.name)) {
        rightSill = node;
      }
      if (!steering && /MANC_SteeringWheel_00/i.test(node.name)) {
        steering = node;
      }
      if (!dashBridge && /MD_Body_32_/i.test(node.name)) {
        dashBridge = node;
      }
    });
    expect(hood).toBeTruthy();
    expect(rearBody).toBeTruthy();
    expect(leftSill).toBeTruthy();
    expect(leftWindowLight).toBeTruthy();
    expect(rightSill).toBeTruthy();
    expect(steering).toBeTruthy();
    expect(under(leftSill!, rig.leftDoorPivot)).toBe(true);
    expect(under(leftWindowLight!, rig.leftDoorPivot)).toBe(true);
    expect(under(rightSill!, rig.rightDoorPivot)).toBe(true);
    expect(under(hood!, rig.leftDoorPivot)).toBe(false);
    expect(under(rearBody!, rig.leftDoorPivot)).toBe(false);
    expect(under(rearBody!, rig.rightDoorPivot)).toBe(false);
    expect(under(steering!, rig.leftDoorPivot)).toBe(false);
    expect(dashBridge).toBeTruthy();
    expect(under(dashBridge!, rig.leftDoorPivot)).toBe(false);
    expect(under(dashBridge!, rig.rightDoorPivot)).toBe(false);

    const leftCarbon = namedUnder(rig.leftDoorPivot, /^carbon/i);
    const rightCarbon = namedUnder(rig.rightDoorPivot, /^carbon/i);
    const leftHandlePanel = namedUnder(rig.leftDoorPivot, /MD_Body_02_/i);
    const rightHandlePanel = namedUnder(rig.rightDoorPivot, /MD_Body_01_/i);
    expect(leftCarbon.length).toBeGreaterThanOrEqual(3);
    expect(rightCarbon.length).toBeGreaterThanOrEqual(3);
    expect(leftHandlePanel).toHaveLength(1);
    expect(rightHandlePanel).toHaveLength(1);

    // Carbon cover under the interior handle: ~0.25 long, flat against the card.
    const isHandleCover = (piece: THREE.Object3D) => {
      const size = new THREE.Box3().setFromObject(piece).getSize(new THREE.Vector3());
      return size.x > 0.2 && size.x < 0.35 && size.y < 0.12 && size.z < 0.06;
    };
    const leftCover = leftCarbon.filter(isHandleCover);
    const rightCover = rightCarbon.filter(isHandleCover);
    expect(leftCover).toHaveLength(1);
    expect(rightCover).toHaveLength(1);
    expect(centerOf(leftCover[0]).x).toBeCloseTo(-0.13, 1);
    expect(centerOf(leftCover[0]).y).toBeCloseTo(0.6, 1);
    for (const node of [/MD_Body_20_/i, /MD_Body_30_/i, /MD_Body_33_/i, /MD_Body_36_/i, /MD_Body_38_/i]) {
      expect(namedUnder(rig.leftDoorPivot, node)).toHaveLength(0);
      expect(namedUnder(rig.rightDoorPivot, node)).toHaveLength(0);
    }

    const doorBefore = centerOf(rig.leftDoorPivot!);
    const hoodBefore = centerOf(hood!);
    const sillBefore = centerOf(leftSill!);
    const lightBefore = centerOf(leftWindowLight!);
    const steeringBefore = centerOf(steering!);
    const dashBefore = centerOf(dashBridge!);
    const carbonBefore = leftCarbon.map((piece) => centerOf(piece));
    const handleBefore = centerOf(leftHandlePanel[0]);
    const openSign = rig.leftDoorPivot!.userData.showroomOpenSign as number;
    rig.leftDoorPivot!.rotation.y = openSign * ASSET_DOOR_MAX_OPEN_RADIANS;
    rig.leftDoorPivot!.updateWorldMatrix(true, true);
    expect(centerOf(rig.leftDoorPivot!).z).toBeGreaterThan(doorBefore.z + 0.15);
    expect(centerOf(leftSill!).z).toBeGreaterThan(sillBefore.z + 0.05);
    expect(centerOf(leftWindowLight!).z).toBeGreaterThan(lightBefore.z + 0.05);
    for (const [index, piece] of leftCarbon.entries()) {
      expect(centerOf(piece).z).toBeGreaterThan(carbonBefore[index].z + 0.05);
    }
    expect(centerOf(leftHandlePanel[0]).z).toBeGreaterThan(handleBefore.z + 0.05);
    expect(centerOf(hood!).distanceTo(hoodBefore)).toBeLessThan(0.02);
    expect(centerOf(steering!).distanceTo(steeringBefore)).toBeLessThan(0.02);
    expect(centerOf(dashBridge!).distanceTo(dashBefore)).toBeLessThan(0.02);

    const wheel = rig.frontWheels[0];
    const wheelBefore = centerOf(wheel);
    const spinBefore = wheel.quaternion.clone();
    applyWheelMotion(wheel, 0.6, 0.2);
    expect(wheel.quaternion.angleTo(spinBefore)).toBeGreaterThan(0.05);
    expect(centerOf(wheel).distanceTo(wheelBefore)).toBeLessThan(0.08);

    const front = resolveShowroomCameraPose("front", rig.bounds, rig.steeringWheelCenter);
    const left = resolveShowroomCameraPose("side-left", rig.bounds, rig.steeringWheelCenter);
    const rear = resolveShowroomCameraPose("rear", rig.bounds, rig.steeringWheelCenter);
    const cockpit = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    expect(front.position.x).toBeLessThan(rig.bounds.min.x);
    expect(left.position.z).toBeGreaterThan(rig.bounds.max.z);
    expect(rear.position.x).toBeGreaterThan(rig.bounds.max.x);
    expect(cockpit.position.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.8);
    expect(cockpit.position.x).toBeGreaterThan(rig.steeringWheelCenter!.x);
  }, 30_000);

  it("opens Jeep doors and the barn tailgate, and keeps the hardtop still", async () => {
    const { root, rig } = await loadRig("2023_jeep_wrangler_rubicon_392_20th_anniversary.glb");
    expect(rig.leftDoorPivot).toBeTruthy();
    expect(rig.rightDoorPivot).toBeTruthy();
    expect(rig.companionDoorPivots).toHaveLength(2);
    expect(rig.trunkPivot).toBeTruthy();
    expect(rig.trunkPivot!.userData.showroomHingeAxis).toBe("y");
    expect(rig.sunroofNodes).toHaveLength(0);
    expect(rig.headLightMaterials.length).toBeGreaterThan(0);
    expect(rig.tailLightMaterials.length).toBeGreaterThan(0);
    expect(rig.hazardMaterials.length).toBeGreaterThan(0);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    const paintItems = rig.debug.parts.find((part) => part.key === "paint")?.items.join(" ") ?? "";
    expect(paintItems).toMatch(/1355060001_004/);
    expect(paintItems).not.toMatch(/Exhaust1|red_glass|Light_010/);
    expect(rig.frontWheels).toHaveLength(2);
    expect(rig.rearWheels).toHaveLength(2);
    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.z).toBeGreaterThan(0.1);

    let fender: THREE.Object3D | null = null;
    let spare: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!fender && /SM_Fender_F_/i.test(node.name)) {
        fender = node;
      }
      if (!spare && under(node, rig.trunkPivot) && /Plastic1/i.test(node.name)) {
        spare = node;
      }
    });
    expect(fender).toBeTruthy();
    expect(spare).toBeTruthy();
    expect(under(fender!, rig.leftDoorPivot)).toBe(false);
    expect(rig.companionDoorPivots.some((pivot) => under(fender!, pivot))).toBe(false);

    const sillPieces: THREE.Object3D[] = [];
    root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh && /Glass_In_021/i.test(node.name)) {
        sillPieces.push(node);
      }
    });
    const onPivot = (pivot: THREE.Object3D | null) =>
      sillPieces.filter((piece) => under(piece, pivot));
    const leftFrontSill = onPivot(rig.leftDoorPivot);
    const rightFrontSill = onPivot(rig.rightDoorPivot);
    const leftRearDoor = rig.companionDoorPivots.find((pivot) => pivot.userData.showroomSide === "left");
    const rightRearDoor = rig.companionDoorPivots.find((pivot) => pivot.userData.showroomSide === "right");
    const leftRearSill = onPivot(leftRearDoor ?? null);
    const rightRearSill = onPivot(rightRearDoor ?? null);
    const bodySill = sillPieces.filter(
      (piece) =>
        !under(piece, rig.leftDoorPivot) &&
        !under(piece, rig.rightDoorPivot) &&
        !rig.companionDoorPivots.some((pivot) => under(piece, pivot)),
    );
    expect(leftFrontSill.length).toBeGreaterThan(0);
    expect(rightFrontSill.length).toBeGreaterThan(0);
    expect(leftRearSill.length).toBeGreaterThan(0);
    expect(rightRearSill.length).toBeGreaterThan(0);
    expect(bodySill.length).toBeGreaterThan(0);

    const leftHinge = new THREE.Vector3();
    rig.leftDoorPivot!.getWorldPosition(leftHinge);
    const leftDoorBox = new THREE.Box3().setFromObject(rig.leftDoorPivot!);
    expect(leftDoorBox.max.z - leftHinge.z).toBeGreaterThan(0.14);
    expect(leftHinge.z).toBeGreaterThan(leftDoorBox.min.z + 0.05);

    const frontBefore = centerOf(rig.leftDoorPivot!);
    const sillBefore = centerOf(leftFrontSill[0]);
    const bodySillBefore = centerOf(bodySill[0]);
    const rearDoor = rig.companionDoorPivots.find((pivot) => pivot.userData.showroomSide === "left");
    expect(rearDoor).toBeTruthy();
    const rearBefore = centerOf(rearDoor!);
    const fenderBefore = centerOf(fender!);
    rig.leftDoorPivot!.rotation.y =
      (rig.leftDoorPivot!.userData.showroomOpenSign as number) * ASSET_DOOR_MAX_OPEN_RADIANS;
    rearDoor!.rotation.y = (rearDoor!.userData.showroomOpenSign as number) * ASSET_DOOR_MAX_OPEN_RADIANS;
    rig.leftDoorPivot!.updateWorldMatrix(true, true);
    rearDoor!.updateWorldMatrix(true, true);
    expect(centerOf(rig.leftDoorPivot!).z).toBeGreaterThan(frontBefore.z + 0.12);
    expect(centerOf(rearDoor!).z).toBeGreaterThan(rearBefore.z + 0.12);
    expect(centerOf(leftFrontSill[0]).z).toBeGreaterThan(sillBefore.z + 0.05);
    expect(centerOf(bodySill[0]).distanceTo(bodySillBefore)).toBeLessThan(0.02);
    expect(centerOf(fender!).distanceTo(fenderBefore)).toBeLessThan(0.02);

    const trunkHinge = new THREE.Vector3();
    rig.trunkPivot!.getWorldPosition(trunkHinge);
    const trunkBox = new THREE.Box3().setFromObject(rig.trunkPivot!);
    expect(rig.trunkPivot!.userData.showroomOpenSign).toBe(1);
    expect(trunkHinge.z - trunkBox.min.z).toBeGreaterThan(0.12);
    expect(trunkHinge.z - trunkBox.min.z).toBeLessThan(0.18);
    expect(Math.abs(trunkHinge.z - trunkBox.min.z)).toBeLessThan(Math.abs(trunkHinge.z - trunkBox.max.z));
    expect(Math.abs(trunkHinge.x - trunkBox.min.x)).toBeLessThan(0.08);
    expect(trunkBox.max.x - trunkHinge.x).toBeGreaterThan(0.2);
    let rearBumper: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!rearBumper && /Bumper_B_/i.test(node.name) && (node as THREE.Mesh).isMesh) {
        rearBumper = node;
      }
    });
    expect(rearBumper).toBeTruthy();
    const bumperBox = new THREE.Box3().setFromObject(rearBumper!);
    expect(Math.abs(trunkHinge.x - bumperBox.max.x)).toBeLessThan(0.2);

    const spareBefore = centerOf(spare!);
    rig.trunkPivot!.rotation.y =
      (rig.trunkPivot!.userData.showroomOpenSign as number) * ASSET_TRUNK_MAX_OPEN_RADIANS;
    rig.trunkPivot!.updateWorldMatrix(true, true);
    const spareAfter = centerOf(spare!);
    expect(spareAfter.x).toBeGreaterThan(spareBefore.x + 0.12);
    expect(spareAfter.z).toBeLessThan(spareBefore.z);

    const wheel = rig.frontWheels[0];
    let caliper: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!caliper && /Caliper_BL/i.test(node.name)) {
        caliper = node;
      }
    });
    expect(caliper).toBeTruthy();
    expect(under(caliper!, wheel)).toBe(false);
    const caliperBefore = centerOf(caliper!);
    const wheelBefore = centerOf(wheel);
    applyWheelMotion(wheel, 0.7, 0);
    expect(centerOf(wheel).distanceTo(wheelBefore)).toBeLessThan(0.08);
    expect(centerOf(caliper!).distanceTo(caliperBefore)).toBeLessThan(0.02);

    const cockpit = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    const sideRight = resolveShowroomCameraPose("side-right", rig.bounds, rig.steeringWheelCenter);
    expect(cockpit.position.x).toBeGreaterThan(rig.steeringWheelCenter!.x);
    expect(cockpit.position.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.8);
    expect(sideRight.position.z).toBeLessThan(rig.bounds.min.z);
  }, 30_000);
});
