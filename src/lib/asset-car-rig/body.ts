/** Doors, trunk, sunroof, steering center, and cabin panel splits. */
import * as THREE from "three";
import { type DoorIslandShape, type MarketRigProfile } from "@/lib/market-rig-profiles";
import { hierarchicalName, matchesAny, createHingePivot, worldDeltaToParentLocal, triangleCorner, extractTriangleGeometry } from "./mesh";

export const DOOR_EXCLUDE =
  /(tail[_\s-]?lamp|door[_\s-]?int|door_int|interior|boot|lock|carpet|icon|speaker|seat|rubber|clamp|wind|windsh|glass_red|hl_cover|technology|primeam)/i;
export const DOOR_INCLUDE =
  /(door[_\s-]?black|door[_\s-]?soft|door[_\s-]?rubber|door[_\s-]?plastic|door[_\s-]?noise)/i;

export function isTrunkPart(name: string) {
  return (
    /boot[_\s-]?ext/i.test(name) &&
    !/wind|windsh|int|interior|net|nameboard|clamp/i.test(name)
  );
}

export function isDoorCandidate(name: string, profile: MarketRigProfile | null) {
  if (DOOR_EXCLUDE.test(name)) {
    return false;
  }
  if (profile && (matchesAny(name, profile.leftDoor) || matchesAny(name, profile.rightDoor))) {
    return true;
  }
  if (!/door/i.test(name)) {
    return false;
  }
  return DOOR_INCLUDE.test(name) || /door[_\s-]?black|door[_\s-]?soft/i.test(name);
}

export function isSunroofPart(name: string) {
  return /(sunroof|moon\s*roof)/i.test(name) || (/roof/i.test(name) && /glass/i.test(name));
}

export function createSideDoorPivot(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  side: "left" | "right",
  hingeMeshes?: THREE.Mesh[],
  hingeLead?: number,
  hingeOutset = 0,
) {
  // One mesh must belong to only one door — steal-via-attach across sides causes floaters.
  const unique: THREE.Mesh[] = [];
  const seen = new Set<string>();
  for (const mesh of meshes) {
    if (seen.has(mesh.uuid) || mesh.userData.showroomDoorClaimed) {
      continue;
    }
    seen.add(mesh.uuid);
    unique.push(mesh);
  }
  if (unique.length === 0) {
    return null;
  }

  // Hinge from outer-shell seeds only — INT trim must not shift the pivot.
  const hingeSource = (hingeMeshes ?? []).filter((mesh) =>
    unique.some((candidate) => candidate.uuid === mesh.uuid),
  );
  const doorBox = new THREE.Box3();
  for (const mesh of hingeSource.length > 0 ? hingeSource : unique) {
    doorBox.expandByObject(mesh);
  }

  const openSign = side === "left" ? -1 : 1;
  // Outer skin is max.z on the left and min.z on the right. Pull the axis
  // inboard so it sits against the body instead of on the outer paint.
  const doorDepthZ = doorBox.max.z - doorBox.min.z;
  const inward = Math.min(0.055, doorDepthZ * 0.4);
  // `hingeOutset` moves the axis back toward the outer skin (left is +Z).
  const hingeZ =
    side === "left" ? doorBox.max.z - inward + hingeOutset : doorBox.min.z + inward - hingeOutset;
  const doorSpanX = doorBox.max.x - doorBox.min.x;
  // Showroom -X is forward. Positive lead places the axis ahead of the leading
  // face; negative lead (Xiaomi) places it behind that face, toward the rear.
  const hingeX = doorBox.min.x - (hingeLead ?? doorSpanX * 0.01);

  const hingeWorld = new THREE.Vector3(
    hingeX,
    doorBox.min.y + (doorBox.max.y - doorBox.min.y) * 0.32,
    hingeZ,
  );
  const pivot = createHingePivot(root, hingeWorld, "y");

  for (const mesh of unique) {
    mesh.userData.showroomDoorClaimed = side;
    pivot.attach(mesh);
  }

  pivot.userData.showroomSide = side;
  pivot.userData.showroomOpenSign = openSign;
  return pivot;
}

export function isUnderPivot(object: THREE.Object3D, pivot: THREE.Object3D | null) {
  if (!pivot) {
    return false;
  }
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === pivot) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

export function closedDoorBounds(pivot: THREE.Object3D | null) {
  if (!pivot) {
    return null;
  }
  const box = new THREE.Box3();
  let found = false;
  pivot.updateWorldMatrix(true, true);
  pivot.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    box.expandByObject(mesh);
    found = true;
  });
  return found ? box : null;
}

/**
 * Front-door claim volume. Shrink the rear face so a shared beltline mesh
 * does not donate the rear door's leading edge to the front hinge.
 * Showroom forward is -X, so the rear face is `max.x`.
 */
export function frontDoorClaimBox(doorBox: THREE.Box3) {
  const size = doorBox.getSize(new THREE.Vector3());
  const box = doorBox.clone();
  box.max.x -= size.x * 0.08;
  box.min.x -= 0.04;
  box.min.y -= 0.04;
  box.max.y += 0.04;
  box.min.z -= 0.06;
  box.max.z += 0.06;
  return box;
}

export function adoptDoorPiece(source: THREE.Mesh, geometry: THREE.BufferGeometry, pivot: THREE.Group) {
  const piece = new THREE.Mesh(geometry, source.material);
  piece.name = source.name;
  piece.castShadow = source.castShadow;
  piece.receiveShadow = source.receiveShadow;
  piece.position.copy(source.position);
  piece.quaternion.copy(source.quaternion);
  piece.scale.copy(source.scale);
  source.parent?.add(piece);
  piece.userData.showroomDoorClaimed = pivot.userData.showroomSide;
  pivot.attach(piece);
  return piece;
}

/**
 * Q3 beltline covers are one mesh across every door. Cut the triangles that
 * sit in each front-door volume and parent those pieces to that hinge.
 */
export function splitSpanningDoorTrim(
  leftPivot: THREE.Group | null,
  rightPivot: THREE.Group | null,
  patterns?: RegExp[],
) {
  const adopted: { left: THREE.Mesh[]; right: THREE.Mesh[] } = { left: [], right: [] };
  if (!patterns?.length || (!leftPivot && !rightPivot)) {
    return adopted;
  }

  const leftBox = closedDoorBounds(leftPivot);
  const rightBox = closedDoorBounds(rightPivot);
  const leftClaim = leftBox ? frontDoorClaimBox(leftBox) : null;
  const rightClaim = rightBox ? frontDoorClaimBox(rightBox) : null;
  if (!leftClaim && !rightClaim) {
    return adopted;
  }

  const candidates: THREE.Mesh[] = [];
  const root = leftPivot?.parent ?? rightPivot?.parent;
  root?.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !matchesAny(hierarchicalName(mesh), patterns)) {
      return;
    }
    if (isUnderPivot(mesh, leftPivot) || isUnderPivot(mesh, rightPivot)) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    candidates.push(mesh);
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
    const leftTriangles: number[] = [];
    const rightTriangles: number[] = [];
    const stayTriangles: number[] = [];

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);

      const inLeft = Boolean(leftClaim?.containsPoint(centroid));
      const inRight = Boolean(rightClaim?.containsPoint(centroid));
      if (inLeft && inRight && leftBox && rightBox) {
        const leftCenter = leftBox.getCenter(new THREE.Vector3());
        const rightCenter = rightBox.getCenter(new THREE.Vector3());
        if (centroid.distanceTo(leftCenter) <= centroid.distanceTo(rightCenter)) {
          leftTriangles.push(triangle);
        } else {
          rightTriangles.push(triangle);
        }
      } else if (inLeft) {
        leftTriangles.push(triangle);
      } else if (inRight) {
        rightTriangles.push(triangle);
      } else {
        stayTriangles.push(triangle);
      }
    }

    if (leftTriangles.length === 0 && rightTriangles.length === 0) {
      continue;
    }

    if (leftPivot && leftTriangles.length > 0) {
      adopted.left.push(adoptDoorPiece(mesh, extractTriangleGeometry(mesh.geometry, leftTriangles), leftPivot));
    }
    if (rightPivot && rightTriangles.length > 0) {
      adopted.right.push(
        adoptDoorPiece(mesh, extractTriangleGeometry(mesh.geometry, rightTriangles), rightPivot),
      );
    }

    if (stayTriangles.length === 0) {
      mesh.removeFromParent();
    } else if (stayTriangles.length !== triangleCount) {
      // New geometry — the template still owns the original shared buffer.
      mesh.geometry = extractTriangleGeometry(mesh.geometry, stayTriangles);
    }
  }

  return adopted;
}

/** Triangle groups that share no vertices — the mesh's original islands. */
function connectedTriangleIslands(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  if (!position) {
    return [];
  }
  const triangleCount = geometry.getIndex() ? geometry.getIndex()!.count / 3 : position.count / 3;
  const parent = new Uint32Array(position.count);
  for (let index = 0; index < parent.length; index += 1) {
    parent[index] = index;
  }
  const find = (index: number) => {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root];
    }
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const unite = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  };
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const cornerA = triangleCorner(geometry, triangle, 0);
    const cornerB = triangleCorner(geometry, triangle, 1);
    const cornerC = triangleCorner(geometry, triangle, 2);
    unite(cornerA, cornerB);
    unite(cornerB, cornerC);
  }
  const groups = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangleCorner(geometry, triangle, 0));
    const list = groups.get(root);
    if (list) {
      list.push(triangle);
    } else {
      groups.set(root, [triangle]);
    }
  }
  return [...groups.values()];
}

/**
 * Parent each already-disconnected island of a named node to the door hinge
 * that contains it. Islands outside every door (the cabin center) stay put.
 * Connected triangles are never cut apart.
 */
export function adoptDoorIslandNodes(
  pivots: Array<THREE.Group | null>,
  patterns?: RegExp[],
) {
  const live = pivots.filter((pivot): pivot is THREE.Group => pivot !== null);
  if (!patterns?.length || live.length === 0) {
    return;
  }

  const claims = live.flatMap((pivot) => {
    const bounds = closedDoorBounds(pivot);
    if (!bounds) {
      return [];
    }
    const box = bounds.clone();
    box.expandByScalar(0.03);
    return [
      {
        pivot,
        box,
        center: bounds.getCenter(new THREE.Vector3()),
        doorSize: bounds.getSize(new THREE.Vector3()),
      },
    ];
  });
  if (claims.length === 0) {
    return;
  }

  const candidates: THREE.Mesh[] = [];
  live[0].parent?.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !matchesAny(hierarchicalName(mesh), patterns)) {
      return;
    }
    if (live.some((pivot) => isUnderPivot(mesh, pivot))) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    candidates.push(mesh);
  });

  const corner = new THREE.Vector3();
  for (const mesh of candidates) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const islands = connectedTriangleIslands(mesh.geometry);
    const owned = new Map<THREE.Group, number[]>();
    const stayTriangles: number[] = [];

    for (const island of islands) {
      const islandBox = new THREE.Box3();
      for (const triangle of island) {
        for (let index = 0; index < 3; index += 1) {
          corner.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, index));
          corner.applyMatrix4(mesh.matrixWorld);
          islandBox.expandByPoint(corner);
        }
      }
      const centroid = islandBox.getCenter(new THREE.Vector3());
      const islandSize = islandBox.getSize(new THREE.Vector3());
      let owner: (typeof claims)[number] | null = null;
      let bestDistance = Infinity;
      for (const claim of claims) {
        if (!claim.box.containsPoint(centroid)) {
          continue;
        }
        if (
          islandSize.x > claim.doorSize.x ||
          islandSize.y > claim.doorSize.y ||
          islandSize.z > claim.doorSize.z
        ) {
          continue;
        }
        const distance = centroid.distanceTo(claim.center);
        if (distance < bestDistance) {
          owner = claim;
          bestDistance = distance;
        }
      }
      if (!owner) {
        stayTriangles.push(...island);
        continue;
      }
      const list = owned.get(owner.pivot) ?? [];
      list.push(...island);
      owned.set(owner.pivot, list);
    }

    if (owned.size === 0) {
      continue;
    }
    for (const [pivot, triangles] of owned) {
      adoptDoorPiece(mesh, extractTriangleGeometry(mesh.geometry, triangles), pivot);
    }
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    if (stayTriangles.length === 0) {
      mesh.removeFromParent();
    } else if (stayTriangles.length !== triangleCount) {
      mesh.geometry = extractTriangleGeometry(mesh.geometry, stayTriangles);
    }
  }
}

function weldTriangleIslands(
  geometry: THREE.BufferGeometry,
  islands: number[][],
  matrixWorld: THREE.Matrix4,
  weld: number,
) {
  if (weld <= 0 || islands.length < 2) {
    return islands;
  }
  const position = geometry.getAttribute("position");
  if (!position) {
    return islands;
  }
  const parent = islands.map((_, index) => index);
  const find = (index: number) => {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root];
    }
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const unite = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  };
  const buckets = new Map<string, number>();
  const corner = new THREE.Vector3();
  islands.forEach((island, islandIndex) => {
    for (const triangle of island) {
      for (let index = 0; index < 3; index += 1) {
        corner.fromBufferAttribute(position, triangleCorner(geometry, triangle, index));
        corner.applyMatrix4(matrixWorld);
        const key = `${Math.round(corner.x / weld)},${Math.round(corner.y / weld)},${Math.round(corner.z / weld)}`;
        const other = buckets.get(key);
        if (other === undefined) {
          buckets.set(key, islandIndex);
        } else {
          unite(islandIndex, other);
        }
      }
    }
  });
  const merged = new Map<number, number[]>();
  islands.forEach((island, islandIndex) => {
    const root = find(islandIndex);
    const list = merged.get(root);
    if (list) {
      list.push(...island);
    } else {
      merged.set(root, [...island]);
    }
  });
  return [...merged.values()];
}

function islandFitsDoor(shape: DoorIslandShape, islandBox: THREE.Box3, doorBox: THREE.Box3) {
  const doorSize = doorBox.getSize(new THREE.Vector3());
  const islandSize = islandBox.getSize(new THREE.Vector3());
  const center = islandBox.getCenter(new THREE.Vector3());
  const along = (center.x - doorBox.min.x) / Math.max(doorSize.x, 1e-6);
  const up = (center.y - doorBox.min.y) / Math.max(doorSize.y, 1e-6);
  if (along < shape.centerX[0] || along > shape.centerX[1]) {
    return false;
  }
  if (up < shape.centerY[0] || up > shape.centerY[1]) {
    return false;
  }
  const fractions = {
    x: islandSize.x / Math.max(doorSize.x, 1e-6),
    y: islandSize.y / Math.max(doorSize.y, 1e-6),
    z: islandSize.z / Math.max(doorSize.z, 1e-6),
  };
  if (
    fractions.x < shape.minSize.x ||
    fractions.y < shape.minSize.y ||
    fractions.z < shape.minSize.z ||
    fractions.x > shape.maxSize.x ||
    fractions.y > shape.maxSize.y ||
    fractions.z > shape.maxSize.z
  ) {
    return false;
  }
  const pad = doorBox.clone();
  pad.expandByScalar(shape.centerPad);
  return pad.containsPoint(center);
}

/**
 * Parent specific whole islands (a mirror housing, a door shell) to the hinge
 * that already contains them. Shared vertices stay together; other islands in
 * the same buffer, such as the steering wheel, stay on the body.
 */
export function adoptShapedDoorIslands(
  pivots: Array<THREE.Group | null>,
  shapes?: DoorIslandShape[],
) {
  const live = pivots.filter((pivot): pivot is THREE.Group => pivot !== null);
  if (!shapes?.length || live.length === 0) {
    return;
  }

  const claims = live.flatMap((pivot) => {
    const bounds = closedDoorBounds(pivot);
    if (!bounds) {
      return [];
    }
    return [{ pivot, box: bounds, center: bounds.getCenter(new THREE.Vector3()) }];
  });
  if (claims.length === 0) {
    return;
  }

  const corner = new THREE.Vector3();
  for (const shape of shapes) {
    const candidates: THREE.Mesh[] = [];
    live[0].parent?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !matchesAny(hierarchicalName(mesh), shape.source)) {
        return;
      }
      if (live.some((pivot) => isUnderPivot(mesh, pivot))) {
        return;
      }
      if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
        return;
      }
      candidates.push(mesh);
    });

    for (const mesh of candidates) {
      const position = mesh.geometry.getAttribute("position");
      if (!position) {
        continue;
      }
      mesh.updateWorldMatrix(true, false);
      const islands = weldTriangleIslands(
        mesh.geometry,
        connectedTriangleIslands(mesh.geometry),
        mesh.matrixWorld,
        shape.weld,
      );
      const owned: Array<{ pivot: THREE.Group; triangles: number[] }> = [];
      const stayTriangles: number[] = [];

      for (const island of islands) {
        if (island.length < shape.minTriangles || island.length > shape.maxTriangles) {
          stayTriangles.push(...island);
          continue;
        }
        const islandBox = new THREE.Box3();
        for (const triangle of island) {
          for (let index = 0; index < 3; index += 1) {
            corner.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, index));
            corner.applyMatrix4(mesh.matrixWorld);
            islandBox.expandByPoint(corner);
          }
        }
        const centroid = islandBox.getCenter(new THREE.Vector3());
        let owner: (typeof claims)[number] | null = null;
        let bestDistance = Infinity;
        for (const claim of claims) {
          if (!islandFitsDoor(shape, islandBox, claim.box)) {
            continue;
          }
          const distance = centroid.distanceTo(claim.center);
          if (distance < bestDistance) {
            owner = claim;
            bestDistance = distance;
          }
        }
        if (!owner) {
          stayTriangles.push(...island);
          continue;
        }
        owned.push({ pivot: owner.pivot, triangles: [...island] });
      }

      if (owned.length === 0) {
        continue;
      }
      for (const piece of owned) {
        adoptDoorPiece(mesh, extractTriangleGeometry(mesh.geometry, piece.triangles), piece.pivot);
      }
      const triangleCount = mesh.geometry.getIndex()
        ? mesh.geometry.getIndex()!.count / 3
        : position.count / 3;
      if (stayTriangles.length === 0) {
        mesh.removeFromParent();
      } else if (stayTriangles.length !== triangleCount) {
        mesh.geometry = extractTriangleGeometry(mesh.geometry, stayTriangles);
      }
    }
  }
}

export function createTrunkPivot(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  hingeMeshes?: THREE.Mesh[],
) {
  if (meshes.length === 0) {
    return null;
  }

  // Interior trim must not pull the axis off the roof seam.
  const hingeSource = (hingeMeshes ?? []).filter((mesh) =>
    meshes.some((candidate) => candidate.uuid === mesh.uuid),
  );
  const hingeBox = new THREE.Box3();
  for (const mesh of hingeSource.length > 0 ? hingeSource : meshes) {
    hingeBox.expandByObject(mesh);
  }

  // Showroom -X is forward. The liftgate spins about the shell's top-forward
  // edge (the roof seam). A rearward axis swings that edge away from the roof.
  const hingeWorld = new THREE.Vector3(
    hingeBox.min.x,
    hingeBox.max.y,
    (hingeBox.min.z + hingeBox.max.z) / 2,
  );
  const pivot = createHingePivot(root, hingeWorld, "x");

  for (const mesh of meshes) {
    pivot.attach(mesh);
  }

  return pivot;
}

/** How far the glass travels rearward, as a fraction of its fore-aft span. */
export const SUNROOF_SLIDE_FRACTION = 0.55;

/**
 * Rise of the outer skin from front to rear, in showroom world units (Y per X).
 * Showroom -X is forward, so a fastback roof is a small negative slope.
 */
export function roofChordSlope(node: THREE.Object3D) {
  const mesh = node as THREE.Mesh;
  const position = mesh.isMesh ? mesh.geometry.getAttribute("position") : null;
  if (!position || position.count < 3) {
    return 0;
  }
  mesh.updateWorldMatrix(true, false);
  const sample = new THREE.Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  const stride = Math.max(1, Math.floor(position.count / 2500));
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index += stride) {
    sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    points.push(sample.clone());
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
  }
  const span = maxX - minX;
  if (span < 1e-3) {
    return 0;
  }
  const band = span * 0.18;
  let frontY = -Infinity;
  let rearY = -Infinity;
  let frontX = 0;
  let rearX = 0;
  let frontCount = 0;
  let rearCount = 0;
  for (const point of points) {
    if (point.x <= minX + band) {
      frontY = Math.max(frontY, point.y);
      frontX += point.x;
      frontCount += 1;
    } else if (point.x >= maxX - band) {
      rearY = Math.max(rearY, point.y);
      rearX += point.x;
      rearCount += 1;
    }
  }
  if (frontCount === 0 || rearCount === 0) {
    return 0;
  }
  const run = rearX / rearCount - frontX / frontCount;
  if (Math.abs(run) < 1e-3) {
    return 0;
  }
  return (rearY - frontY) / run;
}

/** Store base local pose + parent-local open delta so the glass slides along the roof. */
export function prepareSunroofMotion(nodes: THREE.Object3D[], slideFraction = SUNROOF_SLIDE_FRACTION) {
  for (const node of nodes) {
    node.userData.showroomSunroofBasePos = node.position.clone();
    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Showroom +X is rearward. Follow the roof chord so the panel stays on the
    // body instead of popping up above it.
    const slide = Math.max(0.16, size.x * slideFraction);
    const worldDelta = new THREE.Vector3(slide, roofChordSlope(node) * slide, 0);
    node.userData.showroomSunroofOpenDelta = worldDeltaToParentLocal(node, worldDelta);
  }
}

/**
 * SU7 Max bakes the steering wheel into the cabin shell, so there is no named rim.
 * A vertical ring in the front cabin is the wheel. The generic cockpit guess sits
 * behind that ring, inside the rear structure, and looks through an octagonal hole.
 */
export function findCabinSteeringRing(root: THREE.Object3D, bounds: THREE.Box3) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const points: THREE.Vector3[] = [];
  const sample = new THREE.Vector3();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomWheel) {
      return;
    }
    const name = hierarchicalName(mesh);
    if (/(3DWheel|Wheel1A|tyre|tire|\bwheel\b|brake|caliper|calliper)/i.test(name)) {
      return;
    }
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      return;
    }
    mesh.updateWorldMatrix(true, false);
    const stride = Math.max(1, Math.floor(position.count / 900));
    for (let index = 0; index < position.count; index += stride) {
      sample.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      const inFront =
        sample.x > bounds.min.x + size.x * 0.22 && sample.x < center.x + size.x * 0.02;
      const inCabin =
        sample.y > bounds.min.y + size.y * 0.5 && sample.y < bounds.min.y + size.y * 0.84;
      const offCenter = Math.abs(sample.z - center.z);
      const onSide = offCenter > size.z * 0.08 && offCenter < size.z * 0.4;
      if (inFront && inCabin && onSide) {
        points.push(sample.clone());
      }
    }
  });
  if (points.length < 40) {
    return null;
  }

  let bestScore = 0;
  let best: THREE.Vector3 | null = null;
  const xStart = bounds.min.x + size.x * 0.3;
  const xEnd = center.x - size.x * 0.05;
  for (let x = xStart; x <= xEnd; x += 0.05) {
    for (let y = bounds.min.y + size.y * 0.55; y <= bounds.min.y + size.y * 0.78; y += 0.04) {
      for (let side = -1; side <= 1; side += 2) {
        for (let lateral = size.z * 0.12; lateral <= size.z * 0.32; lateral += 0.04) {
          const z = center.z + side * lateral;
          const radii: number[] = [];
          const sectors = new Set<number>();
          for (const point of points) {
            if (Math.abs(point.x - x) > 0.08) {
              continue;
            }
            const dy = point.y - y;
            const dz = point.z - z;
            const radius = Math.hypot(dy, dz);
            if (radius < 0.1 || radius > 0.22) {
              continue;
            }
            radii.push(radius);
            const angle = Math.atan2(dy, dz);
            sectors.add(Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8);
          }
          if (radii.length < 28 || sectors.size < 6) {
            continue;
          }
          radii.sort((left, right) => left - right);
          const median = radii[Math.floor(radii.length / 2)] ?? 0;
          let deviation = 0;
          for (const radius of radii) {
            deviation += Math.abs(radius - median);
          }
          deviation /= radii.length;
          if (deviation > 0.03) {
            continue;
          }
          const score = radii.length / (deviation + 0.004);
          if (score > bestScore) {
            bestScore = score;
            best = new THREE.Vector3(x, y, z);
          }
        }
      }
    }
  }
  return best;
}

/**
 * Steering-wheel rim center in world space.
 * Q3 names the wheel `Staring` (and its stitch `Stich_SW`). Dashboard shells that
 * share that prefix span the cabin and are ignored.
 */
export function findSteeringWheelCenter(
  root: THREE.Object3D,
  carSize: THREE.Vector3,
  bounds: THREE.Box3,
  profile: MarketRigProfile | null,
) {
  type Candidate = { mesh: THREE.Mesh; center: THREE.Vector3; volume: number };
  const candidates: Candidate[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const pathName = hierarchicalName(mesh);
    const profileSteering = (profile?.steeringWheel?.length ?? 0) > 0;
    const namedSteering = profileSteering
      ? matchesAny(pathName, profile?.steeringWheel)
      : /(staring|steering[\s_-]?wheel|leather[_\s-]?wheel)/i.test(pathName);
    if (!mesh.isMesh || !namedSteering) {
      return;
    }
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) {
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    if (size.x > carSize.x * 0.28 || size.z > carSize.z * 0.5) {
      return;
    }
    candidates.push({
      mesh,
      center: box.getCenter(new THREE.Vector3()),
      volume: Math.max(size.x * size.y * size.z, 1e-6),
    });
  });
  if (candidates.length === 0) {
    return profile?.id === "xiaomi-su7-max" ? findCabinSteeringRing(root, bounds) : null;
  }
  const hub = candidates.reduce((best, item) => (item.volume > best.volume ? item : best));
  const reach = Math.min(0.34, Math.max(carSize.y, carSize.z) * 0.22);
  const cluster = candidates.filter((item) => item.center.distanceTo(hub.center) <= reach);
  const rim = cluster.find((item) => /stich|stitch/i.test(item.mesh.name));
  if (rim) {
    return rim.center.clone();
  }
  const clusterBox = new THREE.Box3();
  for (const item of cluster) {
    clusterBox.expandByObject(item.mesh);
  }
  return clusterBox.getCenter(new THREE.Vector3());
}

export type OffroadPanelId = "FL" | "FR" | "RL" | "RR" | "tail";

export type OffroadCabinPanels = {
  leftFront: THREE.Mesh[];
  rightFront: THREE.Mesh[];
  leftRear: THREE.Mesh[];
  rightRear: THREE.Mesh[];
  tailgate: THREE.Mesh[];
};

export type OffroadPanelClaim = { panel: OffroadPanelId; shell: boolean };

export function meshMaterialLabel(mesh: THREE.Mesh) {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return material.map((entry) => entry.name).join(" ");
  }
  return material?.name ?? "";
}

/**
 * G900 door skins, window frames, and the barn-door tailgate are loose triangle
 * islands inside material-wide buffers. Fractions are of the normalized showroom
 * bounds (length 4, forward = -X, left = +Z), measured on this asset.
 */
export function classifyOffroadCabinTriangle(point: THREE.Vector3, bounds: THREE.Box3) {
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeY = bounds.max.y - bounds.min.y;
  const sizeZ = bounds.max.z - bounds.min.z;
  if (sizeX < 1e-4 || sizeY < 1e-4 || sizeZ < 1e-4) {
    return null;
  }
  const tx = (point.x - bounds.min.x) / sizeX;
  const ty = (point.y - bounds.min.y) / sizeY;
  const tz = (point.z - bounds.min.z) / sizeZ;

  // Rear barn door, including the spare. The roof spoiler above it stays put.
  if (tx > 0.86 && tx < 1.04 && ty > 0.3 && ty < 0.93 && tz > 0.16 && tz < 0.84) {
    return { panel: "tail" as const, shell: false };
  }
  if (ty < 0.24 || ty > 0.9) {
    return null;
  }
  const side = tz > 0.82 && tz < 1.06 ? "L" : tz > 0 && tz < 0.22 ? "R" : null;
  if (!side) {
    return null;
  }
  const axle = tx > 0.25 && tx < 0.525 ? "F" : tx > 0.545 && tx < 0.73 ? "R" : null;
  if (!axle) {
    return null;
  }
  // Outer lower paint only — mirrors and door cards must not pull the hinge.
  const shell = ty < 0.62 && (side === "L" ? tz > 0.89 : tz < 0.11);
  return { panel: `${axle}${side}` as OffroadPanelId, shell };
}

export function shouldSkipOffroadPanelMesh(mesh: THREE.Mesh) {
  if (!mesh.geometry || mesh.userData.showroomCabinPanel || mesh.userData.showroomHeadlampCover) {
    return true;
  }
  if (mesh.userData.showroomHeadlampIsland || mesh.userData.showroomWheelPiece) {
    return true;
  }
  if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
    return true;
  }
  return /left_wheel|right_wheel|michelin|rimdetail|diamondcutrim|wheel_track|_gt_34_|_gt_35_|smallspecmap|leather.?wheel|steering|\btire\b|monoblock/i.test(
    hierarchicalName(mesh),
  );
}

export function adoptOffroadPanelPiece(
  source: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  panel: OffroadPanelId,
  shell: boolean,
) {
  const piece = new THREE.Mesh(geometry, source.material);
  piece.name = `${source.name}_${panel}${shell ? "_shell" : ""}`;
  piece.castShadow = source.castShadow;
  piece.receiveShadow = source.receiveShadow;
  piece.position.copy(source.position);
  piece.quaternion.copy(source.quaternion);
  piece.scale.copy(source.scale);
  piece.userData.showroomCabinPanel = panel;
  if (shell) {
    piece.userData.showroomDoorShell = true;
  }
  if (source.userData.showroomHeadlampResidual) {
    piece.userData.showroomHeadlampResidual = true;
  }
  source.parent?.add(piece);
  return piece;
}

/**
 * Cut G900 door and tailgate islands out of shared material buffers so each
 * panel can hinge on its own. The roof sheet has no sunroof opening and is left
 * on the body.
 */
export function splitOffroadCabinPanels(
  root: THREE.Object3D,
  bounds: THREE.Box3,
  classify: (point: THREE.Vector3, materialName: string) => OffroadPanelClaim | null = (point) =>
    classifyOffroadCabinTriangle(point, bounds),
): OffroadCabinPanels {
  const panels: OffroadCabinPanels = {
    leftFront: [],
    rightFront: [],
    leftRear: [],
    rightRear: [],
    tailgate: [],
  };
  const candidates: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || shouldSkipOffroadPanelMesh(mesh)) {
      return;
    }
    candidates.push(mesh);
  });

  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const assign = (panel: OffroadPanelId, piece: THREE.Mesh) => {
    if (panel === "FL") panels.leftFront.push(piece);
    else if (panel === "FR") panels.rightFront.push(piece);
    else if (panel === "RL") panels.leftRear.push(piece);
    else if (panel === "RR") panels.rightRear.push(piece);
    else panels.tailgate.push(piece);
  };

  for (const mesh of candidates) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    const groups = new Map<string, { panel: OffroadPanelId; shell: boolean; triangles: number[] }>();
    const stay: number[] = [];

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      const claim = classify(centroid, meshMaterialLabel(mesh));
      if (!claim) {
        stay.push(triangle);
        continue;
      }
      const key = `${claim.panel}:${claim.shell ? "shell" : "trim"}`;
      const bucket = groups.get(key);
      if (bucket) {
        bucket.triangles.push(triangle);
      } else {
        groups.set(key, { panel: claim.panel, shell: claim.shell, triangles: [triangle] });
      }
    }

    if (groups.size === 0) {
      continue;
    }
    const keepSourceName = groups.size === 1 && stay.length === 0;
    for (const bucket of groups.values()) {
      const piece = adoptOffroadPanelPiece(
        mesh,
        extractTriangleGeometry(mesh.geometry, bucket.triangles),
        bucket.panel,
        bucket.shell,
      );
      if (keepSourceName) {
        piece.name = mesh.name;
      }
      assign(bucket.panel, piece);
    }
    if (stay.length === 0) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    } else {
      const sourceGeometry = mesh.geometry;
      mesh.geometry = extractTriangleGeometry(sourceGeometry, stay);
      sourceGeometry.dispose();
    }
  }

  return panels;
}

/**
 * Barn tailgate swings sideways about one rear jamb, spare included.
 * Left (G-Class) uses the +Z edge. Right (Wrangler in this asset) uses the -Z edge.
 * `hingeFace` `body` sits on the cabin shut line; `outer` sits on the rear skin.
 */
export function createBarnTailgatePivot(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  hingeMeshes?: THREE.Mesh[],
  hingeSide: "left" | "right" = "left",
  hingeFace: "outer" | "body" = "outer",
  hingeInset = 0,
) {
  if (meshes.length === 0) {
    return null;
  }
  const authoredHinge = (hingeMeshes ?? []).filter((mesh) =>
    meshes.some((candidate) => candidate.uuid === mesh.uuid),
  );
  const markedShells = meshes.filter((mesh) => mesh.userData.showroomDoorShell);
  const shells =
    authoredHinge.length > 0
      ? authoredHinge
      : markedShells.length > 0
        ? markedShells
        : meshes.filter((mesh) => {
            if (/spare|m_carbon_a/i.test(mesh.name)) {
              return false;
            }
            const shellSize = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
            return shellSize.x < 0.22 && shellSize.z > 0.35;
          });
  const hingeBox = new THREE.Box3();
  for (const mesh of shells.length > 0 ? shells : meshes) {
    hingeBox.expandByObject(mesh);
  }
  const outerZ = hingeSide === "right" ? hingeBox.min.z : hingeBox.max.z;
  const inboard = hingeSide === "right" ? hingeInset : -hingeInset;
  const hingeWorld = new THREE.Vector3(
    hingeFace === "body" ? hingeBox.min.x : hingeBox.max.x,
    hingeBox.min.y + (hingeBox.max.y - hingeBox.min.y) * 0.55,
    outerZ + inboard,
  );
  const pivot = createHingePivot(root, hingeWorld, "y");
  for (const mesh of meshes) {
    pivot.attach(mesh);
  }
  // The free edge travels rearward (+X). Sign depends on which jamb is fixed.
  pivot.userData.showroomOpenSign = hingeSide === "right" ? 1 : -1;
  pivot.userData.showroomSide = "tailgate";
  return pivot;
}

export function doorShellMeshes(meshes: THREE.Mesh[]) {
  return meshes.filter((mesh) => mesh.userData.showroomDoorShell);
}
