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
  ASSET_DOOR_MAX_OPEN_RADIANS,
  ASSET_TRUNK_MAX_OPEN_RADIANS,
  discoverAssetCarRig,
} from "@/lib/asset-car-rig";
import { normalizeMarketModel } from "@/lib/normalize-market-model";

function toThreeNode(gltfNode: GltfNode): THREE.Object3D {
  const translation = gltfNode.getTranslation();
  const rotation = gltfNode.getRotation();
  const scale = gltfNode.getScale();
  const mesh = gltfNode.getMesh();
  let object: THREE.Object3D;

  if (mesh) {
    const primitives = mesh.listPrimitives();
    const meshes = primitives.map((primitive) => {
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
    if (meshes.length !== 1) {
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

function shellsOf(pivot: THREE.Object3D | null) {
  const shells: THREE.Mesh[] = [];
  pivot?.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.showroomDoorShell) {
      shells.push(mesh);
    }
  });
  return shells;
}

function centerOf(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

describe("offroad-mainstream cabin panels", () => {
  it("swings both side doors and the barn-door tailgate, and leaves the roof shut", async () => {
    const filePath = path.join(process.cwd(), "public/models/market/offroad-mainstream.glb");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const document = await io.read(filePath);
    const scene = document.getRoot().listScenes()[0];
    const root = new THREE.Group();
    root.name = scene.getName();
    for (const child of scene.listChildren()) {
      root.add(toThreeNode(child));
    }

    normalizeMarketModel(root);
    const rig = discoverAssetCarRig(root, "models/market/offroad-mainstream.glb");

    expect(rig.capabilities).toMatchObject({
      leftDoor: true,
      rightDoor: true,
      trunk: true,
      sunroof: false,
      headLights: true,
      tailLights: true,
      wheels: true,
    });
    expect(rig.hazardMaterials.length).toBeGreaterThan(0);
    expect(rig.companionDoorPivots).toHaveLength(2);
    expect(rig.companionDoorPivots.map((pivot) => pivot.userData.showroomSide).sort()).toEqual([
      "left",
      "right",
    ]);

    const leftRear = rig.companionDoorPivots.find((pivot) => pivot.userData.showroomSide === "left");
    const frontShells = shellsOf(rig.leftDoorPivot);
    const rearShells = shellsOf(leftRear ?? null);
    expect(frontShells.length).toBeGreaterThan(0);
    expect(rearShells.length).toBeGreaterThan(0);
    expect(rearShells.every((shell) => !under(shell, rig.leftDoorPivot))).toBe(true);

    const frontBox = new THREE.Box3();
    for (const shell of frontShells) {
      frontBox.expandByObject(shell);
    }
    const hinge = new THREE.Vector3();
    rig.leftDoorPivot!.getWorldPosition(hinge);
    expect(hinge.x).toBeGreaterThan(frontBox.min.x - 0.01);
    expect(hinge.x).toBeLessThan(frontBox.min.x + 0.08);

    const frontBefore = frontBox.getCenter(new THREE.Vector3());
    const rearBefore = centerOf(rearShells[0]);
    const openSign = rig.leftDoorPivot!.userData.showroomOpenSign as number;
    rig.leftDoorPivot!.rotation.y = openSign * ASSET_DOOR_MAX_OPEN_RADIANS;
    rig.leftDoorPivot!.updateWorldMatrix(true, true);
    const frontAfter = new THREE.Box3();
    for (const shell of frontShells) {
      frontAfter.expandByObject(shell);
    }
    expect(frontAfter.getCenter(new THREE.Vector3()).z).toBeGreaterThan(frontBefore.z + 0.2);
    expect(centerOf(rearShells[0]).z).toBeCloseTo(rearBefore.z, 2);

    let spare: THREE.Object3D | null = null;
    rig.trunkPivot?.traverse((node) => {
      if (!spare && /sparewheel/i.test(node.name)) {
        spare = node;
      }
    });
    expect(spare).not.toBeNull();
    const spareBefore = centerOf(spare!);
    const trunkSign = rig.trunkPivot!.userData.showroomOpenSign as number;
    expect(rig.trunkPivot!.userData.showroomHingeAxis).toBe("y");
    rig.trunkPivot!.rotation.y = trunkSign * ASSET_TRUNK_MAX_OPEN_RADIANS;
    rig.trunkPivot!.updateWorldMatrix(true, true);
    expect(centerOf(spare!).x).toBeGreaterThan(spareBefore.x + 0.15);

    let roofOnBody = false;
    let noseOnBody = false;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !/bodypaint/i.test(mesh.name)) {
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
      if (box.max.y > 1.35 && size.x > 0.8) {
        roofOnBody = true;
      }
      if (box.min.x < -1.7) {
        noseOnBody = true;
      }
    });
    expect(roofOnBody).toBe(true);
    expect(noseOnBody).toBe(true);
    expect(rig.sunroofNodes).toHaveLength(0);
    expect([...rig.frontWheels, ...rig.rearWheels].some((wheel) => /spare/i.test(wheel.name))).toBe(
      false,
    );
  }, 60_000);
});
