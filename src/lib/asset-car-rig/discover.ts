/** Scan a loaded GLB and bind showroom interaction handles. */
import * as THREE from "three";
import { resolveMarketRigProfile } from "@/lib/market-rig-profiles";
import { hideMisplacedTemplateWheels } from "@/lib/asset-showroom-wheels";
import { type ShowroomMaterial, type AssetRigDebugPart, type AssetCarRig } from "./types";
import { ensureShowroomMaterial, ensureShowroomPaintMaterial } from "./materials";
import { hierarchicalName, matchesAny, getMeshVolume, collectMeshes } from "./mesh";
import { isInteriorLight, isHeadLightPart, isGClassMarketProfile, isExcludedFromHeadlightDiscovery, applyShowroomHeadlampLens, applyShowroomTailLamp, taillampPositionAllowed, shouldApplyHeadlampLensPreset, headlampPositionAllowed, isolateOffroadHeadlampIslands, isTailLightPart, isHazardPart, applyBmwM2CabinGlass, splitBmwM2HeadlampCovers, splitOffroadHeadlampCovers } from "./lights";
import { type OffroadCabinPanels, isTrunkPart, isDoorCandidate, isSunroofPart, createSideDoorPivot, splitSpanningDoorTrim, createTrunkPivot, SUNROOF_SLIDE_FRACTION, prepareSunroofMotion, findSteeringWheelCenter, splitOffroadCabinPanels, createBarnTailgatePivot, doorShellMeshes } from "./body";
import { splitSpanningWheelMeshes, findWheelNodes } from "./wheels";

export function discoverAssetCarRig(root: THREE.Object3D, modelUrl?: string): AssetCarRig {
  const profile = resolveMarketRigProfile(modelUrl);
  if (profile?.id === "bmw-m2") {
    root.updateWorldMatrix(true, true);
    splitBmwM2HeadlampCovers(root, new THREE.Box3().setFromObject(root));
    applyBmwM2CabinGlass(root);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  let offroadPanels: OffroadCabinPanels | null = null;
  if (isGClassMarketProfile(profile)) {
    isolateOffroadHeadlampIslands(root, bounds);
    splitOffroadHeadlampCovers(root, bounds);
    offroadPanels = splitOffroadCabinPanels(root, bounds);
  }

  const entries = collectMeshes(root);
  const headLightMaterials: ShowroomMaterial[] = [];
  const headLightPositions: THREE.Vector3[] = [];
  const paintMaterials: ShowroomMaterial[] = [];
  const tailLightMaterials: ShowroomMaterial[] = [];
  const hazardMaterials: ShowroomMaterial[] = [];
  const sunroofNodes: THREE.Object3D[] = [];
  let leftDoorMeshes: THREE.Mesh[] = [];
  let rightDoorMeshes: THREE.Mesh[] = [];
  let trunkMeshes: THREE.Mesh[] = [];
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
      const claimedDoor =
        matchesAny(name, profile?.leftDoor) || matchesAny(name, profile?.rightDoor);
      if (claimedDoor) {
        if (matchesAny(name, profile?.leftDoor)) {
          leftDoorMeshes.push(mesh);
        } else {
          rightDoorMeshes.push(mesh);
        }
        if (
          matchesAny(name, profile?.paintMaterial) ||
          matchesAny(materialName, profile?.paintMaterial)
        ) {
          const material = ensureShowroomPaintMaterial(mesh);
          if (material) {
            paintMaterials.push(material);
            paintDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
          }
        }
        continue;
      }
    }

    const listedSunroof = (profile?.sunroof?.length ?? 0) > 0;
    const sunroofMatch = listedSunroof
      ? matchesAny(name, profile?.sunroof)
      : isSunroofPart(nameLower);
    // Authored names win. The generic interior-light filter treats `Paint_` as `int_`,
    // which rejects a sunroof whose parent node is a body-paint material.
    if (sunroofMatch && (listedSunroof || !isInteriorLight(nameLower))) {
      sunroofNodes.push(mesh);
      continue;
    }

    // Hatch paint shares the body paint material. Claim it before the paint pass,
    // and leave lamp meshes for the tail-light pass so they still emissive-light.
    if (profile?.trunk?.length && matchesAny(name, profile.trunk)) {
      const trunkLamp =
        matchesAny(name, profile.headLight) ||
        matchesAny(name, profile.tailLight) ||
        matchesAny(name, profile.hazardLight) ||
        matchesAny(materialName, profile.headLightMaterial) ||
        matchesAny(materialName, profile.tailLightMaterial) ||
        matchesAny(materialName, profile.hazardLightMaterial);
      if (!trunkLamp) {
        trunkMeshes.push(mesh);
        if (
          matchesAny(name, profile.paintMaterial) ||
          matchesAny(materialName, profile.paintMaterial)
        ) {
          const material = ensureShowroomPaintMaterial(mesh);
          if (material) {
            paintMaterials.push(material);
            paintDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
          }
        }
        continue;
      }
    }

    if (matchesAny(name, profile?.paintMaterial) || matchesAny(materialName, profile?.paintMaterial)) {
      const material = ensureShowroomPaintMaterial(mesh);
      if (material) {
        paintMaterials.push(material);
        paintDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
      }
      continue;
    }

    if (mesh.userData.showroomHeadlampCover) {
      const material = ensureShowroomMaterial(mesh);
      if (material) {
        applyShowroomHeadlampLens(material);
        headLightMaterials.push(material);
        headLightDebugItems.add(`${name} :: ${materialName || "(no-material-name)"}`);
        if (meshCenter.x <= frontX && meshSize.z <= width * 0.32) {
          headLightPositions.push(meshCenter.clone());
        }
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
      !mesh.userData.showroomHeadlampResidual &&
      !mesh.userData.showroomCabinPanel &&
      // Authored lamp lists win. The generic exclude treats the letters in `Paint_` as `int_`.
      (profileHeadLight || !isExcludedFromHeadlightDiscovery(nameLower)) &&
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

    if (mesh.userData.showroomCabinPanel) {
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

  const leftRearMeshes = offroadPanels?.leftRear ?? [];
  const rightRearMeshes = offroadPanels?.rightRear ?? [];
  if (offroadPanels) {
    leftDoorMeshes = offroadPanels.leftFront;
    rightDoorMeshes = offroadPanels.rightFront;
    trunkMeshes = offroadPanels.tailgate;
  }
  const leftHingeMeshes = offroadPanels
    ? doorShellMeshes(leftDoorMeshes)
    : leftDoorMeshes.filter((mesh) => matchesAny(hierarchicalName(mesh), profile?.leftDoorHinge));
  const rightHingeMeshes = offroadPanels
    ? doorShellMeshes(rightDoorMeshes)
    : rightDoorMeshes.filter((mesh) =>
        matchesAny(hierarchicalName(mesh), profile?.rightDoorHinge),
      );
  const leftDoorPivot = createSideDoorPivot(
    root,
    leftDoorMeshes,
    "left",
    leftHingeMeshes,
    profile?.doorHingeLead,
    profile?.doorHingeOutset,
  );
  const rightDoorPivot = createSideDoorPivot(
    root,
    rightDoorMeshes,
    "right",
    rightHingeMeshes,
    profile?.doorHingeLead,
    profile?.doorHingeOutset,
  );
  const companionDoorPivots = [
    createSideDoorPivot(
      root,
      leftRearMeshes,
      "left",
      doorShellMeshes(leftRearMeshes),
      profile?.doorHingeLead,
      profile?.doorHingeOutset,
    ),
    createSideDoorPivot(
      root,
      rightRearMeshes,
      "right",
      doorShellMeshes(rightRearMeshes),
      profile?.doorHingeLead,
      profile?.doorHingeOutset,
    ),
  ].filter((pivot): pivot is THREE.Group => pivot !== null);
  const spanningTrim = splitSpanningDoorTrim(leftDoorPivot, rightDoorPivot, profile?.spanningDoorTrim);
  leftDoorMeshes.push(...spanningTrim.left);
  rightDoorMeshes.push(...spanningTrim.right);
  const trunkForPivot = offroadPanels
    ? trunkMeshes
    : profile?.trunk?.length
      ? trunkMeshes
      : [...trunkMeshes].sort((a, b) => getMeshVolume(b) - getMeshVolume(a)).slice(0, 6);
  const trunkHingeMeshes = trunkMeshes.filter((mesh) =>
    matchesAny(hierarchicalName(mesh), profile?.trunkHinge),
  );
  const trunkPivot = offroadPanels
    ? createBarnTailgatePivot(root, trunkForPivot)
    : createTrunkPivot(root, trunkForPivot, trunkHingeMeshes);
  prepareSunroofMotion(sunroofNodes, profile?.sunroofSlideFraction ?? SUNROOF_SLIDE_FRACTION);

  let frontWheels: THREE.Object3D[] = [];
  let rearWheels: THREE.Object3D[] = [];
  let wheelRollRadius = 0.27;

  // Only ever spin the GLB's own wheel meshes — never inject synthetic rollers.
  // Spanning tyre buffers (all four corners in one mesh) are cut apart first.
  if (!profile?.bakedWheels) {
    splitSpanningWheelMeshes(root, profile);
    hideMisplacedTemplateWheels(root, bounds);
    const realWheels = findWheelNodes(root, profile);
    frontWheels = realWheels.frontWheels;
    rearWheels = realWheels.rearWheels;
    wheelRollRadius = realWheels.wheelRollRadius;
  }

  const steeringWheelCenter = findSteeringWheelCenter(root, size, bounds, profile);

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
      count: leftDoorMeshes.length + leftRearMeshes.length,
      items: uniqueNames([...leftDoorMeshes, ...leftRearMeshes]),
    },
    {
      key: "rightDoor",
      label: "右前门",
      interactive: Boolean(rightDoorPivot),
      count: rightDoorMeshes.length + rightRearMeshes.length,
      items: uniqueNames([...rightDoorMeshes, ...rightRearMeshes]),
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
    companionDoorPivots,
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
