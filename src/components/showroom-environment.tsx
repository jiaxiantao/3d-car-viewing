"use client";

import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AssetCarRig } from "@/lib/asset-car-rig";
import { MARKET_MODEL_GROUND_Y } from "@/lib/normalize-market-model";

export const SHOWROOM_GROUND_Y = MARKET_MODEL_GROUND_Y;
export const SHOWROOM_FLOOR_COLOR = "#3d4f63";
const SHOWROOM_FLOOR_ROUGHNESS = 0.82;
const SHOWROOM_FLOOR_METALNESS = 0.22;

/** Scene-wide lighting — balanced between night (too dark) and city max (too bright). */
export const SHOWROOM_SCENE_LIGHTING = {
  environmentPreset: "city" as const,
  environmentIntensity: { base: 0.72, headlightsOn: 0.88 },
  ambient: { base: 0.58, headlightsOn: 0.52 },
  directional: { base: 1.35, headlightsOn: 1.12 },
  hemisphere: { intensity: 0.3, sky: "#cbd5e1", ground: "#1e293b" },
  fillPoint: 0.32,
  rimDirectional: 0.28,
  headlightSpot: 34,
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
}: {
  position: THREE.Vector3;
  bounds: THREE.Box3;
  active: boolean;
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
        intensity={active ? SHOWROOM_SCENE_LIGHTING.headlightSpot : 0}
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

export function ShowroomHeadlightSpotlights({
  lightsOn,
  rig,
}: {
  lightsOn: boolean;
  rig: AssetCarRig | null;
}) {
  const bounds = rig?.bounds ?? GEOMETRIC_HEADLIGHT_BOUNDS;
  const [left, right] = useMemo(
    () => resolveHeadlightSpotPositions(bounds, rig?.headLightPositions ?? []),
    [bounds, rig?.headLightPositions],
  );

  if (!lightsOn || !rig?.capabilities.headLights) {
    return null;
  }

  return (
    <>
      <HeadlightSpot position={left} bounds={bounds} active />
      <HeadlightSpot position={right} bounds={bounds} active />
    </>
  );
}

export function ShowroomReflectiveFloor({
  lightsOn,
  headLightsActive,
}: {
  lightsOn: boolean;
  headLightsActive: boolean;
}) {
  const floorLit = lightsOn && headLightsActive;
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, SHOWROOM_GROUND_Y, 0]}>
        <circleGeometry args={[8, 64]} />
        <MeshReflectorMaterial
          blur={[floorLit ? 420 : 280, 120]}
          resolution={floorLit ? 768 : 512}
          mixBlur={floorLit ? 1.1 : 0.85}
          mixStrength={floorLit ? 1.65 : 0.62}
          roughness={floorLit ? 0.3 : SHOWROOM_FLOOR_ROUGHNESS}
          depthScale={1.15}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.35}
          color={SHOWROOM_FLOOR_COLOR}
          metalness={floorLit ? 0.72 : SHOWROOM_FLOOR_METALNESS}
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
