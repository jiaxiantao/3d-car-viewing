import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import type { Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
// draco3dgltf ships without type declarations.
// @ts-expect-error no declaration file for this decoder package
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { resolveHeadlightSpotPositions } from "@/components/showroom-environment";
import { discoverAssetCarRig } from "@/lib/asset-car-rig";
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

describe("offroad-mainstream headlights", () => {
  it("anchors G900 beams on the round front lamps, not the bumper bar", async () => {
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
    const head = rig.debug.parts.find((part) => part.key === "headLights");
    const items = head?.items.join("\n") ?? "";
    const [left, right] = resolveHeadlightSpotPositions(rig.bounds, rig.headLightPositions);
    const outer = left.z > right.z ? left : right;
    const inner = left.z > right.z ? right : left;

    expect(rig.capabilities.headLights).toBe(true);
    expect(items).toMatch(/lights_lod0/);
    expect(items).toMatch(/nlightsf20/);
    expect(items).not.toMatch(/lamp_alpha/);
    expect(items).not.toMatch(/nlightsf_0\//);
    expect(outer.x).toBeCloseTo(-1.84, 1);
    expect(inner.x).toBeCloseTo(-1.84, 1);
    expect(outer.y).toBeCloseTo(0.62, 1);
    expect(inner.y).toBeCloseTo(0.62, 1);
    expect(outer.z).toBeCloseTo(0.46, 1);
    expect(inner.z).toBeCloseTo(-0.72, 1);
    expect(items).toMatch(/HeadlampLens/);

    const covers: THREE.Mesh[] = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.showroomHeadlampCover) {
        covers.push(mesh);
      }
    });
    expect(covers.length).toBeGreaterThanOrEqual(2);
    const coverSizes = covers.map((mesh) => new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()));
    for (const coverSize of coverSizes) {
      expect(coverSize.y).toBeGreaterThan(0.14);
      expect(coverSize.z).toBeGreaterThan(0.18);
      expect(coverSize.z).toBeLessThan(0.26);
    }
    expect(rig.headLightMaterials.some((material) => material.userData.showroomHeadlampLens)).toBe(true);
  });
});
