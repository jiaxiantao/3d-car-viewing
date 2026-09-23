import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { discoverAssetCarRig } from "@/lib/asset-car-rig";
import { approxBytesForModelUrl } from "@/lib/car-categories";
import { normalizeMarketModel } from "@/lib/normalize-market-model";
import { publicAssetPath } from "@/lib/public-asset-path";

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath(publicAssetPath("/draco/gltf/"));

const sharedGltfLoader = new GLTFLoader();
sharedGltfLoader.setDRACOLoader(sharedDracoLoader);

const gltfSceneCache = new Map<string, THREE.Object3D>();
const GLTF_SCENE_CACHE_LIMIT = 6;
const preloadInFlight = new Map<string, Promise<void>>();

export function disposeLoadedScene(root: THREE.Object3D) {
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

function evictOldestCacheEntry(exceptUrl?: string) {
  if (gltfSceneCache.size <= GLTF_SCENE_CACHE_LIMIT) {
    return;
  }
  const oldestKey = gltfSceneCache.keys().next().value as string | undefined;
  if (!oldestKey || oldestKey === exceptUrl) {
    return;
  }
  const stale = gltfSceneCache.get(oldestKey);
  if (stale) {
    disposeLoadedScene(stale);
  }
  gltfSceneCache.delete(oldestKey);
}

async function ensureGltfTemplateCached(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<THREE.Object3D> {
  const cached = gltfSceneCache.get(url);
  if (cached) {
    onProgress?.(1);
    return cached;
  }

  const approxBytes = approxBytesForModelUrl(url);

  return new Promise<THREE.Object3D>((resolve, reject) => {
    sharedGltfLoader.load(
      url,
      (gltf) => {
        const templateScene = gltf.scene.clone(true);
        templateScene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        onProgress?.(0.94);
        normalizeMarketModel(templateScene);
        gltfSceneCache.set(url, templateScene);
        evictOldestCacheEntry(url);
        onProgress?.(1);
        resolve(templateScene);
      },
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress?.(Math.min(0.92, event.loaded / event.total));
          return;
        }
        if (event.loaded > 0) {
          // Some static hosts omit Content-Length; approximate from known model size.
          onProgress?.(Math.min(0.75, event.loaded / approxBytes));
        }
      },
      reject,
    );
  });
}

export async function loadGltfScene(url: string, onProgress?: (ratio: number) => void) {
  const templateScene = await ensureGltfTemplateCached(url, onProgress);
  const instance = templateScene.clone(true);
  // Object3D.clone deep-copies userData as plain JSON, so Box3 methods are lost.
  // Rebuild rig on each cloned instance to keep runtime helpers like bounds.isEmpty().
  instance.userData.showroomRig = discoverAssetCarRig(instance, url);
  return instance;
}

/** Warm the in-memory GLB cache without instantiating a display clone. */
export function preloadGltfScene(url: string): Promise<void> {
  if (gltfSceneCache.has(url)) {
    return Promise.resolve();
  }
  const pending = preloadInFlight.get(url);
  if (pending) {
    return pending;
  }

  const task = ensureGltfTemplateCached(url)
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

  let uniqueUrls = [...new Set(urls)].filter((url) => !gltfSceneCache.has(url));
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
    const idleId = window.requestIdleCallback(start, { timeout: 4000 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }

  const timer = window.setTimeout(start, 1200);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
