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

describe("YU7 and M2 cockpit seats", () => {
  const yu7Bounds = new THREE.Box3(
    new THREE.Vector3(-2, -0.22, -0.855),
    new THREE.Vector3(2, 1.053, 0.855),
  );
  const yu7Wheel = new THREE.Vector3(-0.361, 0.546, 0.312);
  const m2Bounds = new THREE.Box3(
    new THREE.Vector3(-1.963, -0.22, -0.909),
    new THREE.Vector3(2.037, 1.022, 0.909),
  );

  it("sits the YU7 eye just above the rim, below the roof", () => {
    const shared = resolveShowroomCameraPose("cockpit", yu7Bounds, yu7Wheel);
    const tuned = resolveShowroomCameraPose("cockpit", yu7Bounds, yu7Wheel, "xiaomi-yu7");
    expect(tuned.position.y).toBeGreaterThan(shared.position.y);
    expect(tuned.position.y).toBeGreaterThan(yu7Wheel.y + 0.2);
    expect(tuned.position.y).toBeLessThan(0.86);
    expect(tuned.position.x).toBeGreaterThan(shared.position.x);
    expect(tuned.target.y).toBeLessThan(yu7Wheel.y);
    expect(tuned.target.x).toBeLessThan(tuned.position.x);
  });

  it("moves the M2 eye into the front seat instead of the hood or rear cabin", () => {
    const shared = resolveShowroomCameraPose("cockpit", m2Bounds, null);
    const tuned = resolveShowroomCameraPose("cockpit", m2Bounds, null, "bmw-m2");
    expect(shared.position.x).toBeGreaterThan(0.2);
    expect(tuned.position.x).toBeGreaterThan(0.15);
    expect(tuned.position.x).toBeLessThan(0.25);
    expect(tuned.position.x).toBeLessThan(shared.position.x);
    expect(tuned.position.y).toBeGreaterThan(0.74);
    expect(tuned.position.y).toBeLessThan(0.86);
    expect(tuned.target.x).toBeLessThan(m2Bounds.min.x);
    expect(tuned.position.z).toBeGreaterThan(0);
  });
});

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
    expect(pose.target.y).toBeLessThan(rig.steeringWheelCenter!.y);
    expect(pose.target.x).toBeLessThan(pose.position.x);
    expect(pose.position.x).toBeGreaterThan(rig.steeringWheelCenter!.x);
    expect(pose.position.y).toBeGreaterThan(rig.steeringWheelCenter!.y);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(Math.abs(pose.position.z - pose.target.z)).toBeLessThan(0.12);
    expect(distance).toBeGreaterThan(limits.minDistance);
    expect(pose.position.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.8);
    expect(pose.position.x).toBeLessThan(0.2);

    const offset = pose.position.clone().sub(pose.target);
    const polar = Math.acos(offset.y / offset.length());
    expect(polar).toBeGreaterThan(0.6);
    expect(polar).toBeLessThan(1.5);
  });
});
