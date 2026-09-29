/** Paint cloning and lamp emissive animation. */
import * as THREE from "three";
import { type ShowroomMaterial, SHOWROOM_HEADLAMP_INTENSITY, SHOWROOM_HAZARD_INTENSITY, SHOWROOM_TAIL_LAMP_COLOR } from "./types";

export function isShowroomCompatibleMaterial(material: THREE.Material): material is ShowroomMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial ||
    material instanceof THREE.MeshPhongMaterial ||
    material instanceof THREE.MeshLambertMaterial
  );
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

/**
 * A baked livery (SU7 Ultra's yellow wrap) is multiplied by `material.color`,
 * so the paint swatch never shows. Turn saturated body pixels white and leave
 * gray stripes and black decals alone. Neutral maps are left unchanged.
 * Returns whether any pixel was rewritten.
 */
export function rewriteChromaticPaintAlbedo(data: Uint8ClampedArray) {
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount === 0) {
    return false;
  }
  const sampleStep = Math.max(1, Math.floor(pixelCount / 4096));
  let chromatic = 0;
  let counted = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += sampleStep) {
    const index = pixel * 4;
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max - min > 40 && max > 80) {
      chromatic += 1;
    }
    counted += 1;
  }
  if (chromatic / counted < 0.2) {
    return false;
  }

  let changed = false;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    if (max - min > 28 && luma > 40) {
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      changed = true;
    }
  }
  return changed;
}

export function neutralizeChromaticPaintMap(source: THREE.Texture) {
  if (typeof document === "undefined") {
    return null;
  }
  const image = source.image as (CanvasImageSource & { width?: number; height?: number }) | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!image || width < 2 || height < 2) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  if (!rewriteChromaticPaintAlbedo(frame.data)) {
    return null;
  }
  context.putImageData(frame, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `${source.name || "paint"}_showroom`;
  texture.colorSpace = source.colorSpace;
  texture.flipY = source.flipY;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.repeat.copy(source.repeat);
  texture.offset.copy(source.offset);
  texture.magFilter = source.magFilter;
  texture.minFilter = source.minFilter;
  texture.anisotropy = source.anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function applyNeutralPaintMap(material: ShowroomMaterial) {
  if (!("map" in material)) {
    return;
  }
  const baseMap = material.userData.showroomBaseMap as THREE.Texture | null | undefined;
  if (!baseMap) {
    return;
  }
  const cached = baseMap.userData.showroomNeutralPaintMap as THREE.Texture | null | undefined;
  if (cached) {
    material.map = cached;
    material.needsUpdate = true;
    return;
  }
  if (cached === null) {
    return;
  }
  const neutral = neutralizeChromaticPaintMap(baseMap);
  baseMap.userData.showroomNeutralPaintMap = neutral;
  if (neutral) {
    material.map = neutral;
    material.needsUpdate = true;
  }
}

/**
 * `color === null` restores the material's authored paint (factory swatch).
 * A swatch color replaces it, and a baked livery map is neutralized first so
 * the chosen color is not multiplied by the original pigment.
 */
export function applyShowroomBodyPaint(material: THREE.Material, color: THREE.Color | null) {
  if (!("color" in material)) {
    return;
  }
  const paint = material as ShowroomMaterial;
  if (!paint.userData.showroomBaseColor) {
    paint.userData.showroomBaseColor = paint.color.clone();
  }
  if ("map" in paint && paint.userData.showroomBaseMap === undefined) {
    paint.userData.showroomBaseMap = paint.map ?? null;
  }
  if (!color) {
    paint.color.copy(paint.userData.showroomBaseColor as THREE.Color);
    if ("map" in paint) {
      paint.map = (paint.userData.showroomBaseMap as THREE.Texture | null) ?? null;
      paint.needsUpdate = true;
    }
    return;
  }
  if (isShowroomCompatibleMaterial(paint)) {
    applyNeutralPaintMap(paint);
  }
  paint.color.copy(color);
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
  if ("map" in cloned) {
    cloned.userData.showroomBaseMap = cloned.map ?? null;
  }
  mesh.userData.showroomPaintMaterial = cloned;
  mesh.material = cloned;
  return cloned;
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
