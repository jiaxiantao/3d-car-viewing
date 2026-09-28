import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyWheelMotion, discoverAssetCarRig } from "@/lib/asset-car-rig";
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
  const lip = hub as THREE.Mesh;
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
    expect(pose.position.x).toBeGreaterThan(pose.target.x);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    // The unnamed fallback used to sit at x≈0.33, inside the rear cabin shell.
    expect(pose.position.x).toBeLessThan(0.15);
    expect(pose.position.distanceTo(pose.target)).toBeLessThan(0.55);
    expect(pose.target.distanceTo(rig.steeringWheelCenter!)).toBeLessThan(0.2);
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
