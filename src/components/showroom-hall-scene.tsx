"use client";

import { ContactShadows } from "@react-three/drei";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SHOWROOM_GROUND_Y, ShowroomReflectiveFloor } from "@/components/showroom-environment";
import type { ShowroomSceneModeConfig } from "@/lib/showroom-scene-modes";
import { publicAssetPath } from "@/lib/public-asset-path";

/** Folder name matches `public/models/sence`. */
const HALL_MODEL_URL = publicAssetPath("/models/sence/car-showroom_1.glb");

/**
 * The display pad is modeled along Z. Showroom cars face −X, so yaw the hall
 * until that pad runs along the car.
 */
const HALL_YAW = Math.PI / 2;

/**
 * Top of the low pad under the car. The room's main floor is much wider, so a
 * car-sized footprint near the origin is the display surface.
 */
export function hallDisplayPadTopY(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  let padTop = -Infinity;
  let floorTop = Infinity;
  // Ceiling panels are also thin and centered. Only slabs sitting on the floor count.
  const floorBand = bounds.min.y + 1.2;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    box.setFromObject(mesh);
    box.getSize(size);
    box.getCenter(center);
    if (Math.hypot(center.x, center.z) > 1.5 || box.max.y > floorBand) {
      return;
    }
    const span = Math.max(size.x, size.z);
    const minor = Math.min(size.x, size.z);
    if (size.y < 0.8 && span > 3 && span < 8 && minor > 1.2 && minor < 4) {
      padTop = Math.max(padTop, box.max.y);
    }
    if (size.y < 0.15 && size.x > 8 && size.z > 8) {
      floorTop = Math.min(floorTop, box.max.y);
    }
  });

  if (padTop > -Infinity) {
    return padTop;
  }
  if (Number.isFinite(floorTop)) {
    return floorTop;
  }
  return new THREE.Box3().setFromObject(root).min.y;
}

/** Sit the hall's display pad on the same ground the car tires use. */
export function placeHallOnGround(root: THREE.Object3D, groundY = SHOWROOM_GROUND_Y) {
  root.rotation.y = HALL_YAW;
  root.position.y += groundY - hallDisplayPadTopY(root);
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
}

let hallTemplate: THREE.Object3D | null = null;
let hallLoad: Promise<THREE.Object3D> | null = null;

function loadHallTemplate() {
  if (hallTemplate) {
    return Promise.resolve(hallTemplate);
  }
  if (!hallLoad) {
    hallLoad = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        HALL_MODEL_URL,
        (gltf) => {
          placeHallOnGround(gltf.scene);
          hallTemplate = gltf.scene;
          resolve(gltf.scene);
        },
        undefined,
        (error) => {
          hallLoad = null;
          reject(error);
        },
      );
    });
  }
  return hallLoad;
}

export function ShowroomHallScene({ onReady }: { onReady?: (ready: boolean) => void }) {
  const [model, setModel] = useState<THREE.Object3D | null>(hallTemplate);

  useEffect(() => {
    let cancelled = false;
    if (hallTemplate) {
      onReady?.(true);
      return () => {
        cancelled = true;
      };
    }
    void loadHallTemplate()
      .then((scene) => {
        if (!cancelled) {
          setModel(scene);
          onReady?.(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModel(null);
          onReady?.(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  if (!model) {
    return null;
  }

  return (
    <group name="showroom-hall">
      <primitive object={model} />
      <ContactShadows
        position={[0, SHOWROOM_GROUND_Y + 0.02, 0]}
        opacity={0.42}
        blur={2.2}
        scale={8}
        far={3.5}
      />
    </group>
  );
}

/** Hall backdrop, with the reflective disc only until the model is ready. */
export function ShowroomHallVenue({
  lightsOn,
  headLightsActive,
  sceneConfig,
}: {
  lightsOn: boolean;
  headLightsActive: boolean;
  sceneConfig: ShowroomSceneModeConfig;
}) {
  const [hallReady, setHallReady] = useState(hallTemplate != null);
  const handleReady = useCallback((ready: boolean) => {
    setHallReady(ready);
  }, []);

  return (
    <>
      <ShowroomHallScene onReady={handleReady} />
      {hallReady ? null : (
        <ShowroomReflectiveFloor
          lightsOn={lightsOn}
          headLightsActive={headLightsActive}
          sceneConfig={sceneConfig}
        />
      )}
    </>
  );
}
