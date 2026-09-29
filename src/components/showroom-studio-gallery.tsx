"use client";

import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SHOWROOM_GROUND_Y, ShowroomReflectiveFloor } from "@/components/showroom-environment";
import type { ShowroomSceneModeConfig } from "@/lib/showroom-scene-modes";
import { publicAssetPath } from "@/lib/public-asset-path";

/** Folder name matches `public/models/sence`. */
const GALLERY_MODEL_URL = publicAssetPath("/models/sence/white_round_exhibition_gallery.glb");

const FLOOR_SLAB_MAX_THICKNESS = 0.25;
const FLOOR_SLAB_MIN_SPAN = 8;
/**
 * The hall is about 44 units across. The showroom camera stays near a 4-unit
 * car, so the unscaled walls fall outside the frame. This keeps the first
 * floor step clear of the body and brings the round wall in as a backdrop.
 */
const GALLERY_SCALE = 0.55;
/** Inside the curved wall after `GALLERY_SCALE`. The step rings sit above this disc. */
const STUDIO_FLOOR_RADIUS = 11.5;

/**
 * Top of the wide, thin slab under the car. The gallery's other rings are
 * steps and trim with the same center, so the lowest covering slab is the floor.
 */
export function galleryFloorTopY(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  let floorTop = Infinity;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    box.setFromObject(mesh);
    box.getSize(size);
    box.getCenter(center);
    if (
      size.y > FLOOR_SLAB_MAX_THICKNESS ||
      size.x < FLOOR_SLAB_MIN_SPAN ||
      size.z < FLOOR_SLAB_MIN_SPAN ||
      Math.hypot(center.x, center.z) > 2
    ) {
      return;
    }
    floorTop = Math.min(floorTop, box.max.y);
  });

  if (Number.isFinite(floorTop)) {
    return floorTop;
  }
  return new THREE.Box3().setFromObject(root).min.y;
}

/**
 * Studio lights are tuned for car paint and clip a pure-white gallery to a
 * flat void. Keep the room white, but leave enough headroom for shading.
 */
function toneGalleryMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) {
        continue;
      }
      const emissive = standard.emissive;
      const isLight = emissive.r + emissive.g + emissive.b > 2.5;
      if (isLight) {
        standard.emissiveIntensity = 0.42;
        standard.color.set("#f7f8fa");
      } else {
        standard.color.set("#d5dbe4");
        standard.roughness = Math.max(standard.roughness, 0.68);
      }
      standard.side = THREE.DoubleSide;
      standard.needsUpdate = true;
    }
  });
}

/** The wide floor disc is replaced by a reflector, so it must not z-fight that surface. */
export function hideGalleryFloorSlab(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  // A plain `let` assigned inside `traverse` stays `null` to the type checker.
  const floorMesh: { current: THREE.Mesh | null } = { current: null };
  let floorTop = Infinity;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    box.setFromObject(mesh);
    box.getSize(size);
    box.getCenter(center);
    if (
      size.y > FLOOR_SLAB_MAX_THICKNESS ||
      size.x < FLOOR_SLAB_MIN_SPAN ||
      size.z < FLOOR_SLAB_MIN_SPAN ||
      Math.hypot(center.x, center.z) > 2 ||
      box.max.y >= floorTop
    ) {
      return;
    }
    floorTop = box.max.y;
    floorMesh.current = mesh;
  });

  if (floorMesh.current) {
    floorMesh.current.visible = false;
  }
}

/** Drop the gallery so its floor meets the same ground the car tires use. */
export function placeGalleryOnGround(root: THREE.Object3D, groundY = SHOWROOM_GROUND_Y) {
  root.scale.setScalar(GALLERY_SCALE);
  root.position.y += groundY - galleryFloorTopY(root);
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
  toneGalleryMaterials(root);
  hideGalleryFloorSlab(root);
}

let galleryTemplate: THREE.Object3D | null = null;
let galleryLoad: Promise<THREE.Object3D> | null = null;

function loadGalleryTemplate() {
  if (galleryTemplate) {
    return Promise.resolve(galleryTemplate);
  }
  if (!galleryLoad) {
    galleryLoad = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        GALLERY_MODEL_URL,
        (gltf) => {
          placeGalleryOnGround(gltf.scene);
          galleryTemplate = gltf.scene;
          resolve(gltf.scene);
        },
        undefined,
        (error) => {
          galleryLoad = null;
          reject(error);
        },
      );
    });
  }
  return galleryLoad;
}

export function ShowroomStudioGallery({ onReady }: { onReady?: (ready: boolean) => void }) {
  const [model, setModel] = useState<THREE.Object3D | null>(galleryTemplate);

  useEffect(() => {
    let cancelled = false;
    if (galleryTemplate) {
      onReady?.(true);
      return () => {
        cancelled = true;
      };
    }
    void loadGalleryTemplate()
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

  useEffect(() => {
    if (model) {
      hideGalleryFloorSlab(model);
    }
  }, [model]);

  if (!model) {
    return null;
  }

  return (
    <group name="showroom-studio-gallery">
      <primitive object={model} />
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, SHOWROOM_GROUND_Y + 0.004, 0]}
      >
        <circleGeometry args={[STUDIO_FLOOR_RADIUS, 64]} />
        <MeshReflectorMaterial
          blur={[280, 90]}
          resolution={512}
          mixBlur={0.65}
          mixStrength={1.15}
          roughness={0.38}
          depthScale={1.05}
          minDepthThreshold={0.25}
          maxDepthThreshold={1.35}
          color="#e7ebf1"
          metalness={0.22}
          mirror={0.48}
        />
      </mesh>
      <ContactShadows
        position={[0, SHOWROOM_GROUND_Y + 0.02, 0]}
        opacity={0.28}
        blur={2.4}
        scale={10}
        far={4}
      />
    </group>
  );
}

/** Gallery backdrop, with the old reflective disc only until the model is ready. */
export function ShowroomStudioVenue({
  lightsOn,
  headLightsActive,
  sceneConfig,
}: {
  lightsOn: boolean;
  headLightsActive: boolean;
  sceneConfig: ShowroomSceneModeConfig;
}) {
  const [galleryReady, setGalleryReady] = useState(galleryTemplate != null);
  const handleReady = useCallback((ready: boolean) => {
    setGalleryReady(ready);
  }, []);

  return (
    <>
      <ShowroomStudioGallery onReady={handleReady} />
      {galleryReady ? null : (
        <ShowroomReflectiveFloor
          lightsOn={lightsOn}
          headLightsActive={headLightsActive}
          sceneConfig={sceneConfig}
        />
      )}
    </>
  );
}
