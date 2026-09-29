/** Shared mesh scan, hinge, and triangle-split helpers. */
import * as THREE from "three";
import { type ShowroomSpinAxis } from "./types";

export type MeshEntry = {
  mesh: THREE.Mesh;
  name: string;
  materialName: string;
  center: THREE.Vector3;
  size: THREE.Vector3;
  volume: number;
};

export function getSourceMaterialName(mesh: THREE.Mesh) {
  const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return sources
    .map((entry) => entry?.name ?? "")
    .filter(Boolean)
    .join(" ");
}

export function hierarchicalName(object: THREE.Object3D): string {
  const parts: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name) {
      parts.unshift(current.name);
    }
    current = current.parent;
  }
  return parts.join("/");
}

export function matchesAny(name: string, patterns?: RegExp[]) {
  if (!patterns?.length) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(name));
}

export function getMeshVolume(mesh: THREE.Mesh) {
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(mesh).getSize(size);
  return Math.max(size.x * size.y * size.z, 1e-6);
}

export function isExcludedPart(name: string) {
  return /(camera|helper|gizmo|locator|steer|column)/i.test(name);
}

export function collectMeshes(root: THREE.Object3D) {
  const entries: MeshEntry[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) {
      return;
    }
    const name = hierarchicalName(mesh);
    if (isExcludedPart(name)) {
      return;
    }
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    entries.push({
      mesh,
      name,
      materialName: getSourceMaterialName(mesh),
      center,
      size,
      volume: Math.max(size.x * size.y * size.z, 1e-6),
    });
  });
  return entries;
}

/**
 * Place a hinge under `root` at a world-space point, in root-local coordinates.
 * Keep identity local rotation so children stay rigidly parented; choose the spin
 * axis to match showroom world axes after normalize (`Ry(-90°)` on market GLBs):
 * - doors: root-local Y (= world Y)
 * - trunk: root-local X (= world Z / lateral)
 */
export function createHingePivot(
  root: THREE.Object3D,
  worldPoint: THREE.Vector3,
  hingeAxis: ShowroomSpinAxis,
) {
  const pivot = new THREE.Group();
  root.updateWorldMatrix(true, true);
  const localPoint = worldPoint.clone();
  root.worldToLocal(localPoint);
  pivot.position.copy(localPoint);
  pivot.userData.showroomHingeAxis = hingeAxis;
  root.add(pivot);
  return pivot;
}

/** Convert a world-space translation into `object`'s parent-local delta. */
export function worldDeltaToParentLocal(object: THREE.Object3D, worldDelta: THREE.Vector3) {
  const parent = object.parent;
  if (!parent) {
    return worldDelta.clone();
  }
  parent.updateWorldMatrix(true, false);
  const inverse = parent.matrixWorld.clone().invert();
  const start = new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld);
  const end = start.clone().add(worldDelta);
  start.applyMatrix4(inverse);
  end.applyMatrix4(inverse);
  return end.sub(start);
}

export function triangleCorner(geometry: THREE.BufferGeometry, triangle: number, corner: number) {
  const index = geometry.getIndex();
  return index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
}

export function extractTriangleGeometry(geometry: THREE.BufferGeometry, triangles: number[]) {
  const remap = new Map<number, number>();
  const corners: number[] = [];
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const source = triangleCorner(geometry, triangle, corner);
      if (!remap.has(source)) {
        remap.set(source, remap.size);
      }
      corners.push(source);
    }
  }

  const next = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    const itemSize = attribute.itemSize;
    const ArrayCtor = attribute.array.constructor as Float32ArrayConstructor;
    const packed = new ArrayCtor(remap.size * itemSize);
    for (const [source, destination] of remap) {
      for (let component = 0; component < itemSize; component += 1) {
        packed[destination * itemSize + component] = attribute.getComponent(source, component);
      }
    }
    next.setAttribute(name, new THREE.BufferAttribute(packed, itemSize, attribute.normalized));
  }
  next.setIndex(corners.map((source) => remap.get(source)!));
  return next;
}
