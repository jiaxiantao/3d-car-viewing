import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { discoverAssetCarRig, type AssetCarRig } from "@/lib/asset-car-rig";
import { approxBytesForModelUrl } from "@/lib/car-categories";
import { normalizeMarketModel } from "@/lib/normalize-market-model";
import { publicAssetPath } from "@/lib/public-asset-path";

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath(publicAssetPath("/draco/gltf/"));

const sharedGltfLoader = new GLTFLoader();
sharedGltfLoader.setDRACOLoader(sharedDracoLoader);

/** Pristine normalized scenes (geometry shared with prepared instances). */
const templateCache = new Map<string, THREE.Object3D>();
/** Ready-to-display scenes with rig already discovered — reused across category switches. */
const preparedCache = new Map<string, PreparedShowroomModel>();
const prepareInFlight = new Map<string, Promise<PreparedShowroomModel>>();
const preloadInFlight = new Map<string, Promise<void>>();

const TEMPLATE_CACHE_LIMIT = 6;
const PREPARED_CACHE_LIMIT = 4;

export type PreparedShowroomModel = {
  url: string;
  root: THREE.Object3D;
  rig: AssetCarRig;
};

export type LoadGltfSceneResult = PreparedShowroomModel & {
  /** True when the prepared package was already warm (no clone / discover this call). */
  fromCache: boolean;
};

function yieldToNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

/** Dispose GPU resources owned by a template (not by display instances). */
function disposeTemplateResources(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material?.dispose();
    }
  });
}

/**
 * Display instances share geometry/materials with the template.
 * Only detach from the scene graph — never dispose GPU resources here.
 */
export function releaseDisplayedScene(root: THREE.Object3D | null | undefined) {
  if (!root) {
    return;
  }
  root.removeFromParent();
}

/** @deprecated Prefer {@link releaseDisplayedScene}; kept for call-site clarity. */
export function disposeLoadedScene(root: THREE.Object3D) {
  releaseDisplayedScene(root);
}

function touchMapEntry<K, V>(map: Map<K, V>, key: K, value: V) {
  map.delete(key);
  map.set(key, value);
}

function evictOldestTemplate(exceptUrl?: string) {
  while (templateCache.size > TEMPLATE_CACHE_LIMIT) {
    const oldestKey = templateCache.keys().next().value as string | undefined;
    if (!oldestKey || oldestKey === exceptUrl) {
      break;
    }
    // Drop prepared package first so we can safely dispose shared GPU resources.
    const prepared = preparedCache.get(oldestKey);
    if (prepared) {
      releaseDisplayedScene(prepared.root);
      preparedCache.delete(oldestKey);
    }
    const stale = templateCache.get(oldestKey);
    if (stale) {
      disposeTemplateResources(stale);
    }
    templateCache.delete(oldestKey);
  }
}

function evictOldestPrepared(exceptUrl?: string) {
  while (preparedCache.size > PREPARED_CACHE_LIMIT) {
    const oldestKey = preparedCache.keys().next().value as string | undefined;
    if (!oldestKey || oldestKey === exceptUrl) {
      break;
    }
    const stale = preparedCache.get(oldestKey);
    if (stale) {
      releaseDisplayedScene(stale.root);
      // Drop object graph only; template still owns GPU resources.
    }
    preparedCache.delete(oldestKey);
  }
}

/** Reset interaction transforms so a reused package starts from a clean pose. */
export function resetPreparedShowroomModel(model: PreparedShowroomModel) {
  const { rig } = model;
  if (rig.leftDoorPivot) {
    rig.leftDoorPivot.rotation.set(0, 0, 0);
  }
  if (rig.rightDoorPivot) {
    rig.rightDoorPivot.rotation.set(0, 0, 0);
  }
  if (rig.trunkPivot) {
    rig.trunkPivot.rotation.set(0, 0, 0);
  }
  for (const node of rig.sunroofNodes) {
    const baseY = node.userData.showroomSunroofBaseY;
    if (typeof baseY === "number") {
      node.position.y = baseY;
    }
    node.rotation.set(0, 0, 0);
  }
  for (const node of [...rig.frontWheels, ...rig.rearWheels]) {
    const data = node.userData.showroomWheel as
      | { base?: THREE.Matrix4; pivot?: THREE.Vector3 }
      | undefined;
    if (data?.base) {
      node.matrix.copy(data.base);
      node.matrix.decompose(node.position, node.quaternion, node.scale);
      node.matrixWorldNeedsUpdate = true;
    } else {
      node.rotation.set(0, 0, 0);
    }
  }
  // Do NOT reset root position / rotation / scale — normalizeMarketModel baked those
  // onto the prepared instance; wiping them makes the car a speck in the showroom.
}

async function ensureGltfTemplateCached(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<THREE.Object3D> {
  const cached = templateCache.get(url);
  if (cached) {
    touchMapEntry(templateCache, url, cached);
    onProgress?.(0.55);
    return cached;
  }

  const approxBytes = approxBytesForModelUrl(url);

  return new Promise<THREE.Object3D>((resolve, reject) => {
    sharedGltfLoader.load(
      url,
      (gltf) => {
        // Own the loaded scene as the pristine template (avoid an extra clone).
        const templateScene = gltf.scene;
        templateScene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        onProgress?.(0.85);
        normalizeMarketModel(templateScene);
        touchMapEntry(templateCache, url, templateScene);
        evictOldestTemplate(url);
        onProgress?.(0.92);
        resolve(templateScene);
      },
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress?.(Math.min(0.8, event.loaded / event.total));
          return;
        }
        if (event.loaded > 0) {
          onProgress?.(Math.min(0.7, event.loaded / approxBytes));
        }
      },
      reject,
    );
  });
}

async function prepareShowroomModel(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<PreparedShowroomModel> {
  const existing = preparedCache.get(url);
  if (existing) {
    touchMapEntry(preparedCache, url, existing);
    onProgress?.(1);
    return existing;
  }

  const inflight = prepareInFlight.get(url);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    const template = await ensureGltfTemplateCached(url, onProgress);
    // Let the loading overlay paint before the heavy clone / rig scan.
    await yieldToNextFrame();
    onProgress?.(0.94);
    const instance = template.clone(true);
    await yieldToNextFrame();
    const rig = discoverAssetCarRig(instance, url);
    for (const node of rig.sunroofNodes) {
      if (typeof node.userData.showroomSunroofBaseY !== "number") {
        node.userData.showroomSunroofBaseY = node.position.y;
      }
    }
    instance.userData.showroomRig = rig;
    const prepared: PreparedShowroomModel = { url, root: instance, rig };
    touchMapEntry(preparedCache, url, prepared);
    evictOldestPrepared(url);
    onProgress?.(1);
    return prepared;
  })().finally(() => {
    prepareInFlight.delete(url);
  });

  prepareInFlight.set(url, task);
  return task;
}

export async function loadGltfScene(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<LoadGltfSceneResult> {
  const fromCache = preparedCache.has(url);
  const prepared = await prepareShowroomModel(url, onProgress);
  if (fromCache) {
    resetPreparedShowroomModel(prepared);
  }
  return { ...prepared, fromCache };
}

/** Whether a fully prepared display package is already warm for this URL. */
export function isShowroomModelPrepared(url: string): boolean {
  return preparedCache.has(url);
}

/** Warm template + prepared package without attaching to the scene. */
export function preloadGltfScene(url: string): Promise<void> {
  if (preparedCache.has(url)) {
    return Promise.resolve();
  }
  const pending = preloadInFlight.get(url);
  if (pending) {
    return pending;
  }

  const task = prepareShowroomModel(url)
    .then(() => undefined)
    .finally(() => {
      preloadInFlight.delete(url);
    });
  preloadInFlight.set(url, task);
  return task;
}

export type IdlePreloadOptions = {
  /** Skip idle preloads on constrained networks (save-data / 2g). Default true. */
  respectNetworkConstraints?: boolean;
  /** When true, only warm the first URL (e.g. mobile). */
  currentOnly?: boolean;
};

function shouldSkipIdlePreloadForNetwork(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) {
    return false;
  }
  if (connection.saveData) {
    return true;
  }
  const effectiveType = connection.effectiveType;
  return effectiveType === "2g" || effectiveType === "slow-2g";
}

export function scheduleIdleGltfPreloads(urls: string[], options?: IdlePreloadOptions) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const respectNetwork = options?.respectNetworkConstraints !== false;
  if (respectNetwork && shouldSkipIdlePreloadForNetwork()) {
    return () => undefined;
  }

  let uniqueUrls = [...new Set(urls)].filter((url) => !preparedCache.has(url));
  if (options?.currentOnly && uniqueUrls.length > 0) {
    uniqueUrls = uniqueUrls.slice(0, 1);
  }
  if (uniqueUrls.length === 0) {
    return () => undefined;
  }

  let cancelled = false;
  let index = 0;

  const runNext = () => {
    if (cancelled || index >= uniqueUrls.length) {
      return;
    }
    const url = uniqueUrls[index];
    index += 1;
    void preloadGltfScene(url).finally(() => {
      if (!cancelled) {
        runNext();
      }
    });
  };

  const start = () => {
    if (!cancelled) {
      runNext();
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(start, { timeout: 2500 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }

  const timer = window.setTimeout(start, 600);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
