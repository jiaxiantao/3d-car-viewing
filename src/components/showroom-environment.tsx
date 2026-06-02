"use client";

import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { AssetCarRig } from "@/lib/asset-car-rig";
import { MARKET_MODEL_GROUND_Y } from "@/lib/normalize-market-model";
import { SHOWROOM_SCENE_MODES, type ShowroomSceneMode } from "@/lib/showroom-scene-modes";

export const SHOWROOM_GROUND_Y = MARKET_MODEL_GROUND_Y;
export const SHOWROOM_FLOOR_COLOR = SHOWROOM_SCENE_MODES.studio.floorColor;

/** Scene-wide lighting — kept for legacy access; new code prefers `SHOWROOM_SCENE_MODES`. */
export const SHOWROOM_SCENE_LIGHTING = {
  environmentIntensity: SHOWROOM_SCENE_MODES.studio.environmentIntensity,
  ambient: SHOWROOM_SCENE_MODES.studio.ambient,
  directional: SHOWROOM_SCENE_MODES.studio.directional,
  hemisphere: SHOWROOM_SCENE_MODES.studio.hemisphere,
  fillPoint: SHOWROOM_SCENE_MODES.studio.fillPoint,
  rimDirectional: SHOWROOM_SCENE_MODES.studio.rimDirectional,
  headlightSpot: SHOWROOM_SCENE_MODES.studio.headlightSpot,
  /** Ground hit point ahead of the grille (showroom forward = -X). */
  headlightForwardOffset: 2.5,
} as const;

/** Geometric fallback car — front lamps at -X. */
const GEOMETRIC_HEADLIGHT_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-2, -0.1, -1),
  new THREE.Vector3(2, 1.35, 1),
);

export function resolveHeadlightSpotPositions(
  bounds: THREE.Box3,
  lampCenters: THREE.Vector3[],
): [THREE.Vector3, THREE.Vector3] {
  const size = bounds.getSize(new THREE.Vector3());
  const y = bounds.min.y + size.y * 0.44;
  const frontX = bounds.min.x + size.x * 0.06;
  const fallbackLeft = new THREE.Vector3(frontX, y, bounds.max.z - size.z * 0.22);
  const fallbackRight = new THREE.Vector3(frontX, y, bounds.min.z + size.z * 0.22);
  const minLateralSeparation = Math.max(size.z * 0.28, 0.45);
  const frontCutoff = bounds.min.x + size.x * 0.22;

  const frontLamps = lampCenters.filter((point) => point.x <= frontCutoff);
  const pool = frontLamps.length >= 2 ? frontLamps : lampCenters;

  if (pool.length === 0) {
    return [fallbackLeft, fallbackRight];
  }

  let maxZPoint: THREE.Vector3 | null = null;
  let minZPoint: THREE.Vector3 | null = null;
  let maxZ = -Infinity;
  let minZ = Infinity;

  for (const point of pool) {
    if (point.z > maxZ) {
      maxZ = point.z;
      maxZPoint = point;
    }
    if (point.z < minZ) {
      minZ = point.z;
      minZPoint = point;
    }
  }

  if (maxZPoint && minZPoint && maxZ - minZ >= minLateralSeparation) {
    return [maxZPoint.clone(), minZPoint.clone()];
  }

  return [fallbackLeft, fallbackRight];
}

function HeadlightSpot({
  position,
  bounds,
  active,
  intensity,
}: {
  position: THREE.Vector3;
  bounds: THREE.Box3;
  active: boolean;
  intensity: number;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  const targetPosition = useMemo(
    () =>
      new THREE.Vector3(
        bounds.min.x - SHOWROOM_SCENE_LIGHTING.headlightForwardOffset,
        SHOWROOM_GROUND_Y + 0.03,
        position.z,
      ),
    [bounds.min.x, position.z],
  );

  useLayoutEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) {
      return;
    }
    light.target = target;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.00015;
    light.shadow.radius = 3;
  }, []);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position.toArray()}
        intensity={active ? intensity : 0}
        angle={Math.PI / 4.2}
        penumbra={0.55}
        distance={18}
        decay={2}
        castShadow={active}
        color="#fff8eb"
      />
      <object3D ref={targetRef} position={targetPosition.toArray()} />
    </>
  );
}

/** Offline IBL — avoids drei Environment CDN HDR fetches that can fail and blank the canvas. */
export function ShowroomImageBasedLighting({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const room = new RoomEnvironment();
    const renderTarget = pmremGenerator.fromScene(room, 0.04);
    // R3F: mutating the Three.js scene for IBL is intentional.
    // eslint-disable-next-line react-hooks/immutability -- Three.js scene.environment
    scene.environment = renderTarget.texture;
    return () => {
      scene.environment = null;
      renderTarget.dispose();
      room.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js scene.environmentIntensity
    scene.environmentIntensity = intensity;
  }, [intensity, scene]);

  return null;
}

export function ShowroomHeadlightSpotlights({
  lightsOn,
  rig,
  sceneMode = "studio",
}: {
  lightsOn: boolean;
  rig: AssetCarRig | null;
  sceneMode?: ShowroomSceneMode;
}) {
  const bounds = rig?.bounds ?? GEOMETRIC_HEADLIGHT_BOUNDS;
  const [left, right] = useMemo(
    () => resolveHeadlightSpotPositions(bounds, rig?.headLightPositions ?? []),
    [bounds, rig?.headLightPositions],
  );

  if (!lightsOn || !rig?.capabilities.headLights) {
    return null;
  }

  const intensity = SHOWROOM_SCENE_MODES[sceneMode].headlightSpot;

  return (
    <>
      <HeadlightSpot position={left} bounds={bounds} active intensity={intensity} />
      <HeadlightSpot position={right} bounds={bounds} active intensity={intensity} />
    </>
  );
}

export function ShowroomReflectiveFloor({
  lightsOn,
  headLightsActive,
  sceneMode = "studio",
  /** Lower the resolution / blur on small / low-power devices. */
  performanceTier = "high",
}: {
  lightsOn: boolean;
  headLightsActive: boolean;
  sceneMode?: ShowroomSceneMode;
  performanceTier?: "high" | "medium" | "low";
}) {
  const config = SHOWROOM_SCENE_MODES[sceneMode];
  const floorLit = lightsOn && headLightsActive;
  const tierScale = performanceTier === "low" ? 0.55 : performanceTier === "medium" ? 0.8 : 1;
  const litResolution = Math.round((floorLit ? 640 : 384) * tierScale);
  const blurX = Math.round((floorLit ? 360 : 240) * tierScale);
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, SHOWROOM_GROUND_Y, 0]}>
        <circleGeometry args={[8, performanceTier === "low" ? 32 : 64]} />
        <MeshReflectorMaterial
          blur={[blurX, Math.round(100 * tierScale)]}
          resolution={Math.max(192, litResolution)}
          mixBlur={floorLit ? 1.1 : 0.85}
          mixStrength={floorLit ? 1.65 : 0.62}
          roughness={floorLit ? 0.3 : config.floorRoughness}
          depthScale={1.15}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.35}
          color={config.floorColor}
          metalness={floorLit ? 0.72 : config.floorMetalness}
          mirror={floorLit ? 0.36 : 0.14}
        />
      </mesh>
      <ContactShadows
        position={[0, SHOWROOM_GROUND_Y + 0.02, 0]}
        opacity={floorLit ? 0.72 : 0.55}
        blur={floorLit ? 2.1 : 2.4}
        scale={10}
        far={4}
      />
    </>
  );
}
