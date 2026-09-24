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
    expect(partItems(rig, "trunk")).not.toMatch(/trunk_9/i);
    expect(partItems(rig, "sunroof")).toMatch(/carRoof_su7Pro/i);
    expect(partItems(rig, "sunroof")).not.toMatch(/carGlass_front_2_carGlass_front_2/i);
    expect(rig.frontWheels.length).toBeGreaterThanOrEqual(2);
    expect(rig.rearWheels.length).toBeGreaterThanOrEqual(2);
    expect(partItems(rig, "frontWheels")).not.toMatch(/BrakeDisc|Caliper/i);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
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
    expect(partItems(rig, "sunroof")).toMatch(/carRoof_yu7/i);
    expect(partItems(rig, "sunroof")).not.toMatch(/carRoofSpoiler/i);
    expect(rig.frontWheels.length).toBeGreaterThanOrEqual(2);
    expect(rig.rearWheels.length).toBeGreaterThanOrEqual(2);
    expect(partItems(rig, "frontWheels")).not.toMatch(/BrakeDisc|Caliper/i);
    expect(partItems(rig, "headLights")).not.toMatch(/carLight_bulb_3/i);
    expect(rig.paintMaterials.length).toBeGreaterThan(0);
  }, 60_000);
});
