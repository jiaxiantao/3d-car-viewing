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
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return source?.name ?? "";
}

type ShowroomMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

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

export function ensureShowroomMaterial(mesh: THREE.Mesh): ShowroomMaterial | null {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (
    !(source instanceof THREE.MeshStandardMaterial) &&
    !(source instanceof THREE.MeshPhysicalMaterial)
  ) {
    return null;
  }
  const cached = mesh.userData.showroomMaterial as ShowroomMaterial | undefined;
  if (cached) {
    return cached;
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
  mesh.userData.showroomMaterial = cloned;
  mesh.material = cloned;
  return cloned;
}

/** Clone body-paint materials separately from lamp clones. */
export function ensureShowroomPaintMaterial(mesh: THREE.Mesh): ShowroomMaterial | null {
  const cached = mesh.userData.showroomPaintMaterial as ShowroomMaterial | undefined;
  if (cached) {
    return cached;
  }
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (
    !(source instanceof THREE.MeshStandardMaterial) &&
    !(source instanceof THREE.MeshPhysicalMaterial)
  ) {
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
  return /LightA_Material/i.test(materialName);
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

function createSideDoorPivot(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  side: "left" | "right",
) {
  if (meshes.length === 0) {
    return null;
  }

  const pivot = new THREE.Group();
  const doorBox = new THREE.Box3();
  for (const mesh of meshes) {
    doorBox.expandByObject(mesh);
  }

  const hingeX = doorBox.min.x + (doorBox.max.x - doorBox.min.x) * 0.06;
  const hingeY = doorBox.min.y + (doorBox.max.y - doorBox.min.y) * 0.32;
  const hingeZ = side === "left" ? doorBox.max.z : doorBox.min.z;
  pivot.position.set(hingeX, hingeY, hingeZ);
  pivot.userData.showroomHingeAxis = "y";
  root.add(pivot);

  for (const mesh of meshes) {
    pivot.attach(mesh);
  }

  pivot.userData.showroomSide = side;
  return pivot;
}

function createTrunkPivot(root: THREE.Object3D, meshes: THREE.Mesh[]) {
  if (meshes.length === 0) {
    return null;
  }

  const pivot = new THREE.Group();
  const trunkBox = new THREE.Box3();
  for (const mesh of meshes) {
    trunkBox.expandByObject(mesh);
  }

  pivot.position.set(
    trunkBox.max.x,
    trunkBox.min.y + (trunkBox.max.y - trunkBox.min.y) * 0.68,
    (trunkBox.min.z + trunkBox.max.z) / 2,
  );
  pivot.userData.showroomHingeAxis = "z";
  root.add(pivot);

  for (const mesh of meshes) {
    pivot.attach(mesh);
  }

  return pivot;
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
  if (/(caliper|brake\s*disc|brake\s*pad|fender|arch)/i.test(name)) {
    return false;
  }
  return /(wheel|tire|tyre|rim)/i.test(name);
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

  for (const [key, unit] of quadrantBest) {
    const isFront = key.startsWith("F");
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

  return { frontWheels, rearWheels };
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

  for (const entry of entries) {
    const { mesh, name, materialName, center: meshCenter, size: meshSize } = entry;
    const nameLower = name.toLowerCase();
    const materialLower = materialName.toLowerCase();
    const label = `${nameLower} ${materialLower}`;

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
      }
      continue;
    }

    const profileHeadLight =
      matchesAny(name, profile?.headLight) ||
      matchesAny(materialName, profile?.headLightMaterial);
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
      const material = ensureShowroomMaterial(mesh);
      if (material) {
        if (shouldApplyHeadlampLensPreset(profile, profileHeadLight)) {
          applyShowroomHeadlampLens(material);
        }
        headLightMaterials.push(material);
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
    if (
      profileHazardLight ||
      isHazardPart(label) ||
      profileTailLight ||
      isTailLightPart(label, meshCenter, rearX)
    ) {
      if (
        profileTailLight &&
        !taillampPositionAllowed(profile, profileTailLight, materialName, meshCenter, bounds)
      ) {
        continue;
      }
      const material = ensureShowroomMaterial(mesh);
      if (!material) {
        continue;
      }
      applyShowroomTailLamp(material);
      tailLightMaterials.push(material);
      if (
        profileHazardLight ||
        isHazardPart(label) ||
        /emiss|red_cover|red_glass/i.test(label)
      ) {
        hazardMaterials.push(material);
      }
      continue;
    }

    const profileTrunk = matchesAny(name, profile?.trunk);
    if (profileTrunk || (isTrunkPart(nameLower) && isLocalizedPanel(meshSize))) {
      trunkMeshes.push(mesh);
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

    if (meshCenter.x > frontDoorX) {
      continue;
    }

    if (matchesAny(name, profile?.leftDoor) || meshCenter.z > leftZ) {
      leftDoorMeshes.push(mesh);
      continue;
    }

    if (matchesAny(name, profile?.rightDoor) || meshCenter.z < rightZ) {
      rightDoorMeshes.push(mesh);
    }
  }

  const leftDoorPivot = createSideDoorPivot(root, leftDoorMeshes, "left");
  const rightDoorPivot = createSideDoorPivot(root, rightDoorMeshes, "right");
  const trunkSorted = trunkMeshes.sort((a, b) => getMeshVolume(b) - getMeshVolume(a)).slice(0, 6);
  const trunkPivot = createTrunkPivot(root, trunkSorted);

  let frontWheels: THREE.Object3D[] = [];
  let rearWheels: THREE.Object3D[] = [];

  // Only ever spin the GLB's own wheel meshes — never inject synthetic rollers.
  if (!profile?.bakedWheels) {
    hideMisplacedTemplateWheels(root, bounds);
    const realWheels = findWheelNodes(root, profile);
    frontWheels = realWheels.frontWheels;
    rearWheels = realWheels.rearWheels;
  }

  if (hazardMaterials.length === 0 && tailLightMaterials.length > 0) {
    hazardMaterials.push(...tailLightMaterials.slice(0, 6));
  }

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
    material.emissive.lerp(targetColor, THREE.MathUtils.clamp(delta * 9, 0, 1));
    material.emissiveIntensity = THREE.MathUtils.damp(
      material.emissiveIntensity,
      targetIntensity,
      9,
      delta,
    );
  }
}
