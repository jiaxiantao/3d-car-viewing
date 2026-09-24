import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { discoverAssetCarRig } from "@/lib/asset-car-rig";
import { normalizeMarketModel } from "@/lib/normalize-market-model";

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
      return new THREE.Mesh(geometry);
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

function underPivot(object: THREE.Object3D, pivot: THREE.Object3D | null) {
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

describe("Audi Q3 front doors", () => {
  it("swings the shared belt line, icons, and aluminum card with the door", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const document = await io.read(
      path.join(process.cwd(), "public/models/market/suv-mainstream.glb"),
    );
    const scene = document.getRoot().listScenes()[0];
    const root = new THREE.Group();
    for (const child of scene.listChildren()) {
      root.add(toThreeNode(child));
    }
    normalizeMarketModel(root);
    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    const right = rig.rightDoorPivot;
    const left = rig.leftDoorPivot;
    expect(right).not.toBeNull();
    expect(left).not.toBeNull();

    const patterns = [/phong1SG1/i, /Dooricon_Mesh_138/i, /Interior86_Mesh_210/i];
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && patterns.some((pattern) => pattern.test(mesh.name))) {
        meshes.push(mesh);
      }
    });

    for (const pattern of patterns) {
      const onRight = meshes.filter((mesh) => pattern.test(mesh.name) && underPivot(mesh, right));
      const onLeft = meshes.filter((mesh) => pattern.test(mesh.name) && underPivot(mesh, left));
      const stayed = meshes.filter(
        (mesh) => pattern.test(mesh.name) && !underPivot(mesh, right) && !underPivot(mesh, left),
      );
      expect(onRight.length, pattern.source).toBeGreaterThan(0);
      expect(onLeft.length, pattern.source).toBeGreaterThan(0);
      expect(stayed.length, pattern.source).toBeGreaterThan(0);

      const rightBefore = centerOf(onRight[0]);
      const leftBefore = centerOf(onLeft[0]);
      const stayBefore = centerOf(stayed[0]);
      right!.rotation.y = (right!.userData.showroomOpenSign as number) * 0.9;
      root.updateWorldMatrix(true, true);

      expect(centerOf(onRight[0]).distanceTo(rightBefore)).toBeGreaterThan(0.04);
      expect(centerOf(onLeft[0]).distanceTo(leftBefore)).toBeLessThan(0.001);
      expect(centerOf(stayed[0]).distanceTo(stayBefore)).toBeLessThan(0.001);
      right!.rotation.y = 0;
      root.updateWorldMatrix(true, true);
    }

    const studs: THREE.Mesh[] = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && /Thrmoline1/i.test(mesh.name)) {
        studs.push(mesh);
      }
    });
    const studsRight = studs.filter((mesh) => underPivot(mesh, right));
    const studsLeft = studs.filter((mesh) => underPivot(mesh, left));
    const studsBody = studs.filter((mesh) => !underPivot(mesh, right) && !underPivot(mesh, left));
    expect(studsRight.length).toBeGreaterThan(0);
    expect(studsLeft.length).toBeGreaterThan(0);
    expect(studsBody.length).toBe(0);
    const studBefore = centerOf(studsRight[0]);
    const leftStudBefore = centerOf(studsLeft[0]);
    right!.rotation.y = (right!.userData.showroomOpenSign as number) * 0.9;
    root.updateWorldMatrix(true, true);
    expect(centerOf(studsRight[0]).distanceTo(studBefore)).toBeGreaterThan(0.04);
    expect(centerOf(studsLeft[0]).distanceTo(leftStudBefore)).toBeLessThan(0.001);
    expect(studBefore.z).toBeLessThan(-0.6);
    expect(leftStudBefore.z).toBeGreaterThan(0.6);
  }, 120000);
});
