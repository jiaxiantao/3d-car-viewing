import * as THREE from "three";
import { resolveMarketRigProfile, type MarketRigProfile } from "@/lib/market-rig-profiles";
import { hideMisplacedTemplateWheels } from "@/lib/asset-showroom-wheels";

export const ASSET_DOOR_MAX_OPEN_RADIANS = (70 * Math.PI) / 180;
export const ASSET_TRUNK_MAX_OPEN_RADIANS = (75 * Math.PI) / 180;

/** Upper bound for GLB headlamp emissive (toneMapped off on lens materials). */
export const SHOWROOM_HEADLAMP_INTENSITY = {
  on: 10,
  engineOn: 12,
  minEmissive: 16,
  emissiveScale: 3.4,
} as const;

/** Hazard blink — keep saturation; high HDR intensity reads white on screen. */
export const SHOWROOM_HAZARD_INTENSITY = {
  on: 5.5,
  withHeadlights: 2.2,
  /** Cap emissive so red stays red (not blown out to white). */
  tailMax: 6.2,
  tailMin: 2.8,
} as const;

export const SHOWROOM_TAIL_LAMP_COLOR = 0xc81e1e;

export type ShowroomSpinAxis = "x" | "y" | "z";

export type AssetRigDebugPart = {
  key:
    | "leftDoor"
    | "rightDoor"
    | "trunk"
    | "sunroof"
    | "headLights"
    | "tailLights"
    | "hazardLights"
    | "paint"
    | "frontWheels"
    | "rearWheels";
  label: string;
  interactive: boolean;
  count: number;
  items: string[];
};

export type AssetCarRig = {
  bounds: THREE.Box3;
  leftDoorPivot: THREE.Group | null;
  rightDoorPivot: THREE.Group | null;
  trunkPivot: THREE.Group | null;
  sunroofNodes: THREE.Object3D[];
  headLightMaterials: ShowroomMaterial[];
  /** World-space lamp centers for showroom spotlight placement. */
  headLightPositions: THREE.Vector3[];
  /** Body paint materials (profile-driven or auto-discovered). */
  paintMaterials: ShowroomMaterial[];
  tailLightMaterials: ShowroomMaterial[];
  hazardMaterials: ShowroomMaterial[];
  /**
   * Real GLB wheel nodes that spin in place about their own axle.
   * No helper/pivot nodes are added — each node carries `userData.showroomWheel`
   * spin metadata and is rotated via {@link applyWheelMotion}.
   */
  frontWheels: THREE.Object3D[];
  rearWheels: THREE.Object3D[];
  /** Effective rolling radius for wheel spin speed (meters, post-normalize). */
  wheelRollRadius: number;
  /** World-space center of the steering wheel rim, when the GLB has one. */
  steeringWheelCenter: THREE.Vector3 | null;
  /** Human-readable summary for UI / debugging. */
  capabilities: {
    leftDoor: boolean;
    rightDoor: boolean;
    trunk: boolean;
    sunroof: boolean;
    headLights: boolean;
    tailLights: boolean;
    wheels: boolean;
    /** True when corner rollers are procedural (body has no separable wheel meshes). */
    wheelsSynthetic: boolean;
  };
  debug: {
    profileId: string | null;
    parts: AssetRigDebugPart[];
  };
};

type MeshEntry = {
  mesh: THREE.Mesh;
  name: string;
  materialName: string;
  center: THREE.Vector3;
  size: THREE.Vector3;
  volume: number;
};

function getSourceMaterialName(mesh: THREE.Mesh) {
  const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return sources
    .map((entry) => entry?.name ?? "")
    .filter(Boolean)
    .join(" ");
}

type ShowroomMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial
  | THREE.MeshPhongMaterial
  | THREE.MeshLambertMaterial;

function isShowroomCompatibleMaterial(material: THREE.Material): material is ShowroomMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial ||
    material instanceof THREE.MeshPhongMaterial ||
    material instanceof THREE.MeshLambertMaterial
  );
}

const DOOR_EXCLUDE =
  /(tail[_\s-]?lamp|door[_\s-]?int|door_int|interior|boot|lock|carpet|icon|speaker|seat|rubber|clamp|wind|windsh|glass_red|hl_cover|technology|primeam)/i;
const DOOR_INCLUDE =
  /(door[_\s-]?black|door[_\s-]?soft|door[_\s-]?rubber|door[_\s-]?plastic|door[_\s-]?noise)/i;

function hierarchicalName(object: THREE.Object3D): string {
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

function matchesAny(name: string, patterns?: RegExp[]) {
  if (!patterns?.length) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(name));
}

function getMeshVolume(mesh: THREE.Mesh) {
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(mesh).getSize(size);
  return Math.max(size.x * size.y * size.z, 1e-6);
}

export function ensureShowroomMaterial(
  mesh: THREE.Mesh,
  preferMaterialName?: (materialName: string) => boolean,
): ShowroomMaterial | null {
  const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const cachedByName = (mesh.userData.showroomMaterialByName ??
    {}) as Record<string, ShowroomMaterial>;
  const cacheKey = preferMaterialName ? "__preferred__" : "__first__";
  if (cachedByName[cacheKey]) {
    return cachedByName[cacheKey];
  }

  let selectedIndex = -1;
  for (let index = 0; index < sources.length; index += 1) {
    const entry = sources[index];
    if (!isShowroomCompatibleMaterial(entry)) {
      continue;
    }
    if (!preferMaterialName || preferMaterialName(entry.name ?? "")) {
      selectedIndex = index;
      break;
    }
  }
  if (selectedIndex < 0) {
    return null;
  }

  const source = sources[selectedIndex];
  if (!isShowroomCompatibleMaterial(source)) {
    return null;
  }
  const cloned = source.clone();
  const emissiveHsl = { h: 0, s: 0, l: 0 };
  source.emissive.getHSL(emissiveHsl);
  const hasAuthoredEmissive = (source.emissiveIntensity ?? 0) > 0.02 || emissiveHsl.l > 0.02;
  const emissiveBase = hasAuthoredEmissive
    ? source.emissive.clone()
    : source.color
      ? source.color.clone()
      : new THREE.Color(0, 0, 0);
  cloned.userData.showroomBaseEmissive = emissiveBase;
  cloned.userData.showroomBaseEmissiveIntensity = source.emissiveIntensity ?? 0;

  if (Array.isArray(mesh.material)) {
    const nextMaterials = [...mesh.material];
    nextMaterials[selectedIndex] = cloned;
    mesh.material = nextMaterials;
  } else {
    mesh.material = cloned;
  }
  cachedByName[cacheKey] = cloned;
  mesh.userData.showroomMaterialByName = cachedByName;
  return cloned;
}

/** Clone body-paint materials separately from lamp clones. */
export function ensureShowroomPaintMaterial(mesh: THREE.Mesh): ShowroomMaterial | null {
  const cached = mesh.userData.showroomPaintMaterial as ShowroomMaterial | undefined;
  if (cached) {
    return cached;
  }
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!isShowroomCompatibleMaterial(source)) {
    return null;
  }
  const cloned = source.clone();
  cloned.userData.showroomBaseColor = source.color.clone();
  mesh.userData.showroomPaintMaterial = cloned;
  mesh.material = cloned;
  return cloned;
}

function isExcludedPart(name: string) {
  return /(camera|helper|gizmo|locator|steer|column)/i.test(name);
}

function isInteriorLight(name: string) {
  return /(interior|int_|roof.*lamp|roof.*light|icon|speaker|control_light)/i.test(name);
}

function isHeadLightPart(name: string, center: THREE.Vector3, frontX: number) {
  if (isInteriorLight(name)) {
    return false;
  }
  if (/(^|\/)(light1|lightled|glowtext)(_|\.|$)/i.test(name)) {
    return false;
  }
  // Keep `nlightsf` for Brabus inner lenses; exclude other nlights* via profile only.
  if (/(^|\/)nlights(?!f)/i.test(name)) {
    return false;
  }
  return (
    /(?:^|[^a-z])hl\d|[^a-z]hl_|head\s*light|headlight|projection[_\s-]?lamp|hl_chrome|hl_cover|hl_inner|lights_lod0/i.test(
      name,
    ) || (center.x < frontX && /lamp|chrome[_\s-]?light/i.test(name) && !/tail|rear/i.test(name))
  );
}

function isOffroadHeadlampMesh(name: string) {
  return /lights_lod0|lamp_alpha|\/\d+_lights_0|nlightsf/i.test(name);
}

function isBmwM2HeadlampMaterial(materialName: string) {
  return /LightA(?:_Material\d*)?/i.test(materialName) || /LightA(?!.*Emissive)/i.test(materialName);
}

function isBmwM2TailMaterial(materialName: string) {
  return /red_glass|LightEmissiveA/i.test(materialName);
}

function isSuvHeadlampMesh(name: string) {
  if (/tail|taillamp|door_tail|int_|interior|door_int|roof_control/i.test(name)) {
    return false;
  }
  return (
    /\bHL\d_Mesh/i.test(name) ||
    /Hl_Projection_lamp|Hl_inner_glass/i.test(name) ||
    /HL_Chrome|Hl_Cover/i.test(name)
  );
}

function isExcludedFromHeadlightDiscovery(name: string) {
  return /tail|taillamp|door_tail_lamp|int_|interior|door_int.*light|roof_control/i.test(
    name,
  );
}

function applyShowroomHeadlampLens(material: ShowroomMaterial) {
  const lampColor = new THREE.Color(0xffffff);
  material.userData.showroomHeadlampLens = true;
  material.userData.showroomBaseEmissive = lampColor;
  material.userData.showroomBaseEmissiveIntensity = 0;
  material.userData.showroomBaseColor = material.color.clone();
  material.emissive.copy(lampColor);
}

function applyShowroomTailLamp(material: ShowroomMaterial) {
  const lampColor = new THREE.Color(SHOWROOM_TAIL_LAMP_COLOR);
  material.userData.showroomTailLamp = true;
  material.userData.showroomBaseEmissive = lampColor;
  material.userData.showroomBaseEmissiveIntensity = 0;
  material.emissive.copy(lampColor);
}

function taillampPositionAllowed(
  profile: MarketRigProfile | null,
  profileTailLight: boolean,
  materialName: string,
  meshCenter: THREE.Vector3,
  bounds: THREE.Box3,
) {
  if (profile?.id === "bmw-m2" && profileTailLight && isBmwM2TailMaterial(materialName)) {
    if (/LightEmissiveA/i.test(materialName)) {
      return true;
    }
    const size = bounds.getSize(new THREE.Vector3());
    return meshCenter.x >= bounds.max.x - size.x * 0.28;
  }
  return true;
}

function shouldApplyHeadlampLensPreset(
  profile: MarketRigProfile | null,
  profileHeadLight: boolean,
) {
  return (
    profileHeadLight &&
    (profile?.id === "offroad-brabus" ||
      profile?.id === "suv-q3" ||
      profile?.id === "bmw-m2")
  );
}

function headlampPositionAllowed(
  profile: MarketRigProfile | null,
  profileHeadLight: boolean,
  name: string,
  materialName: string,
  meshCenter: THREE.Vector3,
  meshSize: THREE.Vector3,
  bounds: THREE.Box3,
  carCenter: THREE.Vector3,
  depth: number,
  width: number,
) {
  if (profile?.id === "offroad-brabus" && profileHeadLight && isOffroadHeadlampMesh(name)) {
    return true;
  }
  if (profile?.id === "suv-q3" && profileHeadLight && isSuvHeadlampMesh(name)) {
    return true;
  }
  if (profile?.id === "bmw-m2" && profileHeadLight && isBmwM2HeadlampMaterial(materialName)) {
    return true;
  }
  const isLocalizedPanel =
    meshSize.x <= depth * 0.55 && meshSize.z <= width * 0.62;
  return (
    isPlausibleHeadlampPosition(meshCenter, bounds, carCenter) ||
    (profileHeadLight && isLocalizedPanel)
  );
}

/** Headlamps sit at the front corners, not the grille badge or roof LED strip. */
function isPlausibleHeadlampPosition(
  center: THREE.Vector3,
  bounds: THREE.Box3,
  carCenter: THREE.Vector3,
) {
  const size = bounds.getSize(new THREE.Vector3());
  const nearFront = center.x <= bounds.min.x + size.x * 0.22;
  const sideMounted = Math.abs(center.z - carCenter.z) >= size.z * 0.1;
  const notRoofStrip = center.y <= bounds.min.y + size.y * 0.72;
  return nearFront && sideMounted && notRoofStrip;
}

function isTailLightPart(name: string, center: THREE.Vector3, rearX: number) {
  if (isInteriorLight(name)) {
    return false;
  }
  return (
    /tail[_\s-]?lamp|taillight|tail\s*light|rear\s*light|stop\s*light|brake\s*light|tail_upper|tail_inner|tail_cover/i.test(
      name,
    ) ||
    (/(emiss|red_cover)/i.test(name) && center.x > rearX)
  );
}

function isHazardPart(name: string) {
  return /(hazard|indicator|turn|emiss|amber)/i.test(name) && /(tail|lamp|light|rear)/i.test(name);
}

function isTrunkPart(name: string) {
  return (
    /boot[_\s-]?ext/i.test(name) &&
    !/wind|windsh|int|interior|net|nameboard|clamp/i.test(name)
  );
}

function isDoorCandidate(name: string, profile: MarketRigProfile | null) {
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

function isSunroofPart(name: string) {
  return /(sunroof|moon\s*roof)/i.test(name) || (/roof/i.test(name) && /glass/i.test(name));
}

function collectMeshes(root: THREE.Object3D) {
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
function createHingePivot(
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

function createSideDoorPivot(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  side: "left" | "right",
  hingeMeshes?: THREE.Mesh[],
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

  const doorCenter = doorBox.getCenter(new THREE.Vector3());
  const openSign = doorCenter.z >= 0 ? -1 : 1;
  // Outer skin is max.z on +Z (left) and min.z on -Z (right). Pull the axis
  // inboard so it sits against the body instead of on the outer paint.
  const doorDepthZ = doorBox.max.z - doorBox.min.z;
  const inward = Math.min(0.055, doorDepthZ * 0.4);
  const hingeZ = doorCenter.z >= 0 ? doorBox.max.z - inward : doorBox.min.z + inward;
  const doorSpanX = doorBox.max.x - doorBox.min.x;
  // Showroom -X is forward. The axis sits on the leading face (slightly ahead of
  // the paint) so the A-pillar edge stays against the fender as the door swings.
  const hingeX = doorBox.min.x - doorSpanX * 0.01;

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

function isUnderPivot(object: THREE.Object3D, pivot: THREE.Object3D | null) {
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

function closedDoorBounds(pivot: THREE.Object3D | null) {
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
function frontDoorClaimBox(doorBox: THREE.Box3) {
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

function triangleCorner(geometry: THREE.BufferGeometry, triangle: number, corner: number) {
  const index = geometry.getIndex();
  return index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
}

function extractTriangleGeometry(geometry: THREE.BufferGeometry, triangles: number[]) {
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

function adoptDoorPiece(source: THREE.Mesh, geometry: THREE.BufferGeometry, pivot: THREE.Group) {
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
function splitSpanningDoorTrim(
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

function createTrunkPivot(
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

/** Store base local pose + parent-local open delta so the glass slides along the roof. */
function prepareSunroofMotion(nodes: THREE.Object3D[]) {
  for (const node of nodes) {
    node.userData.showroomSunroofBasePos = node.position.clone();
    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Slide toward rear (+X) with a slight lift — scale from the panel's world size.
    const slide = Math.max(0.18, Math.max(size.x, size.z) * 0.42);
    const worldDelta = new THREE.Vector3(slide, Math.max(0.02, size.y * 0.5 + 0.02), 0);
    node.userData.showroomSunroofOpenDelta = worldDeltaToParentLocal(node, worldDelta);
  }
}

/**
 * Steering-wheel rim center in world space.
 * Q3 names the wheel `Staring` (and its stitch `Stich_SW`). Dashboard shells that
 * share that prefix span the cabin and are ignored.
 */
function findSteeringWheelCenter(root: THREE.Object3D, carSize: THREE.Vector3) {
  type Candidate = { mesh: THREE.Mesh; center: THREE.Vector3; volume: number };
  const candidates: Candidate[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !/(staring|steering[\s_-]?wheel|leather[_\s-]?wheel)/i.test(hierarchicalName(mesh))) {
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
    return null;
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

/** Names that contain "wheel" but are not road wheels (spare, steering, trim). */
function isWheelMeshName(name: string) {
  if (
    /(spare|sparewheel|leather.?wheel|steering.?wheel|wheel_track|rimdetail|hubcap|diamondcutrim)/i.test(
      name,
    )
  ) {
    return false;
  }
  // Q3 brake calipers live in `Alloy_Break` and must stay fixed while the tyre rolls.
  if (/(caliper|brake\s*disc|brake\s*pad|fender|arch|alloy[_\s-]?break)/i.test(name)) {
    return false;
  }
  return /(wheel|tire|tyre|rim)/i.test(name);
}

function spansBothAxles(size: THREE.Vector3, carSize: THREE.Vector3) {
  return size.x > carSize.x * 0.4 && size.z > carSize.z * 0.4;
}

function wheelCornerKey(point: THREE.Vector3, center: THREE.Vector3) {
  const front = point.x < center.x;
  const left = point.z > center.z;
  return `${front ? "F" : "R"}${left ? "L" : "R"}`;
}

function adoptWheelPiece(source: THREE.Mesh, geometry: THREE.BufferGeometry, corner: string) {
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

/**
 * Q3 exports one buffer per tyre material with all four corners inside it.
 * Cut each buffer into FL/FR/RL/RR so each corner can roll about its own axle.
 * Brake calipers are left on the body.
 */
function splitSpanningWheelMeshes(root: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(root);
  const carSize = bounds.getSize(new THREE.Vector3());
  const carCenter = bounds.getCenter(new THREE.Vector3());

  const candidates: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomWheelPiece) {
      return;
    }
    if (!isWheelMeshName(hierarchicalName(mesh))) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    if (spansBothAxles(size, carSize)) {
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
    const groups = new Map<string, number[]>();

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
        bucket.push(triangle);
      } else {
        groups.set(key, [triangle]);
      }
    }

    if (groups.size < 2) {
      continue;
    }

    for (const [corner, triangles] of groups) {
      if (triangles.length === 0) {
        continue;
      }
      adoptWheelPiece(mesh, extractTriangleGeometry(mesh.geometry, triangles), corner);
    }
    mesh.removeFromParent();
  }
}

/** Per-wheel spin metadata stored on the real GLB node (no helper nodes added). */
type WheelSpinData = {
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
type WheelUnit = {
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
function collectWheelUnits(
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
    if (!(child as THREE.Mesh).isMesh || !isWheelMeshName(hierarchicalName(child))) {
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
function setupWheelSpin(
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

/** Find the real ground wheels and tag them for in-place rotation. */
function findWheelNodes(root: THREE.Object3D, profile: MarketRigProfile | null) {
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
    // Axle is the thinner horizontal axis (lateral Z after normalize, fallback X).
    const worldAxis =
      unit.size.z <= unit.size.x
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);
    for (const node of unit.nodes) {
      if (setupWheelSpin(node, unit.center, worldAxis, isFront)) {
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

export function discoverAssetCarRig(root: THREE.Object3D, modelUrl?: string): AssetCarRig {
  const profile = resolveMarketRigProfile(modelUrl);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const entries = collectMeshes(root);
  const headLightMaterials: ShowroomMaterial[] = [];
  const headLightPositions: THREE.Vector3[] = [];
  const paintMaterials: ShowroomMaterial[] = [];
  const tailLightMaterials: ShowroomMaterial[] = [];
  const hazardMaterials: ShowroomMaterial[] = [];
  const sunroofNodes: THREE.Object3D[] = [];
  const leftDoorMeshes: THREE.Mesh[] = [];
  const rightDoorMeshes: THREE.Mesh[] = [];
  const trunkMeshes: THREE.Mesh[] = [];
  const headLightDebugItems = new Set<string>();
  const tailLightDebugItems = new Set<string>();
  const hazardDebugItems = new Set<string>();
  const paintDebugItems = new Set<string>();

  const depth = Math.max(size.x, 0.001);
  const width = Math.max(size.z, 0.001);
  const frontX = bounds.min.x + depth * 0.2;
  const rearX = bounds.max.x - depth * 0.2;
  const frontDoorX = bounds.min.x + depth * 0.58;
  const leftZ = bounds.min.z + width * 0.32;
  const rightZ = bounds.max.z - width * 0.32;

  // A genuine door / trunk lid is a localized panel, never a body-spanning mesh.
  // Reject meshes whose footprint covers most of the car (merged/material-grouped bodies).
  const isLocalizedPanel = (meshSize: THREE.Vector3) =>
    meshSize.x <= depth * 0.55 && meshSize.z <= width * 0.62;

  const profileHasDoors =
    (profile?.leftDoor?.length ?? 0) > 0 || (profile?.rightDoor?.length ?? 0) > 0;

  for (const entry of entries) {
    const { mesh, name, materialName, center: meshCenter, size: meshSize } = entry;
    const nameLower = name.toLowerCase();
    const materialLower = materialName.toLowerCase();
    const label = `${nameLower} ${materialLower}`;

    // Exclusive market door lists win first so INT trim (e.g. Soft_Black_Pattern)
    // is never stolen by paint / lamp heuristics.
    if (profileHasDoors) {
      if (matchesAny(name, profile?.leftDoor)) {
        leftDoorMeshes.push(mesh);
        continue;
      }
      if (matchesAny(name, profile?.rightDoor)) {
        rightDoorMeshes.push(mesh);
        continue;
      }
    }

    if (matchesAny(name, profile?.sunroof) || isSunroofPart(nameLower)) {
      if (!isInteriorLight(nameLower)) {
        sunroofNodes.push(mesh);
      }
      continue;
    }

    if (matchesAny(name, profile?.paintMaterial) || matchesAny(materialName, profile?.paintMaterial)) {
      const material = ensureShowroomPaintMaterial(mesh);
      if (material) {
        paintMaterials.push(material);
        paintDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
      }
      continue;
    }

    const profileHeadLight =
      matchesAny(name, profile?.headLight) ||
      matchesAny(materialName, profile?.headLightMaterial);
    const headlightMaterialMatcher =
      profile?.headLightMaterial && profile.headLightMaterial.length > 0
        ? (candidateName: string) => matchesAny(candidateName, profile.headLightMaterial)
        : undefined;
    const headLightCandidate =
      profileHeadLight || isHeadLightPart(label, meshCenter, frontX);
    if (
      !isExcludedFromHeadlightDiscovery(nameLower) &&
      headLightCandidate &&
      headlampPositionAllowed(
        profile,
        profileHeadLight,
        name,
        materialName,
        meshCenter,
        meshSize,
        bounds,
        center,
        depth,
        width,
      )
    ) {
      const material = ensureShowroomMaterial(mesh, headlightMaterialMatcher);
      if (material) {
        if (shouldApplyHeadlampLensPreset(profile, profileHeadLight)) {
          applyShowroomHeadlampLens(material);
        }
        headLightMaterials.push(material);
        headLightDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
        // Full-width lamp bars span the bumper; anchor at the front face (showroom forward = -X).
        if (meshSize.z > width * 0.32) {
          if (headLightPositions.length < 2) {
            const lampFrontX = meshCenter.x - meshSize.x * 0.46;
            const halfZ = meshSize.z * 0.42;
            headLightPositions.push(
              new THREE.Vector3(lampFrontX, meshCenter.y, meshCenter.z + halfZ),
              new THREE.Vector3(lampFrontX, meshCenter.y, meshCenter.z - halfZ),
            );
          }
        } else if (meshCenter.x <= frontX) {
          headLightPositions.push(meshCenter.clone());
        }
      }
      continue;
    }

    const profileTailLight =
      matchesAny(name, profile?.tailLight) ||
      matchesAny(materialName, profile?.tailLightMaterial);
    const profileHazardLight =
      matchesAny(name, profile?.hazardLight) ||
      matchesAny(materialName, profile?.hazardLightMaterial);
    const onTrunk = Boolean(profile?.trunk?.length && matchesAny(name, profile.trunk));
    if (
      profileHazardLight ||
      isHazardPart(label) ||
      profileTailLight ||
      isTailLightPart(label, meshCenter, rearX)
    ) {
      // Hatch blades are also tail lamps. Keep the emissive material, and still parent them.
      if (onTrunk) {
        trunkMeshes.push(mesh);
      }
      if (
        profileTailLight &&
        !taillampPositionAllowed(profile, profileTailLight, materialName, meshCenter, bounds)
      ) {
        continue;
      }
      const taillightMaterialMatcher =
        profile?.tailLightMaterial && profile.tailLightMaterial.length > 0
          ? (candidateName: string) => matchesAny(candidateName, profile.tailLightMaterial)
          : undefined;
      const material = ensureShowroomMaterial(mesh, taillightMaterialMatcher);
      if (!material) {
        continue;
      }
      applyShowroomTailLamp(material);
      tailLightMaterials.push(material);
      tailLightDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
      if (
        profileHazardLight ||
        isHazardPart(label) ||
        /emiss|red_cover|red_glass/i.test(label)
      ) {
        hazardMaterials.push(material);
        hazardDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
      }
      continue;
    }

    if (profile?.trunk?.length) {
      if (matchesAny(name, profile.trunk)) {
        trunkMeshes.push(mesh);
        continue;
      }
    } else if (isTrunkPart(nameLower) && isLocalizedPanel(meshSize)) {
      trunkMeshes.push(mesh);
      continue;
    }

    // Exclusive profile doors already claimed above — skip auto-discovery.
    if (profileHasDoors) {
      continue;
    }

    const profileDoor =
      matchesAny(name, profile?.leftDoor) || matchesAny(name, profile?.rightDoor);
    if (!profileDoor && !isDoorCandidate(nameLower, profile)) {
      continue;
    }

    // Geometry gate: skip whole-body panels that merely contain "door" in their name.
    if (!profileDoor && !isLocalizedPanel(meshSize)) {
      continue;
    }

    // Profile-listed door skins always win; frontDoorX only filters auto-discovery.
    if (!profileDoor && meshCenter.x > frontDoorX) {
      continue;
    }

    if (matchesAny(name, profile?.leftDoor) || (!profileDoor && meshCenter.z > leftZ)) {
      leftDoorMeshes.push(mesh);
      continue;
    }

    if (matchesAny(name, profile?.rightDoor) || (!profileDoor && meshCenter.z < rightZ)) {
      rightDoorMeshes.push(mesh);
    }
  }

  // BMW M2 exports can ship with inconsistent lamp material names.
  // If strict profile matching finds no headlamp material, fall back to
  // front-positioned lamp-like meshes so the two main headlights still work.
  if (profile?.id === "bmw-m2" && headLightMaterials.length === 0) {
    const fallbackHeadlampEntries = entries
      .filter((entry) => {
        const label = `${entry.name.toLowerCase()} ${entry.materialName.toLowerCase()}`;
        const nearFront = entry.center.x <= frontX + depth * 0.08;
        const sideMounted = Math.abs(entry.center.z - center.z) >= width * 0.12;
        const lampLike = /light|lamp|project|head|hl|chrome/i.test(label);
        const notRear = !/tail|rear|brake|stop|red_glass|emissivea/i.test(label);
        return nearFront && sideMounted && lampLike && notRear;
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);

    for (const entry of fallbackHeadlampEntries) {
      const material = ensureShowroomMaterial(entry.mesh);
      if (!material) {
        continue;
      }
      applyShowroomHeadlampLens(material);
      headLightMaterials.push(material);
      headLightPositions.push(entry.center.clone());
      headLightDebugItems.add(
        `${entry.name} :: ${entry.materialName || "(no-material-name)"} [fallback]`,
      );
      if (headLightMaterials.length >= 4) {
        break;
      }
    }
  }

  const leftHingeMeshes = leftDoorMeshes.filter((mesh) =>
    matchesAny(hierarchicalName(mesh), profile?.leftDoorHinge),
  );
  const rightHingeMeshes = rightDoorMeshes.filter((mesh) =>
    matchesAny(hierarchicalName(mesh), profile?.rightDoorHinge),
  );
  const leftDoorPivot = createSideDoorPivot(root, leftDoorMeshes, "left", leftHingeMeshes);
  const rightDoorPivot = createSideDoorPivot(root, rightDoorMeshes, "right", rightHingeMeshes);
  const spanningTrim = splitSpanningDoorTrim(leftDoorPivot, rightDoorPivot, profile?.spanningDoorTrim);
  leftDoorMeshes.push(...spanningTrim.left);
  rightDoorMeshes.push(...spanningTrim.right);
  const trunkForPivot = profile?.trunk?.length
    ? trunkMeshes
    : [...trunkMeshes].sort((a, b) => getMeshVolume(b) - getMeshVolume(a)).slice(0, 6);
  const trunkHingeMeshes = trunkMeshes.filter((mesh) =>
    matchesAny(hierarchicalName(mesh), profile?.trunkHinge),
  );
  const trunkPivot = createTrunkPivot(root, trunkForPivot, trunkHingeMeshes);
  prepareSunroofMotion(sunroofNodes);

  let frontWheels: THREE.Object3D[] = [];
  let rearWheels: THREE.Object3D[] = [];
  let wheelRollRadius = 0.27;

  // Only ever spin the GLB's own wheel meshes — never inject synthetic rollers.
  // Spanning tyre buffers (all four corners in one mesh) are cut apart first.
  if (!profile?.bakedWheels) {
    splitSpanningWheelMeshes(root);
    hideMisplacedTemplateWheels(root, bounds);
    const realWheels = findWheelNodes(root, profile);
    frontWheels = realWheels.frontWheels;
    rearWheels = realWheels.rearWheels;
    wheelRollRadius = realWheels.wheelRollRadius;
  }

  const steeringWheelCenter = findSteeringWheelCenter(root, size);

  if (hazardMaterials.length === 0 && tailLightMaterials.length > 0) {
    hazardMaterials.push(...tailLightMaterials.slice(0, 6));
    for (const item of tailLightDebugItems) {
      hazardDebugItems.add(`${item} [from-tail-fallback]`);
    }
  }

  const uniqueNames = (nodes: THREE.Object3D[]) =>
    [...new Set(nodes.map((node) => hierarchicalName(node)).filter(Boolean))];

  const debugParts: AssetRigDebugPart[] = [
    {
      key: "leftDoor",
      label: "左前门",
      interactive: Boolean(leftDoorPivot),
      count: leftDoorMeshes.length,
      items: uniqueNames(leftDoorMeshes),
    },
    {
      key: "rightDoor",
      label: "右前门",
      interactive: Boolean(rightDoorPivot),
      count: rightDoorMeshes.length,
      items: uniqueNames(rightDoorMeshes),
    },
    {
      key: "trunk",
      label: "后备箱",
      interactive: Boolean(trunkPivot),
      count: trunkMeshes.length,
      items: uniqueNames(trunkMeshes),
    },
    {
      key: "sunroof",
      label: "天窗",
      interactive: sunroofNodes.length > 0,
      count: sunroofNodes.length,
      items: uniqueNames(sunroofNodes),
    },
    {
      key: "headLights",
      label: "前大灯",
      interactive: headLightMaterials.length > 0,
      count: headLightMaterials.length,
      items: [...headLightDebugItems],
    },
    {
      key: "tailLights",
      label: "尾灯",
      interactive: tailLightMaterials.length > 0,
      count: tailLightMaterials.length,
      items: [...tailLightDebugItems],
    },
    {
      key: "hazardLights",
      label: "双闪",
      interactive: hazardMaterials.length > 0,
      count: hazardMaterials.length,
      items: [...hazardDebugItems],
    },
    {
      key: "paint",
      label: "车漆材质",
      interactive: paintMaterials.length > 0,
      count: paintMaterials.length,
      items: [...paintDebugItems],
    },
    {
      key: "frontWheels",
      label: "前轮",
      interactive: frontWheels.length > 0,
      count: frontWheels.length,
      items: uniqueNames(frontWheels),
    },
    {
      key: "rearWheels",
      label: "后轮",
      interactive: rearWheels.length > 0,
      count: rearWheels.length,
      items: uniqueNames(rearWheels),
    },
  ];

  return {
    bounds,
    leftDoorPivot,
    rightDoorPivot,
    trunkPivot,
    sunroofNodes,
    headLightMaterials,
    headLightPositions,
    paintMaterials,
    tailLightMaterials,
    hazardMaterials,
    frontWheels,
    rearWheels,
    wheelRollRadius,
    steeringWheelCenter,
    capabilities: {
      leftDoor: Boolean(leftDoorPivot),
      rightDoor: Boolean(rightDoorPivot),
      trunk: Boolean(trunkPivot),
      sunroof: sunroofNodes.length > 0,
      headLights: headLightMaterials.length > 0,
      tailLights: tailLightMaterials.length > 0,
      wheels: frontWheels.length + rearWheels.length > 0,
      wheelsSynthetic: false,
    },
    debug: {
      profileId: profile?.id ?? null,
      parts: debugParts,
    },
  };
}

const WHEEL_MATRIX = new THREE.Matrix4();
const WHEEL_ROTATION = new THREE.Matrix4();
const WHEEL_TRANSLATION = new THREE.Matrix4();

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

/** Boost each lamp material using its own GLB emissive / diffuse — no external tint. */
export function boostShowroomMaterialEmissive(
  materials: ShowroomMaterial[],
  active: boolean,
  litIntensity: number,
  delta: number,
  options?: { minActiveIntensity?: number },
) {
  for (const material of materials) {
    const storedBase = material.userData.showroomBaseEmissive as THREE.Color | undefined;
    const baseColor = storedBase?.clone() ?? material.color.clone().multiplyScalar(0.65);
    const baseIntensity =
      (material.userData.showroomBaseEmissiveIntensity as number | undefined) ?? 0;
    const isHeadlampLens = Boolean(material.userData.showroomHeadlampLens);
    const isTailLamp = Boolean(material.userData.showroomTailLamp);
    const { minEmissive, emissiveScale } = SHOWROOM_HEADLAMP_INTENSITY;
    const minLit = isHeadlampLens
      ? minEmissive
      : (options?.minActiveIntensity ?? (isTailLamp ? 0 : 0.6));
    const { tailMax, tailMin } = SHOWROOM_HAZARD_INTENSITY;
    const headlampWhite =
      (material.userData.showroomBaseEmissive as THREE.Color | undefined)?.clone() ??
      new THREE.Color(0xffffff);
    if (active && isHeadlampLens) {
      headlampWhite.multiplyScalar(1.35);
    }
    const hazardRed =
      (material.userData.showroomBaseEmissive as THREE.Color | undefined)?.clone() ??
      new THREE.Color(SHOWROOM_TAIL_LAMP_COLOR);

    let targetIntensity: number;
    let targetColor: THREE.Color;
    if (active && isTailLamp) {
      targetColor = hazardRed;
      targetIntensity = THREE.MathUtils.clamp(
        Math.max(litIntensity, tailMin),
        tailMin,
        tailMax,
      );
    } else if (active && isHeadlampLens) {
      targetColor = headlampWhite;
      targetIntensity = Math.max(litIntensity * emissiveScale, baseIntensity * 2.5, minLit);
    } else if (active) {
      targetColor = baseColor;
      targetIntensity = Math.max(litIntensity, baseIntensity * 2.5, minLit);
    } else {
      targetColor = storedBase ?? baseColor;
      targetIntensity = baseIntensity;
    }

    if (active && isHeadlampLens) {
      material.toneMapped = false;
    } else {
      material.toneMapped = true;
    }
    if (isHeadlampLens) {
      const storedBaseColor =
        (material.userData.showroomBaseColor as THREE.Color | undefined) ??
        material.color.clone();
      const lensTargetColor = active
        ? storedBaseColor.clone().lerp(new THREE.Color("#f8fafc"), 0.85)
        : storedBaseColor;
      material.color.lerp(lensTargetColor, THREE.MathUtils.clamp(delta * 8, 0, 1));
    }
    material.emissive.lerp(targetColor, THREE.MathUtils.clamp(delta * 9, 0, 1));
    material.emissiveIntensity = THREE.MathUtils.damp(
      material.emissiveIntensity,
      targetIntensity,
      9,
      delta,
    );
  }
}
