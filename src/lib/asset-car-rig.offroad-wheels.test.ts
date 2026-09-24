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

function worldCenter(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

describe("offroad-mainstream wheels", () => {
  it("rolls each G900 road wheel in place and leaves the spare still", async () => {
    const filePath = path.join(process.cwd(), "public/models/market/offroad-mainstream.glb");
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
    const rig = discoverAssetCarRig(root, "models/market/offroad-mainstream.glb");
    const wheels = [...rig.frontWheels, ...rig.rearWheels];

    expect(rig.capabilities.wheels).toBe(true);
    expect(rig.capabilities.wheelsSynthetic).toBe(false);
    expect(rig.frontWheels.length).toBeGreaterThan(0);
    expect(rig.rearWheels.length).toBeGreaterThan(0);
    expect(wheels.some((node) => /spare/i.test(node.name))).toBe(false);

    root.updateWorldMatrix(true, true);
    const carCenter = rig.bounds.getCenter(new THREE.Vector3());
    const corners = new Set(
      wheels.map((wheel) => {
        const center = worldCenter(wheel);
        return `${center.x < carCenter.x ? "F" : "R"}${center.z > carCenter.z ? "L" : "R"}`;
      }),
    );
    expect(corners).toEqual(new Set(["FL", "FR", "RL", "RR"]));
    for (const corner of ["FL", "FR", "RL", "RR"]) {
      expect(
        wheels.some((node) => /michelin/i.test(node.name) && node.name.endsWith(`_${corner}`)),
      ).toBe(true);
      expect(
        wheels.some(
          (node) => /diamondcutrim|rimdetail/i.test(node.name) && node.name.endsWith(`_${corner}`),
        ),
      ).toBe(true);
      expect(
        wheels.some((node) => /_gt_34_/i.test(node.name) && node.name.endsWith(`_${corner}`)),
      ).toBe(true);
    }
    expect(wheels.some((node) => /left_wheel/i.test(node.name))).toBe(true);
    expect(wheels.some((node) => /right_wheel/i.test(node.name))).toBe(true);
    // Off-axle fragments packed into the wheel buffers stay on the body.
    // Spinning them is what made the front wheels wobble.
    expect(wheels.some((node) => /smallspecmap/i.test(node.name))).toBe(false);

    const maxCenterDrift = (node: THREE.Object3D) => {
      node.updateWorldMatrix(true, false);
      const before = worldCenter(node);
      let maxDrift = 0;
      for (let step = 1; step <= 8; step += 1) {
        applyWheelMotion(node, (step / 8) * Math.PI * 2, 0);
        node.updateWorldMatrix(true, false);
        maxDrift = Math.max(maxDrift, worldCenter(node).distanceTo(before));
      }
      applyWheelMotion(node, 0, 0);
      return maxDrift;
    };
    for (const token of [
      "michelin02_0.001_FL",
      "michelin02_0.001_FR",
      "diamondcutrim_0.001_FL",
      "diamondcutrim_0.001_FR",
      "white_rimdetail_0.001_FL",
      "white_rimdetail_0.001_FR",
    ]) {
      const node = wheels.find((item) => item.name.includes(token));
      expect(node, token).toBeDefined();
      expect(maxCenterDrift(node!)).toBeLessThan(0.012);
    }

    const topLateralSpan = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.getAttribute("position");
      const sample = new THREE.Vector3();
      const stride = Math.max(1, Math.floor(position.count / 500));
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let step = 0; step < 12; step += 1) {
        applyWheelMotion(mesh, (step / 12) * Math.PI * 2, 0);
        mesh.updateWorldMatrix(true, false);
        let topY = -Infinity;
        let topZ = 0;
        for (let index = 0; index < position.count; index += stride) {
          sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
          if (sample.y > topY) {
            topY = sample.y;
            topZ = sample.z;
          }
        }
        minZ = Math.min(minZ, topZ);
        maxZ = Math.max(maxZ, topZ);
      }
      applyWheelMotion(mesh, 0, 0);
      return maxZ - minZ;
    };
    for (const token of ["diamondcutrim_0.001_FL", "diamondcutrim_0.001_FR"]) {
      const rim = wheels.find((item) => item.name.includes(token)) as THREE.Mesh;
      expect(rim, token).toBeDefined();
      expect(topLateralSpan(rim)).toBeLessThan(0.003);
    }

    const spare = root.getObjectByName("tgn_brabus_g900_2020_058_sparewheel_plastic_0.001");
    expect(spare).toBeDefined();
    const spareCenter = worldCenter(spare!);
    for (const wheel of wheels) {
      expect(worldCenter(wheel).distanceTo(spareCenter)).toBeGreaterThan(0.35);
    }

    const tyre = wheels.find((node) => /michelin/i.test(node.name) && node.name.endsWith("_FL"));
    expect(tyre).toBeDefined();
    const spinning = tyre as THREE.Mesh;
    const centerBefore = worldCenter(spinning);
    const position = spinning.geometry.getAttribute("position");
    let topIndex = 0;
    let topY = -Infinity;
    const sample = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 4) {
      sample.fromBufferAttribute(position, index).applyMatrix4(spinning.matrixWorld);
      if (sample.y > topY) {
        topY = sample.y;
        topIndex = index;
      }
    }
    const topBefore = new THREE.Vector3()
      .fromBufferAttribute(position, topIndex)
      .applyMatrix4(spinning.matrixWorld);

    applyWheelMotion(spinning, 0.7, 0);
    spinning.updateWorldMatrix(true, false);

    const centerAfter = worldCenter(spinning);
    const topAfter = new THREE.Vector3()
      .fromBufferAttribute(position, topIndex)
      .applyMatrix4(spinning.matrixWorld);
    expect(centerAfter.distanceTo(centerBefore)).toBeLessThan(0.04);
    expect(topAfter.distanceTo(topBefore)).toBeGreaterThan(0.03);
    const travel = topAfter.clone().sub(topBefore);
    expect(Math.abs(travel.x)).toBeGreaterThan(Math.abs(travel.z));

    const spareBefore = spareCenter.clone();
    for (const wheel of wheels) {
      applyWheelMotion(wheel, 1.4, 0);
    }
    root.updateWorldMatrix(true, true);
    expect(worldCenter(spare!).distanceTo(spareBefore)).toBeLessThan(0.001);
  });
});
