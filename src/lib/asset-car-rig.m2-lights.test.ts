import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  boostShowroomMaterialEmissive,
  discoverAssetCarRig,
  SHOWROOM_HEADLAMP_INTENSITY,
} from "@/lib/asset-car-rig";
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

function triangleCount(mesh: THREE.Mesh) {
  const position = mesh.geometry.getAttribute("position");
  if (!position) {
    return 0;
  }
  const index = mesh.geometry.getIndex();
  return index ? index.count / 3 : position.count / 3;
}

describe("BMW M2 headlamp covers", () => {
  it("lifts the front lamp glass off the black window shell so it can emissive-light", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const document = await io.read(
      path.join(process.cwd(), "public/models/market/sedan-mainstream.glb"),
    );
    const scene = document.getRoot().listScenes()[0];
    const root = new THREE.Group();
    for (const child of scene.listChildren()) {
      root.add(toThreeNode(child));
    }
    normalizeMarketModel(root);

    const rig = discoverAssetCarRig(root, "models/market/sedan-mainstream.glb");
    const covers: THREE.Mesh[] = [];
    let windowTriangles = 0;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      if (mesh.userData.showroomHeadlampCover) {
        covers.push(mesh);
      }
      const materialName = (mesh.material as THREE.Material).name ?? "";
      if (/Window_Material/i.test(materialName) && !mesh.userData.showroomHeadlampCover) {
        windowTriangles += triangleCount(mesh);
      }
    });

    expect(rig.capabilities.headLights).toBe(true);
    expect(covers.length).toBeGreaterThan(0);
    const coverTriangles = covers.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    expect(coverTriangles).toBeGreaterThan(600);
    expect(coverTriangles).toBeLessThan(2200);
    expect(windowTriangles).toBeGreaterThan(2500);

    const coverBounds = new THREE.Box3();
    for (const cover of covers) {
      coverBounds.union(new THREE.Box3().setFromObject(cover));
    }
    const carSize = rig.bounds.getSize(new THREE.Vector3());
    const coverSize = coverBounds.getSize(new THREE.Vector3());
    const coverCenter = coverBounds.getCenter(new THREE.Vector3());
    expect(coverCenter.x).toBeLessThan(rig.bounds.min.x + carSize.x * 0.2);
    expect(coverSize.z).toBeGreaterThan(carSize.z * 0.4);

    const lens = rig.headLightMaterials.find((material) => /HeadlampLens/i.test(material.name));
    expect(lens).toBeDefined();
    boostShowroomMaterialEmissive(
      rig.headLightMaterials,
      true,
      SHOWROOM_HEADLAMP_INTENSITY.on,
      1,
    );
    expect(lens!.emissiveIntensity).toBeGreaterThan(10);
    expect(lens!.toneMapped).toBe(false);
    expect(lens!.userData.showroomHeadlampLens).toBe(true);
  });
});
