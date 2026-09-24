import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// draco3dgltf ships without type declarations.
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyWheelMotion, discoverAssetCarRig } from "@/lib/asset-car-rig";
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
    if (meshes.length === 1) {
      object = meshes[0];
    } else {
      object = new THREE.Group();
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

describe("suv-mainstream wheels", () => {
  it("rolls each Q3 corner in place when the rig is discovered", async () => {
    const filePath = path.join(process.cwd(), "public/models/market/suv-mainstream.glb");
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
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
    const rig = discoverAssetCarRig(root, "models/market/suv-mainstream.glb");
    const wheels = [...rig.frontWheels, ...rig.rearWheels];

    expect(rig.capabilities.wheels).toBe(true);
    expect(wheels.length).toBeGreaterThanOrEqual(16);
    expect(wheels.some((node) => /Break/i.test(node.name))).toBe(false);

    const corners = ["FL", "FR", "RL", "RR"];
    for (const corner of corners) {
      expect(
        wheels.some((node) => /Tyre_Nor/i.test(node.name) && node.name.endsWith(`_${corner}`)),
      ).toBe(true);
    }

    root.updateWorldMatrix(true, true);
    const tyre = wheels.find(
      (node) => /Tyre_Nor/i.test(node.name) && node.name.endsWith("_FL"),
    ) as THREE.Mesh;
    const centerBefore = new THREE.Box3().setFromObject(tyre).getCenter(new THREE.Vector3());
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

    applyWheelMotion(tyre, 0.45, 0);
    tyre.updateWorldMatrix(true, false);

    const centerAfter = new THREE.Box3().setFromObject(tyre).getCenter(new THREE.Vector3());
    const topAfter = new THREE.Vector3()
      .fromBufferAttribute(position, topIndex)
      .applyMatrix4(tyre.matrixWorld);

    expect(centerAfter.distanceTo(centerBefore)).toBeLessThan(0.04);
    expect(topAfter.distanceTo(topBefore)).toBeGreaterThan(0.04);
    // Axle is lateral (Z). Rolling moves the tread in X, not sideways.
    const travel = topAfter.clone().sub(topBefore);
    expect(Math.abs(travel.x)).toBeGreaterThan(Math.abs(travel.z));

    const rim = wheels.find(
      (node) => /Q3_Tyre2/i.test(node.name) && node.name.endsWith("_FL"),
    ) as THREE.Mesh;
    expect(rim).toBeDefined();
    applyWheelMotion(tyre, 0, 0);
    applyWheelMotion(rim, 0, 0);
    tyre.updateWorldMatrix(true, false);
    rim.updateWorldMatrix(true, false);
    const gapBefore = new THREE.Box3()
      .setFromObject(rim)
      .getCenter(new THREE.Vector3())
      .distanceTo(new THREE.Box3().setFromObject(tyre).getCenter(new THREE.Vector3()));
    applyWheelMotion(tyre, 1.1, 0.25);
    applyWheelMotion(rim, 1.1, 0.25);
    tyre.updateWorldMatrix(true, false);
    rim.updateWorldMatrix(true, false);
    const gapAfter = new THREE.Box3()
      .setFromObject(rim)
      .getCenter(new THREE.Vector3())
      .distanceTo(new THREE.Box3().setFromObject(tyre).getCenter(new THREE.Vector3()));
    expect(Math.abs(gapAfter - gapBefore)).toBeLessThan(0.02);

    const calipers: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (/Alloy_Break/i.test(node.name) && (node as THREE.Mesh).isMesh) {
        calipers.push(node);
      }
    });
    expect(calipers.length).toBeGreaterThan(0);
    const caliperBefore = new THREE.Box3().setFromObject(calipers[0]).getCenter(new THREE.Vector3());
    for (const wheel of wheels) {
      applyWheelMotion(wheel, 1.2, 0);
    }
    root.updateWorldMatrix(true, true);
    const caliperAfter = new THREE.Box3().setFromObject(calipers[0]).getCenter(new THREE.Vector3());
    expect(caliperAfter.distanceTo(caliperBefore)).toBeLessThan(0.001);
  });
});
