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

describe("Audi Q3 cockpit", () => {
  it("looks at the steering wheel from the driver's seat", async () => {
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

    expect(rig.steeringWheelCenter).not.toBeNull();
    expect(rig.steeringWheelCenter!.z).toBeLessThan(-0.2);
    expect(rig.steeringWheelCenter!.y).toBeGreaterThan(0.5);

    const pose = resolveShowroomCameraPose("cockpit", rig.bounds, rig.steeringWheelCenter);
    const distance = pose.position.distanceTo(pose.target);
    const limits = getOrbitDistanceLimits(rig.bounds, "cockpit");
    expect(pose.target.y).toBeGreaterThan(rig.steeringWheelCenter!.y);
    expect(pose.target.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.2);
    expect(pose.position.x).toBeGreaterThan(pose.target.x);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(Math.abs(pose.position.z - pose.target.z)).toBeLessThan(0.12);
    expect(distance).toBeGreaterThan(limits.minDistance);
    expect(distance).toBeLessThan(0.6);
    expect(pose.position.x).toBeLessThan(0.2);

    const offset = pose.position.clone().sub(pose.target);
    const polar = Math.acos(offset.y / offset.length());
    expect(polar).toBeGreaterThan(0.6);
    expect(polar).toBeLessThan(1.5);
  });
});
