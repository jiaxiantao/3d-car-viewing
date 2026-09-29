/** Headlamp and tail-lamp discovery, including cover splits. */
import * as THREE from "three";
import { type MarketRigProfile } from "@/lib/market-rig-profiles";
import { type ShowroomMaterial, SHOWROOM_TAIL_LAMP_COLOR } from "./types";
import { hierarchicalName, triangleCorner, extractTriangleGeometry } from "./mesh";

export function isInteriorLight(name: string) {
  return /(interior|int_|roof.*lamp|roof.*light|icon|speaker|control_light)/i.test(name);
}

export function isHeadLightPart(name: string, center: THREE.Vector3, frontX: number) {
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

export function isOffroadHeadlampMesh(name: string) {
  return /lights_lod0|nlightsf\d/i.test(name);
}

/** G900 uses the G-Class buffer layout (doors, barn tailgate, round lamps). */
export function isGClassMarketProfile(profile: MarketRigProfile | null) {
  return profile?.id === "offroad-brabus";
}

export function isBmwM2HeadlampMaterial(materialName: string) {
  return /LightA(?:_Material\d*)?/i.test(materialName) || /LightA(?!.*Emissive)/i.test(materialName);
}

export function isBmwM2TailMaterial(materialName: string) {
  return /red_glass|LightEmissiveA/i.test(materialName);
}

export function isSuvHeadlampMesh(name: string) {
  if (/tail|taillamp|door_tail|int_|interior|door_int|roof_control/i.test(name)) {
    return false;
  }
  return (
    /\bHL\d_Mesh/i.test(name) ||
    /Hl_Projection_lamp|Hl_inner_glass/i.test(name) ||
    /HL_Chrome|Hl_Cover/i.test(name)
  );
}

export function isExcludedFromHeadlightDiscovery(name: string) {
  return /tail|taillamp|door_tail_lamp|int_|interior|door_int.*light|roof_control/i.test(
    name,
  );
}

export function applyShowroomHeadlampLens(material: ShowroomMaterial) {
  const lampColor = new THREE.Color(0xffffff);
  material.userData.showroomHeadlampLens = true;
  material.userData.showroomBaseEmissive = lampColor;
  material.userData.showroomBaseEmissiveIntensity = 0;
  material.userData.showroomBaseColor = material.color.clone();
  material.emissive.copy(lampColor);
}

export function applyShowroomTailLamp(material: ShowroomMaterial) {
  const lampColor = new THREE.Color(SHOWROOM_TAIL_LAMP_COLOR);
  material.userData.showroomTailLamp = true;
  material.userData.showroomBaseEmissive = lampColor;
  material.userData.showroomBaseEmissiveIntensity = 0;
  material.emissive.copy(lampColor);
}

export function taillampPositionAllowed(
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

export function shouldApplyHeadlampLensPreset(
  profile: MarketRigProfile | null,
  profileHeadLight: boolean,
) {
  return (
    profileHeadLight &&
    (isGClassMarketProfile(profile) ||
      profile?.id === "suv-q3" ||
      profile?.id === "bmw-m2" ||
      profile?.id === "xiaomi-su7-max" ||
      profile?.id === "xiaomi-su7-ultra" ||
      profile?.id === "xiaomi-yu7")
  );
}

export function headlampPositionAllowed(
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
  if (isGClassMarketProfile(profile) && profileHeadLight && isOffroadHeadlampMesh(name)) {
    return true;
  }
  if (profile?.id === "suv-q3" && profileHeadLight && isSuvHeadlampMesh(name)) {
    return true;
  }
  if (profile?.id === "bmw-m2" && profileHeadLight && isBmwM2HeadlampMaterial(materialName)) {
    return true;
  }
  if (
    profileHeadLight &&
    (profile?.id === "xiaomi-su7-max" ||
      profile?.id === "xiaomi-su7-ultra" ||
      profile?.id === "xiaomi-yu7")
  ) {
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
export function isPlausibleHeadlampPosition(
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

/**
 * G900 packs both round headlamps, side markers, and rear lenses into one
 * `lights_lod0` buffer. Keep only the front-corner islands for the headlamp
 * material so the bumper bar and tail pieces do not light up with the beams.
 */
export function isolateOffroadHeadlampIslands(root: THREE.Object3D, bounds: THREE.Box3) {
  const carCenter = bounds.getCenter(new THREE.Vector3());
  const meshes: THREE.Mesh[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomHeadlampIsland || mesh.userData.showroomHeadlampResidual) {
      return;
    }
    if (!isOffroadHeadlampMesh(hierarchicalName(mesh))) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    meshes.push(mesh);
  });

  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    const left: number[] = [];
    const right: number[] = [];
    const dropped: number[] = [];
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      if (!isPlausibleHeadlampPosition(centroid, bounds, carCenter)) {
        dropped.push(triangle);
      } else if (centroid.z >= carCenter.z) {
        left.push(triangle);
      } else {
        right.push(triangle);
      }
    }
    const keptSides = [left, right].filter((side) => side.length > 0);
    if (keptSides.length === 0 || dropped.length === 0) {
      continue;
    }

    for (const side of keptSides) {
      const piece = new THREE.Mesh(extractTriangleGeometry(mesh.geometry, side), mesh.material);
      piece.name = mesh.name;
      piece.castShadow = mesh.castShadow;
      piece.receiveShadow = mesh.receiveShadow;
      piece.position.copy(mesh.position);
      piece.quaternion.copy(mesh.quaternion);
      piece.scale.copy(mesh.scale);
      piece.userData.showroomHeadlampIsland = true;
      mesh.parent?.add(piece);
    }

    const sourceGeometry = mesh.geometry;
    mesh.geometry = extractTriangleGeometry(sourceGeometry, dropped);
    sourceGeometry.dispose();
    mesh.userData.showroomHeadlampResidual = true;
  }
}

export function isTailLightPart(name: string, center: THREE.Vector3, rearX: number) {
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

export function isHazardPart(name: string) {
  return /(hazard|indicator|turn|emiss|amber)/i.test(name) && /(tail|lamp|light|rear)/i.test(name);
}

export function isBmwM2WindowCoverMaterial(materialName: string) {
  return /Window_Material/i.test(materialName) && !/red_glass/i.test(materialName);
}

/**
 * M2 packs both cabin glass and the headlamp lenses into one opaque black
 * `Window_Material`. The lenses sit at the front corners and hide `LightA`,
 * so the showroom spots hit the floor while the lamps stay dark. After the
 * split, the leftover faces are reassigned to clear cabin glass.
 */
export function isBmwM2HeadlampCoverTriangle(
  centroid: THREE.Vector3,
  bounds: THREE.Box3,
  center: THREE.Vector3,
  size: THREE.Vector3,
) {
  const nearFront = centroid.x <= bounds.min.x + size.x * 0.13;
  const sideMounted = Math.abs(centroid.z - center.z) >= size.z * 0.18;
  const inLampBand =
    centroid.y >= bounds.min.y + size.y * 0.36 && centroid.y <= bounds.min.y + size.y * 0.68;
  return nearFront && sideMounted && inLampBand;
}

export function createBmwM2HeadlampCoverMaterial() {
  const material = new THREE.MeshStandardMaterial({
    name: "LightA_Material_HeadlampLens",
    color: new THREE.Color("#070707"),
    roughness: 0.08,
    metalness: 0,
    emissive: new THREE.Color("#fff6e0"),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  return material;
}

/**
 * The export paints every remaining `Window_Material` face solid black.
 * Cabin glass needs a clear physical pane so the interior shows through.
 * The name stays `Window_Material` so later discovery still finds these faces.
 */
export function createBmwM2CabinGlassMaterial(name: string) {
  const material = new THREE.MeshPhysicalMaterial({
    name,
    color: new THREE.Color("#e7f0f8"),
    metalness: 0,
    roughness: 0.05,
    transmission: 0.92,
    thickness: 0.02,
    ior: 1.5,
    attenuationColor: new THREE.Color("#d5e2ee"),
    attenuationDistance: 2,
    transparent: true,
    opacity: 0.38,
    envMapIntensity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  material.userData.showroomCabinGlass = true;
  return material;
}

/** Greenhouse starts about halfway up the body. Below that the same material is the front shell. */
export const BMW_M2_CABIN_GLASS_MIN_HEIGHT = 0.5;

export function applyBmwM2CabinGlass(root: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.y < 1e-4) {
    return;
  }
  const glassFloor = bounds.min.y + size.y * BMW_M2_CABIN_GLASS_MIN_HEIGHT;
  const targets: THREE.Mesh[] = [];
  let sourceName = "Window_Material";
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomHeadlampCover || Array.isArray(mesh.material)) {
      return;
    }
    const material = mesh.material;
    if (!material || material.userData.showroomCabinGlass || !mesh.geometry) {
      return;
    }
    const materialName = material.name ?? "";
    if (!isBmwM2WindowCoverMaterial(materialName)) {
      return;
    }
    sourceName = materialName;
    targets.push(mesh);
  });
  if (targets.length === 0) {
    return;
  }

  // One shared pane. The pristine GLB template still owns the black material,
  // so leave that material on the lower shell and only reassign the greenhouse.
  const glass = createBmwM2CabinGlassMaterial(sourceName);
  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let claimed = 0;

  for (const mesh of targets) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    const glassTriangles: number[] = [];
    const stayTriangles: number[] = [];
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      if (centroid.y >= glassFloor) {
        glassTriangles.push(triangle);
      } else {
        stayTriangles.push(triangle);
      }
    }
    if (glassTriangles.length === 0) {
      continue;
    }
    claimed += glassTriangles.length;
    if (stayTriangles.length === 0) {
      mesh.material = glass;
      mesh.renderOrder = 3;
      mesh.userData.showroomCabinGlass = true;
      continue;
    }
    const piece = new THREE.Mesh(extractTriangleGeometry(mesh.geometry, glassTriangles), glass);
    piece.name = `${mesh.name}_CabinGlass`;
    piece.userData.showroomCabinGlass = true;
    piece.castShadow = mesh.castShadow;
    piece.receiveShadow = mesh.receiveShadow;
    piece.renderOrder = 3;
    piece.position.copy(mesh.position);
    piece.quaternion.copy(mesh.quaternion);
    piece.scale.copy(mesh.scale);
    mesh.parent?.add(piece);
    const sourceGeometry = mesh.geometry;
    mesh.geometry = extractTriangleGeometry(sourceGeometry, stayTriangles);
    sourceGeometry.dispose();
  }

  if (claimed === 0) {
    glass.dispose();
  }
}

export function adoptHeadlampCover(source: THREE.Mesh, geometry: THREE.BufferGeometry, material: THREE.Material) {
  const piece = new THREE.Mesh(geometry, material);
  piece.name = `${source.name}_HeadlampLens`;
  piece.userData.showroomHeadlampCover = true;
  piece.castShadow = source.castShadow;
  piece.receiveShadow = source.receiveShadow;
  piece.renderOrder = 2;
  piece.position.copy(source.position);
  piece.quaternion.copy(source.quaternion);
  piece.scale.copy(source.scale);
  source.parent?.add(piece);
  return piece;
}

export function splitBmwM2HeadlampCovers(root: THREE.Object3D, bounds: THREE.Box3) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (size.x < 1e-4 || size.z < 1e-4) {
    return;
  }

  const covers: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.geometry) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    const materialName = mesh.material?.name ?? "";
    if (!isBmwM2WindowCoverMaterial(materialName)) {
      return;
    }
    covers.push(mesh);
  });

  const lensMaterial = createBmwM2HeadlampCoverMaterial();
  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let claimed = 0;

  for (const mesh of covers) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    const lensTriangles: number[] = [];
    const stayTriangles: number[] = [];

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      if (isBmwM2HeadlampCoverTriangle(centroid, bounds, center, size)) {
        lensTriangles.push(triangle);
      } else {
        stayTriangles.push(triangle);
      }
    }

    if (lensTriangles.length === 0) {
      continue;
    }
    claimed += lensTriangles.length;
    adoptHeadlampCover(mesh, extractTriangleGeometry(mesh.geometry, lensTriangles), lensMaterial);
    if (stayTriangles.length === 0) {
      mesh.removeFromParent();
    } else {
      mesh.geometry = extractTriangleGeometry(mesh.geometry, stayTriangles);
    }
  }

  if (claimed === 0) {
    lensMaterial.dispose();
  }
}

export const OFFROAD_HEADLAMP_COVER_RADIUS = 0.18;

export function createOffroadHeadlampCoverMaterial() {
  const material = new THREE.MeshStandardMaterial({
    name: "G900_HeadlampLens",
    color: new THREE.Color("#070707"),
    roughness: 0.08,
    metalness: 0,
    emissive: new THREE.Color("#fff6e0"),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  return material;
}

/**
 * G900's round lamps are a black `window_plastic` disc with dark glass in
 * front of a 2cm projector. The projector can glow and still be invisible.
 * Cut the disc out so the lens itself can brighten, and drop the glass over it.
 */
export function splitOffroadHeadlampCovers(root: THREE.Object3D, bounds: THREE.Box3) {
  const carCenter = bounds.getCenter(new THREE.Vector3());
  const anchors: THREE.Vector3[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.showroomHeadlampIsland) {
      return;
    }
    anchors.push(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
  });
  if (anchors.length < 2) {
    return;
  }

  const covers: THREE.Mesh[] = [];
  const veils: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.showroomHeadlampCover || Array.isArray(mesh.material)) {
      return;
    }
    if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
      return;
    }
    const name = mesh.name;
    if (/window_plastic/i.test(name)) {
      covers.push(mesh);
    } else if (/ExtWindowsGlass_0/i.test(name)) {
      veils.push(mesh);
    }
  });

  const lensMaterial = createOffroadHeadlampCoverMaterial();
  const cornerA = new THREE.Vector3();
  const cornerB = new THREE.Vector3();
  const cornerC = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let claimed = 0;

  const nearAnchor = (point: THREE.Vector3) =>
    anchors.some((anchor) => point.distanceTo(anchor) <= OFFROAD_HEADLAMP_COVER_RADIUS);

  const classify = (mesh: THREE.Mesh) => {
    const position = mesh.geometry.getAttribute("position");
    const left: number[] = [];
    const right: number[] = [];
    const stay: number[] = [];
    if (!position) {
      return { left, right, stay };
    }
    mesh.updateWorldMatrix(true, false);
    const triangleCount = mesh.geometry.getIndex()
      ? mesh.geometry.getIndex()!.count / 3
      : position.count / 3;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      cornerA.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 0));
      cornerB.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 1));
      cornerC.fromBufferAttribute(position, triangleCorner(mesh.geometry, triangle, 2));
      cornerA.applyMatrix4(mesh.matrixWorld);
      cornerB.applyMatrix4(mesh.matrixWorld);
      cornerC.applyMatrix4(mesh.matrixWorld);
      centroid.copy(cornerA).add(cornerB).add(cornerC).multiplyScalar(1 / 3);
      if (!nearAnchor(centroid)) {
        stay.push(triangle);
      } else if (centroid.z >= carCenter.z) {
        left.push(triangle);
      } else {
        right.push(triangle);
      }
    }
    return { left, right, stay };
  };

  const replaceResidual = (mesh: THREE.Mesh, stay: number[]) => {
    if (stay.length === 0) {
      mesh.removeFromParent();
      return;
    }
    const sourceGeometry = mesh.geometry;
    mesh.geometry = extractTriangleGeometry(sourceGeometry, stay);
    sourceGeometry.dispose();
  };

  for (const mesh of covers) {
    const { left, right, stay } = classify(mesh);
    const sides = [left, right].filter((side) => side.length > 0);
    if (sides.length === 0) {
      continue;
    }
    for (const side of sides) {
      claimed += side.length;
      adoptHeadlampCover(mesh, extractTriangleGeometry(mesh.geometry, side), lensMaterial);
    }
    replaceResidual(mesh, stay);
  }

  for (const mesh of veils) {
    const { left, right, stay } = classify(mesh);
    if (left.length + right.length === 0) {
      continue;
    }
    replaceResidual(mesh, stay);
  }

  if (claimed === 0) {
    lensMaterial.dispose();
  }
}
