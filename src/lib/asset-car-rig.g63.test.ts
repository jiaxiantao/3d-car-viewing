import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// draco3dgltf ships without type declarations.
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  applyWheelMotion,
  ASSET_TRUNK_MAX_OPEN_RADIANS,
  discoverAssetCarRig,
} from "@/lib/asset-car-rig";
import { normalizeMarketModel } from "@/lib/normalize-market-model";
import { getOrbitDistanceLimits, resolveShowroomCameraPose } from "@/lib/showroom-camera";

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

  object.name = gltfNode.getName();
  object.position.set(translation[0], translation[1], translation[2]);
  object.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
  object.scale.set(scale[0], scale[1], scale[2]);
  for (const child of gltfNode.listChildren()) {
    object.add(toThreeNode(child));
  }
  return object;
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

function meshMaterialName(mesh: THREE.Mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material?.name ?? "";
}

function centerOf(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

describe("mercedes-benz g63", () => {
  it("opens cabin panels, rolls four wheels, frames the wheel, and recolors body paint", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const document = await io.read(
      path.join(process.cwd(), "public/models/market/mercedes-benz_g63_amg.glb"),
    );
    const scene = document.getRoot().listScenes()[0];
    const root = new THREE.Group();
    for (const child of scene.listChildren()) {
      root.add(toThreeNode(child));
    }

    normalizeMarketModel(root);
    const rig = discoverAssetCarRig(root, "models/market/mercedes-benz_g63_amg.glb");

    expect(rig.debug.profileId).toBe("mercedes-g63");
    expect(rig.capabilities).toMatchObject({
      leftDoor: false,
      rightDoor: false,
      trunk: true,
      sunroof: false,
      headLights: true,
      tailLights: true,
      wheels: true,
      wheelsSynthetic: false,
    });
    expect(rig.hazardMaterials.length).toBeGreaterThan(0);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
    expect(rig.paintMaterials.every((material) => /bodypaint/i.test(material.name))).toBe(true);
    expect(rig.leftDoorPivot).toBeNull();
    expect(rig.rightDoorPivot).toBeNull();
    expect(rig.companionDoorPivots).toHaveLength(0);

    const trunkSize = new THREE.Box3().setFromObject(rig.trunkPivot!).getSize(new THREE.Vector3());
    expect(trunkSize.x).toBeLessThan(0.55);
    expect(trunkSize.z).toBeGreaterThan(0.5);

    let cabinStayed = false;
    let bodyShellStayed = false;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      expect(mesh.name).not.toMatch(/_(FL|FR|RL|RR|tail)(_shell)?$/);
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const onSideDoor =
        under(mesh, rig.leftDoorPivot) ||
        under(mesh, rig.rightDoorPivot) ||
        rig.companionDoorPivots.some((pivot) => under(mesh, pivot));
      const onPanel = onSideDoor || under(mesh, rig.trunkPivot);
      if (onSideDoor) {
        expect(size.z).toBeLessThan(0.7);
        expect(size.x).toBeLessThan(1.25);
      }
      if (!onPanel && size.x > 2.4 && /bodypaint/i.test(meshMaterialName(mesh))) {
        bodyShellStayed = true;
      }
      if (onPanel) {
        return;
      }
      if (size.z > 1 && size.x > 1.2 && center.y > 0.4 && center.y < 1.3) {
        cabinStayed = true;
      }
    });
    expect(cabinStayed).toBe(true);
    expect(bodyShellStayed).toBe(true);

    let spare: THREE.Mesh | null = null;
    rig.trunkPivot?.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
      const disc = size.y > 0.45 && size.z > 0.45 && Math.abs(size.y - size.z) < 0.2 && size.x < 0.35;
      if (!disc) {
        return;
      }
      if (!spare || centerOf(mesh).x > centerOf(spare).x) {
        spare = mesh;
      }
    });
    expect(spare).not.toBeNull();
    const spareBefore = centerOf(spare!);
    expect(rig.trunkPivot!.userData.showroomHingeAxis).toBe("y");
    const trunkSign = rig.trunkPivot!.userData.showroomOpenSign as number;
    rig.trunkPivot!.rotation.y = trunkSign * ASSET_TRUNK_MAX_OPEN_RADIANS;
    rig.trunkPivot!.updateWorldMatrix(true, true);
    expect(centerOf(spare!).x).toBeGreaterThan(spareBefore.x + 0.12);

    let roofOnBody = false;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !/bodypaint/i.test(mesh.material.name)) {
        return;
      }
      const onPanel =
        under(mesh, rig.leftDoorPivot) ||
        under(mesh, rig.rightDoorPivot) ||
        under(mesh, rig.trunkPivot) ||
        rig.companionDoorPivots.some((pivot) => under(mesh, pivot));
      if (onPanel) {
        return;
      }
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      if (box.max.y > 1.2 && size.x > 0.6) {
        roofOnBody = true;
      }
    });
    expect(roofOnBody).toBe(true);
    expect(rig.sunroofNodes).toHaveLength(0);

    const wheels = [...rig.frontWheels, ...rig.rearWheels];
    expect(rig.frontWheels.length).toBeGreaterThan(0);
    expect(rig.rearWheels.length).toBeGreaterThan(0);
    expect(wheels.some((node) => /spare/i.test(node.name))).toBe(false);
    const carCenter = rig.bounds.getCenter(new THREE.Vector3());
    const corners = new Set(
      wheels.map((wheel) => {
        const center = centerOf(wheel);
        return `${center.x < carCenter.x ? "F" : "R"}${center.z > carCenter.z ? "L" : "R"}`;
      }),
    );
    expect(corners).toEqual(new Set(["FL", "FR", "RL", "RR"]));
    const wheelLabel = (node: THREE.Object3D) => `${node.parent?.name ?? ""}/${node.name}`;
    expect(wheels.some((node) => /\btire\b/i.test(wheelLabel(node)))).toBe(true);
    expect(wheels.some((node) => /monoblock/i.test(wheelLabel(node)))).toBe(true);
    expect(wheels.some((node) => /right_wheel|_gt_34_|_gt_35_/i.test(wheelLabel(node)))).toBe(false);

    const tyre = wheels.find((node) => /\btire\b/i.test(wheelLabel(node))) as THREE.Mesh;
    const centerBefore = centerOf(tyre);
    const position = tyre.geometry.getAttribute("position");
    let topIndex = 0;
    let topY = -Infinity;
    const sample = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 8) {
      sample.fromBufferAttribute(position, index).applyMatrix4(tyre.matrixWorld);
      if (sample.y > topY) {
        topY = sample.y;
        topIndex = index;
      }
    }
    const topBefore = new THREE.Vector3()
      .fromBufferAttribute(position, topIndex)
      .applyMatrix4(tyre.matrixWorld);
    applyWheelMotion(tyre, 0.7, 0);
    tyre.updateWorldMatrix(true, false);
    const topAfter = new THREE.Vector3()
      .fromBufferAttribute(position, topIndex)
      .applyMatrix4(tyre.matrixWorld);
    expect(centerOf(tyre).distanceTo(centerBefore)).toBeLessThan(0.04);
    expect(topAfter.distanceTo(topBefore)).toBeGreaterThan(0.03);
    const travel = topAfter.clone().sub(topBefore);
    expect(Math.abs(travel.x)).toBeGreaterThan(Math.abs(travel.z));

    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.y).toBeGreaterThan(0.45);
    const pose = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    const limits = getOrbitDistanceLimits(rig.bounds, "cockpit");
    expect(pose.target.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.2);
    expect(pose.position.x).toBeGreaterThan(pose.target.x);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(pose.position.distanceTo(pose.target)).toBeGreaterThan(limits.minDistance);
  }, 180_000);
});
