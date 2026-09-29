/** Road-wheel splits and in-place axle spin. */
import * as THREE from "three";
import { type MarketRigProfile } from "@/lib/market-rig-profiles";
import { hierarchicalName, matchesAny, triangleCorner, extractTriangleGeometry } from "./mesh";

/** Names that contain "wheel" but are not road wheels (spare, steering, trim). */
export function isWheelMeshName(name: string) {
  if (
    /(spare|sparewheel|leather.?wheel|steering.?wheel|wheel_track|rimdetail|hubcap|diamondcutrim)/i.test(
      name,
    )
  ) {
    return false;
  }
  // Q3 brake calipers live in `Alloy_Break` and must stay fixed while the tyre rolls.
  // M2 spells them `Calliper` (double l) under the `Wheel1A_3D` assembly — never
  // let the generic wheel matcher sweep them into a spinning corner.
  if (/(calliper|caliper|brake\s*disc|brake\s*pad|fender|arch|alloy[_\s-]?break)/i.test(name)) {
    return false;
  }
  return /(wheel|tire|tyre|rim)/i.test(name);
}

/** Profile-listed wheel parts, plus generic tyre names. Spares and the steering wheel stay put. */
export function isRoadWheelMesh(name: string, profile: MarketRigProfile | null) {
  if (/(spare|leather.?wheel|steering.?wheel)/i.test(name)) {
    return false;
  }
  if (matchesAny(name, profile?.wheelPart)) {
    return true;
  }
  return isWheelMeshName(name);
}

export function spansBothAxles(size: THREE.Vector3, carSize: THREE.Vector3) {
  return size.x > carSize.x * 0.4 && size.z > carSize.z * 0.4;
}

export function wheelCornerKey(point: THREE.Vector3, center: THREE.Vector3) {
  const front = point.x < center.x;
  const left = point.z > center.z;
  return `${front ? "F" : "R"}${left ? "L" : "R"}`;
}

export function adoptWheelPiece(source: THREE.Mesh, geometry: THREE.BufferGeometry, corner: string) {
  const piece = new THREE.Mesh(geometry, source.material);
  piece.name = `${source.name}_${corner}`;
  piece.castShadow = source.castShadow;
  piece.receiveShadow = source.receiveShadow;
  piece.position.copy(source.position);
  piece.quaternion.copy(source.quaternion);
  piece.scale.copy(source.scale);
  piece.userData.showroomWheelPiece = corner;
  source.parent?.add(piece);
  return piece;
}

export type WheelCornerBucket = {
  triangles: number[];
  points: THREE.Vector3[];
};

export function medianComponent(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Drop triangles that sit far from the road-wheel cluster in this corner
 * (G900 packs a few spare-tyre faces into the same paint buffer).
 * The hub is the median so a high spare cannot pull it, and a cut is applied
 * only across a real gap. Clipping the top of a round tyre shifts its center
 * and makes that wheel wobble as it rolls.
 */
export function roadWheelTriangles(points: THREE.Vector3[], triangles: number[]) {
  if (triangles.length < 12) {
    return triangles;
  }
  const hubX = medianComponent(points.map((point) => point.x));
  const hubY = medianComponent(points.map((point) => point.y));
  const hubZ = medianComponent(points.map((point) => point.z));
  const distances = points.map((point) =>
    Math.hypot(point.x - hubX, point.y - hubY, point.z - hubZ),
  );
  const sorted = [...distances].sort((left, right) => left - right);
  const wheelRadius = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  const start = Math.floor(sorted.length * 0.6);
  let bestGap = 0;
  let cut = sorted[sorted.length - 1];
  for (let index = start; index < sorted.length - 1; index += 1) {
    const gap = sorted[index + 1] - sorted[index];
    if (gap > bestGap) {
      bestGap = gap;
      cut = sorted[index] + gap * 0.5;
    }
  }
  if (bestGap < Math.max(0.05, wheelRadius * 0.35)) {
    return triangles;
  }

  const kept: number[] = [];
  for (let index = 0; index < triangles.length; index += 1) {
    if (distances[index] <= cut) {
      kept.push(triangles[index]);
    }
  }
  return kept.length > 0 ? kept : triangles;
}

/**
 * Some exports pack every corner into one buffer (Q3 tyres, G900 rims).
 * Cut those into FL/FR/RL/RR so each corner can roll about its own axle.
 * Brake calipers and spare-tyre leftovers stay on the body.
 */
export function splitSpanningWheelMeshes(root: THREE.Object3D, profile: MarketRigProfile | null) {
  const bounds = new THREE.Box3().setFromObject(root);
  const carSize = bounds.getSize(new THREE.Vector3());
  const carCenter = bounds.getCenter(new THREE.Vector3());

  const candidates: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomWheelPiece || mesh.userData.showroomWheelResidual) {
      return;
    }
    const name = hierarchicalName(mesh);
    const profileWheel = matchesAny(name, profile?.wheelPart);
    if (!isRoadWheelMesh(name, profile)) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    // Generic tyre names must span the car. Profile parts (G900) also include
    // a single side's front+rear pair, which is long but not wide.
    if (profileWheel || spansBothAxles(size, carSize)) {
      candidates.push(mesh);
    }
  });

  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (const mesh of candidates) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    const groups = new Map<string, WheelCornerBucket>();

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      const key = wheelCornerKey(centroid, carCenter);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.triangles.push(triangle);
        bucket.points.push(centroid.clone());
      } else {
        groups.set(key, { triangles: [triangle], points: [centroid.clone()] });
      }
    }

    if (groups.size < 2) {
      continue;
    }

    const pieces: { corner: string; triangles: number[] }[] = [];
    const assigned = new Set<number>();
    for (const [corner, bucket] of groups) {
      const kept = roadWheelTriangles(bucket.points, bucket.triangles);
      if (kept.length === 0) {
        continue;
      }
      pieces.push({ corner, triangles: kept });
      for (const triangle of kept) {
        assigned.add(triangle);
      }
    }
    if (pieces.length < 2) {
      continue;
    }

    for (const piece of pieces) {
      adoptWheelPiece(mesh, extractTriangleGeometry(mesh.geometry, piece.triangles), piece.corner);
    }

    const outliers: number[] = [];
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      if (!assigned.has(triangle)) {
        outliers.push(triangle);
      }
    }
    if (outliers.length > 0) {
      const residual = new THREE.Mesh(
        extractTriangleGeometry(mesh.geometry, outliers),
        mesh.material,
      );
      residual.name = mesh.name;
      residual.castShadow = mesh.castShadow;
      residual.receiveShadow = mesh.receiveShadow;
      residual.position.copy(mesh.position);
      residual.quaternion.copy(mesh.quaternion);
      residual.scale.copy(mesh.scale);
      residual.userData.showroomWheelResidual = true;
      mesh.parent?.add(residual);
    }
    mesh.removeFromParent();
  }
}

/** Per-wheel spin metadata stored on the real GLB node (no helper nodes added). */
export type WheelSpinData = {
  /** Original local matrix of the node (relative to its glTF parent). */
  base: THREE.Matrix4;
  /** Axle center, expressed in the node's parent space. */
  pivot: THREE.Vector3;
  /** Unit axle direction (roll axis), in the node's parent space. */
  spinAxis: THREE.Vector3;
  /** Unit steering direction (vertical), in the node's parent space (front only). */
  steerAxis: THREE.Vector3 | null;
};

/** A candidate wheel made of one or more real GLB nodes sharing a single axle. */
export type WheelUnit = {
  nodes: THREE.Object3D[];
  center: THREE.Vector3;
  size: THREE.Vector3;
};

/**
 * Collect real wheel "units" from the GLB.
 * - With a profile `wheel` pattern, each matching node is taken as a whole wheel
 *   (e.g. BMW `3DWheel Front L`) — no climbing, so the 4 corners stay separate.
 * - Otherwise individual wheel meshes are clustered per corner.
 */
export function collectWheelUnits(
  root: THREE.Object3D,
  carSize: THREE.Vector3,
  profile: MarketRigProfile | null,
): WheelUnit[] {
  const units: WheelUnit[] = [];

  if (profile?.wheel?.length) {
    const seen = new Set<string>();
    root.traverse((child) => {
      if (!matchesAny(child.name, profile.wheel) || seen.has(child.uuid)) {
        return;
      }
      seen.add(child.uuid);
      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) {
        return;
      }
      units.push({
        nodes: [child],
        center: box.getCenter(new THREE.Vector3()),
        size: box.getSize(new THREE.Vector3()),
      });
    });
    if (units.length > 0) {
      return units;
    }
  }

  type Cluster = { nodes: THREE.Object3D[]; box: THREE.Box3 };
  const clusters: Cluster[] = [];
  const tolerance = Math.max(carSize.x, carSize.z) * 0.12;
  root.traverse((child) => {
    if (
      child.userData.showroomWheelResidual ||
      !(child as THREE.Mesh).isMesh ||
      !isRoadWheelMesh(hierarchicalName(child), profile)
    ) {
      return;
    }
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) {
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const existing = clusters.find(
      (cluster) => cluster.box.getCenter(new THREE.Vector3()).distanceTo(center) <= tolerance,
    );
    if (existing) {
      existing.nodes.push(child);
      existing.box.union(box);
    } else {
      clusters.push({ nodes: [child], box });
    }
  });
  for (const cluster of clusters) {
    units.push({
      nodes: cluster.nodes,
      center: cluster.box.getCenter(new THREE.Vector3()),
      size: cluster.box.getSize(new THREE.Vector3()),
    });
  }
  return units;
}

/**
 * Record how a real wheel node should rotate about its axle without reparenting.
 * Pivot and axes are converted into the node's parent space so the rotation stays
 * correct while the car body bobs / pitches above it.
 */
export function setupWheelSpin(
  node: THREE.Object3D,
  worldCenter: THREE.Vector3,
  worldAxis: THREE.Vector3,
  isFront: boolean,
): boolean {
  const parent = node.parent;
  if (!parent) {
    return false;
  }
  node.updateWorldMatrix(true, false);
  const parentInverse = parent.matrixWorld.clone().invert();
  const pivot = worldCenter.clone().applyMatrix4(parentInverse);
  const spinAxis = worldCenter
    .clone()
    .add(worldAxis)
    .applyMatrix4(parentInverse)
    .sub(pivot)
    .normalize();
  const steerAxis = isFront
    ? worldCenter
        .clone()
        .add(new THREE.Vector3(0, 1, 0))
        .applyMatrix4(parentInverse)
        .sub(pivot)
        .normalize()
    : null;
  node.userData.showroomWheel = {
    base: node.matrix.clone(),
    pivot,
    spinAxis,
    steerAxis,
  } satisfies WheelSpinData;
  return true;
}

export function invert3(m: number[][]) {
  const a = m[0][0];
  const b = m[0][1];
  const c = m[0][2];
  const d = m[1][0];
  const e = m[1][1];
  const f = m[1][2];
  const g = m[2][0];
  const h = m[2][1];
  const i = m[2][2];
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const D = c * h - b * i;
  const E = a * i - c * g;
  const F = b * g - a * h;
  const G = b * f - c * e;
  const H = c * d - a * f;
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  const invDet = 1 / det;
  return [
    [A * invDet, D * invDet, G * invDet],
    [B * invDet, E * invDet, H * invDet],
    [C * invDet, F * invDet, I * invDet],
  ];
}

/** Smallest-variance direction of a thin disc — the axle, including a little camber. */
export function fitDiscAxle(mesh: THREE.Mesh): { center: THREE.Vector3; axis: THREE.Vector3 } | null {
  const position = mesh.geometry.getAttribute("position");
  if (!position || position.count < 24) {
    return null;
  }
  mesh.updateWorldMatrix(true, false);
  const step = Math.max(1, Math.floor(position.count / 900));
  const points: THREE.Vector3[] = [];
  const center = new THREE.Vector3();
  const sample = new THREE.Vector3();
  for (let index = 0; index < position.count; index += step) {
    sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    const point = sample.clone();
    points.push(point);
    center.add(point);
  }
  if (points.length < 24) {
    return null;
  }
  center.multiplyScalar(1 / points.length);
  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;
  for (const point of points) {
    const x = point.x - center.x;
    const y = point.y - center.y;
    const z = point.z - center.z;
    xx += x * x;
    xy += x * y;
    xz += x * z;
    yy += y * y;
    yz += y * z;
    zz += z * z;
  }
  const covariance = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];
  const axis = new THREE.Vector3(0, 0, 1);
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const inverse = invert3(covariance);
    if (!inverse) {
      return null;
    }
    const x = inverse[0][0] * axis.x + inverse[0][1] * axis.y + inverse[0][2] * axis.z;
    const y = inverse[1][0] * axis.x + inverse[1][1] * axis.y + inverse[1][2] * axis.z;
    const z = inverse[2][0] * axis.x + inverse[2][1] * axis.y + inverse[2][2] * axis.z;
    const length = Math.hypot(x, y, z);
    if (length < 1e-8) {
      return null;
    }
    axis.set(x / length, y / length, z / length);
  }
  // Showroom axles are lateral. A fit that falls over is a partial mesh, not a disc.
  if (Math.abs(axis.z) < 0.9) {
    return null;
  }
  if (axis.z < 0) {
    axis.negate();
  }
  // Vertex mean is pulled toward dense caps and logos (SU7 Ultra hub). The tyre
  // shares the outer lip's center, so spin about that or the wheel hops each turn.
  return { center: discRingCenter(points, axis), axis };
}

/** Center of a full disc: midpoint of its extents, not the vertex average. */
export function discRingCenter(points: THREE.Vector3[], axis: THREE.Vector3) {
  const basisSeed =
    Math.abs(axis.dot(new THREE.Vector3(1, 0, 0))) > 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
  const basisU = new THREE.Vector3().crossVectors(axis, basisSeed).normalize();
  const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize();
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  for (const point of points) {
    const along = point.dot(axis);
    const u = point.dot(basisU);
    const v = point.dot(basisV);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
  }
  return new THREE.Vector3()
    .addScaledVector(basisU, (minU + maxU) / 2)
    .addScaledVector(basisV, (minV + maxV) / 2)
    .addScaledVector(axis, (minAlong + maxAlong) / 2);
}

export function discDiameter(mesh: THREE.Mesh) {
  const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}

/**
 * Thin rotor / rim inside a wheel unit.
 * SU7 and M2 expose `3DWheel` as a group, so the disc is a descendant, not the
 * unit node itself. Spinning the group around world Z instead of that disc's
 * normal makes a cambered wheel shimmy once per turn.
 */
export function discWheelMesh(nodes: THREE.Object3D[]) {
  const meshes: THREE.Mesh[] = [];
  for (const node of nodes) {
    node.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        meshes.push(mesh);
      }
    });
  }
  const discLike = meshes.filter((mesh) => {
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const dims = [size.x, size.y, size.z].sort((left, right) => left - right);
    return dims[0] < dims[2] * 0.25 && dims[1] > dims[2] * 0.75;
  });
  const ranked = [...discLike].sort((left, right) => discDiameter(right) - discDiameter(left));
  return (
    ranked.find((mesh) => /diamondcutrim/i.test(mesh.name)) ??
    ranked.find((mesh) => /disk|disc/i.test(mesh.name)) ??
    ranked.find((mesh) => /rim/i.test(mesh.name)) ??
    ranked[0] ??
    null
  );
}

/**
 * A road-wheel part surrounds the axle. An off-center strip (G900 brake / arch
 * fragment packed into a wheel buffer) must stay on the body — spinning it
 * makes the front wheels look like they wobble.
 * Small rim bolts still spin; they sit on the tyre and are only a few centimetres across.
 */
export function shouldSpinWheelNode(node: THREE.Object3D, axlePoint: THREE.Vector3, axis: THREE.Vector3) {
  const box = new THREE.Box3().setFromObject(node);
  if (box.isEmpty()) {
    return false;
  }
  const size = box.getSize(new THREE.Vector3());
  const expanded = box.clone().expandByVector(axis.clone().multiplyScalar(Math.max(size.length(), 1)));
  if (expanded.containsPoint(axlePoint)) {
    return true;
  }
  return Math.max(size.x, size.y, size.z) < 0.12;
}

/** UV span below this means every vertex samples one texel — rotation is invisible. */
export const COLLAPSED_WHEEL_UV_SPAN = 0.08;
/** Michelin sidewall ring on the M2 wheel-face atlas, as a radius from the texture center. */
export const BMW_WHEEL_ATLAS_RADIUS = 0.46;

export function attributeSpan2(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let index = 0; index < attribute.count; index += 1) {
    const u = attribute.getX(index);
    const v = attribute.getY(index);
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }
  return Math.hypot(maxU - minU, maxV - minV);
}

export function smallestVarianceAxis(points: THREE.Vector3[]) {
  if (points.length < 24) {
    return null;
  }
  const center = new THREE.Vector3();
  for (const point of points) {
    center.add(point);
  }
  center.multiplyScalar(1 / points.length);
  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;
  for (const point of points) {
    const x = point.x - center.x;
    const y = point.y - center.y;
    const z = point.z - center.z;
    xx += x * x;
    xy += x * y;
    xz += x * z;
    yy += y * y;
    yz += y * z;
    zz += z * z;
  }
  const covariance = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];
  const axis = new THREE.Vector3(0, 0, 1);
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const inverse = invert3(covariance);
    if (!inverse) {
      return null;
    }
    const x = inverse[0][0] * axis.x + inverse[0][1] * axis.y + inverse[0][2] * axis.z;
    const y = inverse[1][0] * axis.x + inverse[1][1] * axis.y + inverse[1][2] * axis.z;
    const z = inverse[2][0] * axis.x + inverse[2][1] * axis.y + inverse[2][2] * axis.z;
    const length = Math.hypot(x, y, z);
    if (length < 1e-8) {
      return null;
    }
    axis.set(x / length, y / length, z / length);
  }
  return axis;
}

/**
 * M2 tyre shells share the rim atlas but most rubber triangles are pinned to one
 * texel, so the sidewall stays a flat colour. Project only that outer annulus
 * onto the Michelin ring. The spoke/hub meshes reach the axle — repainting them
 * covers the metal rim with the flat centre of the atlas (the hub looks frozen)
 * and paints the brake rotor onto the spokes (that reads as a spinning caliper).
 */
export function repairCollapsedWheelFaceUvs(wheel: THREE.Object3D) {
  wheel.updateWorldMatrix(true, true);
  const wheelInverse = wheel.matrixWorld.clone().invert();
  const localPoint = new THREE.Vector3();
  const samples: THREE.Vector3[] = [];
  const collapsed: THREE.Mesh[] = [];
  const seen = new Set<string>();

  wheel.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || seen.has(mesh.geometry.uuid) || mesh.geometry.userData.showroomRadialWheelUv) {
      return;
    }
    const uv = mesh.geometry.getAttribute("uv");
    const position = mesh.geometry.getAttribute("position");
    if (!uv || !position || attributeSpan2(uv) >= COLLAPSED_WHEEL_UV_SPAN) {
      return;
    }
    seen.add(mesh.geometry.uuid);
    collapsed.push(mesh);
    const step = Math.max(1, Math.floor(position.count / 80));
    for (let index = 0; index < position.count; index += step) {
      samples.push(
        localPoint
          .fromBufferAttribute(position, index)
          .applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(wheelInverse)
          .clone(),
      );
    }
  });
  if (collapsed.length === 0) {
    return;
  }
  const axle = smallestVarianceAxis(samples);
  if (!axle) {
    return;
  }
  const radiusOf = (point: THREE.Vector3) => {
    const along = point.dot(axle);
    return Math.hypot(
      point.x - axle.x * along,
      point.y - axle.y * along,
      point.z - axle.z * along,
    );
  };
  const radii = samples.map(radiusOf);
  radii.sort((left, right) => left - right);
  const outer = radii[Math.min(radii.length - 1, Math.floor(radii.length * 0.9))];
  if (outer < 1e-5) {
    return;
  }
  const basisSeed = Math.abs(axle.dot(new THREE.Vector3(1, 0, 0))) > 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const basisU = new THREE.Vector3().crossVectors(axle, basisSeed).normalize();
  const basisV = new THREE.Vector3().crossVectors(axle, basisU).normalize();
  // Spokes and the centre cap reach inward. Only the tyre annulus gets the atlas.
  const tyreInner = outer * 0.72;

  for (const mesh of collapsed) {
    const position = mesh.geometry.getAttribute("position");
    let inner = Infinity;
    const step = Math.max(1, Math.floor(position.count / 40));
    for (let index = 0; index < position.count; index += step) {
      localPoint
        .fromBufferAttribute(position, index)
        .applyMatrix4(mesh.matrixWorld)
        .applyMatrix4(wheelInverse);
      inner = Math.min(inner, radiusOf(localPoint));
    }
    if (inner <= tyreInner) {
      continue;
    }
    const geometry = mesh.geometry.clone();
    const next = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index += 1) {
      localPoint
        .fromBufferAttribute(position, index)
        .applyMatrix4(mesh.matrixWorld)
        .applyMatrix4(wheelInverse);
      const along = localPoint.dot(axle);
      localPoint.addScaledVector(axle, -along);
      const radius = localPoint.length();
      const angle = Math.atan2(localPoint.dot(basisV), localPoint.dot(basisU));
      const uvRadius = (radius / outer) * BMW_WHEEL_ATLAS_RADIUS;
      next[index * 2] = 0.5 + Math.cos(angle) * uvRadius;
      next[index * 2 + 1] = 0.5 + Math.sin(angle) * uvRadius;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(next, 2));
    geometry.userData.showroomRadialWheelUv = true;
    mesh.geometry = geometry;
  }
}

/**
 * A few caliper bolts are packed inside the M2 rim group. They sit wholly in the
 * sibling caliper's bounds, so they have to stay on the knuckle instead of rolling
 * with the tyre. Spoke meshes surround the axle and are left on the rim.
 */
export function releaseFixedCaliperPieces(wheel: THREE.Object3D) {
  const carrier = wheel.parent;
  if (!carrier) {
    return;
  }
  const caliperBoxes: THREE.Box3[] = [];
  carrier.traverse((node) => {
    let parent: THREE.Object3D | null = node;
    while (parent) {
      if (parent === wheel) {
        return;
      }
      parent = parent.parent;
    }
    // Corner calipers only. The parent `Calliper1` box spans the whole car and
    // would swallow rim bolts that merely sit near a corner.
    // GLTFLoader sanitizes node names (spaces become "_") — tolerate both.
    if (!/calliper(?:zone)?[\s_](front|rear)[\s_][lr]/i.test(node.name)) {
      return;
    }
    const box = new THREE.Box3().setFromObject(node);
    if (!box.isEmpty()) {
      caliperBoxes.push(box);
    }
  });
  if (caliperBoxes.length === 0) {
    return;
  }
  for (const child of [...wheel.children]) {
    const childBox = new THREE.Box3().setFromObject(child);
    if (childBox.isEmpty()) {
      continue;
    }
    if (caliperBoxes.some((box) => box.containsBox(childBox))) {
      carrier.attach(child);
    }
  }
}

/** SU7 Max packs brake calipers inside each `3DWheel` group. Leave them on the knuckle. */
export function releaseFixedBrakeChildren(wheel: THREE.Object3D) {
  const carrier = wheel.parent;
  if (!carrier) {
    return;
  }
  for (const child of [...wheel.children]) {
    if (!/brake|calliper|caliper/i.test(child.name) || /disc|disk|hub/i.test(child.name)) {
      continue;
    }
    carrier.attach(child);
  }
}

/** Find the real ground wheels and tag them for in-place rotation. */
export function findWheelNodes(root: THREE.Object3D, profile: MarketRigProfile | null) {
  const frontWheels: THREE.Object3D[] = [];
  const rearWheels: THREE.Object3D[] = [];

  const bounds = new THREE.Box3().setFromObject(root);
  const carCenter = bounds.getCenter(new THREE.Vector3());
  const carSize = bounds.getSize(new THREE.Vector3());

  const units = collectWheelUnits(root, carSize, profile);

  // Keep at most one wheel per corner (FL / FR / RL / RR).
  const quadrantBest = new Map<string, WheelUnit>();
  for (const unit of units) {
    if (unit.nodes.some((node) => /spare/i.test(hierarchicalName(node)))) {
      continue;
    }
    // Road wheels sit on the floor, never at the body center, and never span the car.
    if (unit.center.y > bounds.min.y + carSize.y * 0.32) {
      continue;
    }
    if (unit.size.x > carSize.x * 0.5 || unit.size.z > carSize.z * 0.6) {
      continue;
    }
    if (
      Math.abs(unit.center.x - carCenter.x) < carSize.x * 0.12 &&
      Math.abs(unit.center.z - carCenter.z) < carSize.z * 0.12
    ) {
      continue;
    }

    const front = unit.center.x < carCenter.x;
    const left = unit.center.z > carCenter.z;
    const key = `${front ? "F" : "R"}${left ? "L" : "R"}`;
    const prev = quadrantBest.get(key);
    if (!prev || unit.center.y < prev.center.y) {
      quadrantBest.set(key, unit);
    }
  }

  const rollRadii: number[] = [];
  for (const [key, unit] of quadrantBest) {
    const isFront = key.startsWith("F");
    rollRadii.push(Math.max(unit.size.y, Math.min(unit.size.x, unit.size.z)) * 0.5);
    // A cambered rim is tilted off the world lateral axis. Spinning it around
    // world Z makes the face shimmy left-right once per turn. Use the disc normal.
    const disc = discWheelMesh(unit.nodes);
    const fitted = disc ? fitDiscAxle(disc) : null;
    const worldAxis =
      fitted?.axis ??
      (unit.size.z <= unit.size.x ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0));
    const pivot = fitted?.center ?? unit.center;
    for (const node of unit.nodes) {
      if (!shouldSpinWheelNode(node, pivot, worldAxis)) {
        continue;
      }
      if (/3DWheel/i.test(node.name)) {
        releaseFixedCaliperPieces(node);
        releaseFixedBrakeChildren(node);
      }
      if (setupWheelSpin(node, pivot, worldAxis, isFront)) {
        if (/3DWheel/i.test(node.name)) {
          repairCollapsedWheelFaceUvs(node);
        }
        (isFront ? frontWheels : rearWheels).push(node);
      }
    }
  }

  const wheelRollRadius =
    rollRadii.length > 0
      ? rollRadii.reduce((sum, value) => sum + value, 0) / rollRadii.length
      : 0.27;

  return { frontWheels, rearWheels, wheelRollRadius };
}

export const WHEEL_MATRIX = new THREE.Matrix4();
export const WHEEL_ROTATION = new THREE.Matrix4();
export const WHEEL_TRANSLATION = new THREE.Matrix4();

/**
 * Roll (and optionally steer) a real GLB wheel node about its own axle, in place.
 * Rotation is rebuilt from the node's recorded base matrix each frame, so no extra
 * pivot/helper nodes are introduced into the scene graph.
 */
export function applyWheelMotion(
  node: THREE.Object3D,
  spinAngle: number,
  steerAngle: number,
) {
  const data = node.userData.showroomWheel as
    | {
        base: THREE.Matrix4;
        pivot: THREE.Vector3;
        spinAxis: THREE.Vector3;
        steerAxis: THREE.Vector3 | null;
      }
    | undefined;
  if (!data) {
    return;
  }
  const { base, pivot, spinAxis, steerAxis } = data;
  WHEEL_MATRIX.makeTranslation(pivot.x, pivot.y, pivot.z);
  if (steerAxis && steerAngle !== 0) {
    WHEEL_MATRIX.multiply(WHEEL_ROTATION.makeRotationAxis(steerAxis, steerAngle));
  }
  WHEEL_MATRIX.multiply(WHEEL_ROTATION.makeRotationAxis(spinAxis, spinAngle));
  WHEEL_MATRIX.multiply(WHEEL_TRANSLATION.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  WHEEL_MATRIX.multiply(base);
  WHEEL_MATRIX.decompose(node.position, node.quaternion, node.scale);
}
