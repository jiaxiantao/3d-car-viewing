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

/**
 * Mirror THREE.PropertyBinding.sanitizeNodeName — GLTFLoader renames every node
 * (spaces become "_", `[] . : /` are stripped). Tests must run against the same
 * names the browser sees, or profile patterns silently stop matching at runtime.
 */
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
      const uv = primitive.getAttribute("TEXCOORD_0");
      const uvValues = uv?.getArray();
      if (uv && uvValues) {
        geometry.setAttribute(
          "uv",
          new THREE.BufferAttribute(Float32Array.from(uvValues), uv.getElementSize()),
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

  object.name = sanitizeNodeName(gltfNode.getName());
  object.position.set(translation[0], translation[1], translation[2]);
  object.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
  object.scale.set(scale[0], scale[1], scale[2]);
  for (const child of gltfNode.listChildren()) {
    object.add(toThreeNode(child));
  }
  return object;
}

function ancestorNamed(object: THREE.Object3D, pattern: RegExp) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (pattern.test(current.name)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function uvSpan(mesh: THREE.Mesh) {
  const uv = mesh.geometry.getAttribute("uv");
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let index = 0; index < uv.count; index += 1) {
    minU = Math.min(minU, uv.getX(index));
    minV = Math.min(minV, uv.getY(index));
    maxU = Math.max(maxU, uv.getX(index));
    maxV = Math.max(maxV, uv.getY(index));
  }
  return Math.hypot(maxU - minU, maxV - minV);
}

function radialStats(mesh: THREE.Mesh, center: THREE.Vector3) {
  const position = mesh.geometry.getAttribute("position");
  mesh.updateWorldMatrix(true, false);
  const sample = new THREE.Vector3();
  let minRadius = Infinity;
  let maxRadius = 0;
  let outerIndex = 0;
  for (let index = 0; index < position.count; index += 1) {
    sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    const radius = Math.hypot(sample.x - center.x, sample.y - center.y);
    minRadius = Math.min(minRadius, radius);
    if (radius > maxRadius) {
      maxRadius = radius;
      outerIndex = index;
    }
  }
  return { minRadius, maxRadius, outerIndex };
}

describe("bmw m2 wheels", () => {
  it("rolls the tyre and the rim together and leaves the caliper fixed", async () => {
    const filePath = path.join(process.cwd(), "public/models/market/sedan-mainstream.glb");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const document = await io.read(filePath);
    const scene = document.getRoot().listScenes()[0];
    const root = new THREE.Group();
    for (const child of scene.listChildren()) {
      root.add(toThreeNode(child));
    }
    normalizeMarketModel(root);

    let wheelNode: THREE.Object3D | null = null;
    root.traverse((object) => {
      if (!wheelNode && /3DWheel[\s_]Front[\s_]L/i.test(object.name)) {
        wheelNode = object;
      }
    });
    expect(wheelNode).toBeTruthy();
    const wheelCenter = new THREE.Box3().setFromObject(wheelNode!).getCenter(new THREE.Vector3());

    let rim: THREE.Mesh | null = null;
    let tyre: THREE.Mesh | null = null;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !ancestorNamed(mesh, /3DWheel[\s_]Front[\s_]L/i)) {
        return;
      }
      const count = mesh.geometry.getAttribute("position")?.count ?? 0;
      if (!rim || count > (rim.geometry.getAttribute("position")?.count ?? 0)) {
        rim = mesh;
      }
      const stats = radialStats(mesh, wheelCenter);
      if (
        uvSpan(mesh) < 0.08 &&
        stats.minRadius > stats.maxRadius * 0.75 &&
        stats.maxRadius > 0.2 &&
        (!tyre || stats.maxRadius > radialStats(tyre, wheelCenter).maxRadius)
      ) {
        tyre = mesh;
      }
    });
    expect(rim).toBeTruthy();
    expect(tyre).toBeTruthy();
    expect(uvSpan(rim!)).toBeLessThan(0.08);
    expect(uvSpan(tyre!)).toBeLessThan(0.08);

    const rig = discoverAssetCarRig(root, "models/market/sedan-mainstream.glb");
    // Each corner spins as one rigid GLB group — never hundreds of leaf meshes
    // (GLTFLoader sanitizes node names; a profile miss falls back to per-mesh
    // clustering and sweeps the calipers into the wheels).
    expect(rig.frontWheels).toHaveLength(2);
    expect(rig.rearWheels).toHaveLength(2);
    expect(rig.frontWheels.map((node) => node.name).join(" ")).toMatch(/3DWheel[\s_]Front[\s_]L/);
    expect(rig.frontWheels.some((node) => /calliper|caliper/i.test(node.name))).toBe(false);
    // Spoke/hub geometry keeps its metal texel. Repainting it hides the rim.
    expect(uvSpan(rim!)).toBeLessThan(0.08);
    expect(uvSpan(tyre!)).toBeGreaterThan(0.35);

    const spinningWheel = rig.frontWheels.find((node) => /Front[\s_]L/i.test(node.name))!;
    const spinningCenter = new THREE.Box3().setFromObject(spinningWheel).getCenter(new THREE.Vector3());
    const rimStats = radialStats(rim!, spinningCenter);
    const tyreStats = radialStats(tyre!, spinningCenter);
    const rimPosition = rim!.geometry.getAttribute("position");
    const tyrePosition = tyre!.geometry.getAttribute("position");
    const rimBefore = new THREE.Vector3()
      .fromBufferAttribute(rimPosition, rimStats.outerIndex)
      .applyMatrix4(rim!.matrixWorld);
    const tyreBefore = new THREE.Vector3()
      .fromBufferAttribute(tyrePosition, tyreStats.outerIndex)
      .applyMatrix4(tyre!.matrixWorld);

    const uv = tyre!.geometry.getAttribute("uv");
    const outerUvAngle = Math.atan2(
      uv.getY(tyreStats.outerIndex) - 0.5,
      uv.getX(tyreStats.outerIndex) - 0.5,
    );
    let compared = 0;
    let aligned = 0;
    const sample = new THREE.Vector3();
    for (let index = 0; index < tyrePosition.count; index += 4) {
      sample.fromBufferAttribute(tyrePosition, index).applyMatrix4(tyre!.matrixWorld);
      const geoAngle = Math.atan2(sample.y - spinningCenter.y, sample.x - spinningCenter.x);
      const nextUvAngle = Math.atan2(uv.getY(index) - 0.5, uv.getX(index) - 0.5);
      const outerGeoAngle = Math.atan2(tyreBefore.y - spinningCenter.y, tyreBefore.x - spinningCenter.x);
      const geoDelta = Math.atan2(Math.sin(geoAngle - outerGeoAngle), Math.cos(geoAngle - outerGeoAngle));
      const uvDelta = Math.atan2(Math.sin(nextUvAngle - outerUvAngle), Math.cos(nextUvAngle - outerUvAngle));
      compared += 1;
      if (Math.abs(Math.atan2(Math.sin(uvDelta - geoDelta), Math.cos(uvDelta - geoDelta))) < 0.45) {
        aligned += 1;
      }
    }
    expect(compared).toBeGreaterThan(8);
    expect(aligned / compared).toBeGreaterThan(0.8);

    let caliper: THREE.Mesh | null = null;
    let caliperIndex = 0;
    let caliperRadius = -1;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !ancestorNamed(mesh, /^Calliper[\s_]Front[\s_]L/i)) {
        return;
      }
      const position = mesh.geometry.getAttribute("position");
      mesh.updateWorldMatrix(true, false);
      for (let index = 0; index < position.count; index += 5) {
        sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
        const radius = Math.hypot(sample.x - spinningCenter.x, sample.y - spinningCenter.y);
        if (radius > caliperRadius) {
          caliperRadius = radius;
          caliper = mesh;
          caliperIndex = index;
        }
      }
    });
    expect(caliper).toBeTruthy();
    const caliperPosition = caliper!.geometry.getAttribute("position");
    caliper!.updateWorldMatrix(true, false);
    const caliperBefore = new THREE.Vector3()
      .fromBufferAttribute(caliperPosition, caliperIndex)
      .applyMatrix4(caliper!.matrixWorld);

    for (const node of [...rig.frontWheels, ...rig.rearWheels]) {
      applyWheelMotion(node, 0.7, 0);
    }
    rim!.updateWorldMatrix(true, false);
    tyre!.updateWorldMatrix(true, false);
    caliper!.updateWorldMatrix(true, false);
    const rimAfter = new THREE.Vector3()
      .fromBufferAttribute(rimPosition, rimStats.outerIndex)
      .applyMatrix4(rim!.matrixWorld);
    const tyreAfter = new THREE.Vector3()
      .fromBufferAttribute(tyrePosition, tyreStats.outerIndex)
      .applyMatrix4(tyre!.matrixWorld);
    const caliperAfter = new THREE.Vector3()
      .fromBufferAttribute(caliperPosition, caliperIndex)
      .applyMatrix4(caliper!.matrixWorld);

    const rimTravel = rimAfter.clone().sub(rimBefore);
    const tyreTravel = tyreAfter.clone().sub(tyreBefore);
    expect(Math.hypot(rimTravel.x, rimTravel.y)).toBeGreaterThan(0.05);
    expect(Math.abs(rimTravel.z)).toBeLessThan(Math.abs(rimTravel.x));
    expect(Math.hypot(tyreTravel.x, tyreTravel.y)).toBeGreaterThan(0.08);
    expect(Math.abs(tyreTravel.z)).toBeLessThan(Math.abs(tyreTravel.x));
    expect(caliperAfter.distanceTo(caliperBefore)).toBeLessThan(0.001);
  });
});
