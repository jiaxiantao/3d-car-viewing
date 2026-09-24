"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ASSET_DOOR_MAX_OPEN_RADIANS,
  ASSET_TRUNK_MAX_OPEN_RADIANS,
  applyWheelMotion,
  boostShowroomMaterialEmissive,
  SHOWROOM_HEADLAMP_INTENSITY,
  SHOWROOM_HAZARD_INTENSITY,
  type AssetCarRig,
} from "@/lib/asset-car-rig";
import { interactivePointerHandlers } from "@/components/showroom/interactive-pointer";
import {
  ENGINE_IGNITION_DURATION,
  HAZARD_MIN_EMISSIVE,
  type CarShowroomState,
} from "@/components/showroom/types";

function pivotHitbox(pivot: THREE.Group | null, padding = 0.12) {
  if (!pivot) {
    return null;
  }
  const box = new THREE.Box3().setFromObject(pivot);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    center,
    size: new THREE.Vector3(
      Math.max(size.x, 0.35) + padding,
      Math.max(size.y, 0.28) + padding,
      Math.max(size.z, 0.12) + padding,
    ),
  };
}

function AssetInteractionZones({
  rig,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
}: {
  rig: AssetCarRig;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
}) {
  const hiddenMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
      }),
    [],
  );

  const zones = [
    { pivot: rig.leftDoorPivot, onClick: onToggleLeftDoor },
    { pivot: rig.rightDoorPivot, onClick: onToggleRightDoor },
    { pivot: rig.trunkPivot, onClick: onToggleTrunk },
  ];

  return (
    <>
      {zones.map((zone, index) => {
        const hit = pivotHitbox(zone.pivot);
        if (!hit) {
          return null;
        }
        return (
          <mesh
            key={`asset-hit-${index}`}
            position={hit.center}
            onClick={(event) => {
              event.stopPropagation();
              zone.onClick();
            }}
            {...interactivePointerHandlers}
          >
            <boxGeometry args={[hit.size.x, hit.size.y, hit.size.z]} />
            <primitive object={hiddenMaterial} attach="material" />
          </mesh>
        );
      })}
    </>
  );
}

export function AssetModel({
  object,
  rig,
  state,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
  reduceMotion = false,
}: {
  object: THREE.Object3D;
  rig: AssetCarRig;
  state: CarShowroomState;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  reduceMotion?: boolean;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const paintMaterialRefs = useRef<THREE.Material[]>([]);
  const allColorMaterialRefs = useRef<THREE.Material[]>([]);
  const wheelSpinAngleRef = useRef(0);
  const wheelSteerAngleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastVelocityRef = useRef(0);
  const prevEngineOnRef = useRef(state.engineOn);
  const ignitionTimeRef = useRef(0);
  useEffect(() => {
    wheelSpinAngleRef.current = 0;
    wheelSteerAngleRef.current = 0;
    prevEngineOnRef.current = false;
    ignitionTimeRef.current = 0;
  }, [rig]);

  useEffect(() => {
    paintMaterialRefs.current = [];
    allColorMaterialRefs.current = [];

    if (rig.paintMaterials.length > 0) {
      paintMaterialRefs.current = rig.paintMaterials;
      allColorMaterialRefs.current = rig.paintMaterials;
      return;
    }

    const excludeName =
      /(wheel|tire|rim|glass|window|lighta|lightemissive|headlight|tail|red_glass|lamp|indicator|interior|seat|mirror|grille|exhaust|brake|caliper|steer|handle|calliper|carbon|engine|badge|coloured|manufacturerplate|base_material)/;
    const includeName = /(body|paint|door|hood|bonnet|fender|bumper|trunk|tailgate|hatch|shell|car|paint_material)/;
    const candidates = new Map<string, { material: THREE.Material; score: number }>();
    const broadCandidates = new Map<string, { material: THREE.Material; score: number }>();

    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      let ancestor: THREE.Object3D | null = mesh;
      while (ancestor) {
        if (ancestor.userData.showroomSyntheticWheel) {
          return;
        }
        ancestor = ancestor.parent;
      }
      const geometry = mesh.geometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box?.getSize(size);
      const diagonal = size.length();
      const meshName = `${mesh.name} ${mesh.parent?.name ?? ""}`.toLowerCase();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const entry of materials) {
        const materialName = (entry.name ?? "").toLowerCase();
        if (excludeName.test(meshName) || excludeName.test(materialName)) {
          continue;
        }
        if (!("color" in entry)) {
          continue;
        }
        const color = (entry as { color: THREE.Color }).color;
        if (!broadCandidates.has(entry.uuid)) {
          broadCandidates.set(entry.uuid, {
            material: entry,
            score: Math.max(0.001, diagonal),
          });
        }
        const maybeTransparent = (entry as { transparent?: boolean; opacity?: number }).transparent;
        const maybeOpacity = (entry as { opacity?: number }).opacity;
        if (maybeTransparent && typeof maybeOpacity === "number" && maybeOpacity < 0.98) {
          continue;
        }
        const maybeEmissiveIntensity = (entry as { emissiveIntensity?: number }).emissiveIntensity;
        if (typeof maybeEmissiveIntensity === "number" && maybeEmissiveIntensity > 0.15) {
          continue;
        }

        const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        if (luma < 0.1 || luma > 0.95) {
          continue;
        }

        const bonus =
          includeName.test(meshName) || includeName.test(materialName) ? 2 : 1;
        const score = Math.max(0.001, diagonal) * bonus;
        const prev = candidates.get(entry.uuid);
        if (!prev || prev.score < score) {
          candidates.set(entry.uuid, { material: entry, score });
        }
      }
    });

    const picked = [...candidates.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.material);
    paintMaterialRefs.current = picked.length
      ? picked
      : [...broadCandidates.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((entry) => entry.material);
    allColorMaterialRefs.current = [...broadCandidates.values()].map((entry) => entry.material);
  }, [object, rig.paintMaterials]);

  useEffect(() => {
    const primary = new THREE.Color(state.bodyColor);
    const secondary = state.bodyColorSecondary ? new THREE.Color(state.bodyColorSecondary) : null;
    const targets = paintMaterialRefs.current.length
      ? paintMaterialRefs.current
      : allColorMaterialRefs.current;
    const denominator = Math.max(1, targets.length - 1);
    for (const [index, material] of targets.entries()) {
      if (!("color" in material)) {
        continue;
      }
      const gradientRatio = denominator === 0 ? 0 : index / denominator;
      const target = secondary
        ? primary.clone().lerp(secondary, THREE.MathUtils.clamp(gradientRatio, 0, 1))
        : primary;
      (material as { color: THREE.Color }).color.copy(target);
    }
  }, [state.bodyColor, state.bodyColorSecondary, rig.paintMaterials]);

  /* eslint-disable react-hooks/immutability -- three.js scene graph is mutated each frame */
  useFrame((renderState, delta) => {
    const t = renderState.clock.elapsedTime;
    const hazardPulse = state.hazardOn
      ? reduceMotion
        ? 1
        : Math.sin(t * 8) > 0
          ? 1
          : 0
      : 0;
    const hazardActive = hazardPulse > 0;
    if (state.engineOn && !prevEngineOnRef.current) {
      ignitionTimeRef.current = ENGINE_IGNITION_DURATION;
    }
    prevEngineOnRef.current = state.engineOn;
    ignitionTimeRef.current = Math.max(0, ignitionTimeRef.current - delta);
    const ignitionProgress = ignitionTimeRef.current / ENGINE_IGNITION_DURATION;
    const ignitionPulse = Math.sin(ignitionProgress * Math.PI);

    if (rig.leftDoorPivot) {
      const openSign = (rig.leftDoorPivot.userData.showroomOpenSign as number | undefined) ?? -1;
      const target = state.leftDoorOpen ? openSign * ASSET_DOOR_MAX_OPEN_RADIANS : 0;
      rig.leftDoorPivot.rotation.y = THREE.MathUtils.damp(
        rig.leftDoorPivot.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (rig.rightDoorPivot) {
      const openSign = (rig.rightDoorPivot.userData.showroomOpenSign as number | undefined) ?? 1;
      const target = state.rightDoorOpen ? openSign * ASSET_DOOR_MAX_OPEN_RADIANS : 0;
      rig.rightDoorPivot.rotation.y = THREE.MathUtils.damp(
        rig.rightDoorPivot.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (rig.trunkPivot) {
      // Root-local X == world lateral after market Ry(-90°) normalize.
      const axis = (rig.trunkPivot.userData.showroomHingeAxis as "x" | "z" | undefined) ?? "x";
      const target = state.trunkOpen ? ASSET_TRUNK_MAX_OPEN_RADIANS : 0;
      rig.trunkPivot.rotation[axis] = THREE.MathUtils.damp(
        rig.trunkPivot.rotation[axis],
        target,
        7,
        delta,
      );
    }

    for (const node of rig.sunroofNodes) {
      const base =
        (node.userData.showroomSunroofBasePos as THREE.Vector3 | undefined) ?? node.position;
      const openDelta =
        (node.userData.showroomSunroofOpenDelta as THREE.Vector3 | undefined) ??
        new THREE.Vector3(0, 0.08, 0);
      const targetX = state.sunroofOpen ? base.x + openDelta.x : base.x;
      const targetY = state.sunroofOpen ? base.y + openDelta.y : base.y;
      const targetZ = state.sunroofOpen ? base.z + openDelta.z : base.z;
      node.position.x = THREE.MathUtils.damp(node.position.x, targetX, 7, delta);
      node.position.y = THREE.MathUtils.damp(node.position.y, targetY, 7, delta);
      node.position.z = THREE.MathUtils.damp(node.position.z, targetZ, 7, delta);
    }

    const targetVelocity = state.engineOn ? state.speedKph / 3.6 : 0;
    const brakeFactor = state.braking ? 14 : 4;
    velocityRef.current = THREE.MathUtils.damp(
      velocityRef.current,
      targetVelocity,
      brakeFactor,
      delta,
    );
    // Roll all four real wheels forward together while the engine is running.
    const wheelRadius = Math.max(rig.wheelRollRadius, 0.12);
    const angularSpeed = velocityRef.current / wheelRadius;
    wheelSpinAngleRef.current += delta * angularSpeed;
    const spinAngle = wheelSpinAngleRef.current;

    const steerInput = THREE.MathUtils.clamp(state.steeringAngle, -42, 42) * (Math.PI / 180);
    wheelSteerAngleRef.current = THREE.MathUtils.damp(
      wheelSteerAngleRef.current,
      steerInput,
      6,
      delta,
    );
    const steerAngle = wheelSteerAngleRef.current;

    for (const wheel of rig.rearWheels) {
      applyWheelMotion(wheel, spinAngle, 0);
    }
    for (const wheel of rig.frontWheels) {
      applyWheelMotion(wheel, spinAngle, steerAngle);
    }

    if (rootRef.current) {
      const engineYOffset = state.engineOn
        ? Math.sin(t * 8) * (reduceMotion ? 0.004 : 0.02)
        : 0;
      const acceleration = (velocityRef.current - lastVelocityRef.current) / Math.max(delta, 0.001);
      const ignitionLift = ignitionPulse * 0.022;
      const ignitionPitch = ignitionPulse * 0.035;
      const pitchTarget = THREE.MathUtils.clamp(-acceleration * 0.015 + ignitionPitch, -0.06, 0.06);
      rootRef.current.position.y = THREE.MathUtils.damp(
        rootRef.current.position.y,
        engineYOffset + ignitionLift,
        7,
        delta,
      );
      rootRef.current.rotation.z = THREE.MathUtils.damp(
        rootRef.current.rotation.z,
        pitchTarget,
        5,
        delta,
      );
    }
    lastVelocityRef.current = velocityRef.current;

    const headLit = state.lightsOn;
    const headIntensity = headLit
      ? state.engineOn
        ? SHOWROOM_HEADLAMP_INTENSITY.engineOn
        : SHOWROOM_HEADLAMP_INTENSITY.on
      : 0;
    const ignitionHeadlightBoost = headLit ? ignitionPulse * 2.2 : 0;
    // Brake adds a strong red emissive on top of marker / hazard so it reads even in daylight.
    const brakeBoost = state.braking ? SHOWROOM_HAZARD_INTENSITY.tailMax * 0.85 : 0;
    const tailLit = state.lightsOn || hazardActive || state.braking;
    const tailIntensity = state.lightsOn
      ? 1.1 + hazardPulse * SHOWROOM_HAZARD_INTENSITY.withHeadlights + brakeBoost
      : hazardPulse * SHOWROOM_HAZARD_INTENSITY.on + brakeBoost;
    boostShowroomMaterialEmissive(
      rig.headLightMaterials,
      headLit,
      headIntensity + ignitionHeadlightBoost,
      delta,
    );
    boostShowroomMaterialEmissive(
      rig.tailLightMaterials,
      tailLit,
      tailIntensity,
      delta,
      HAZARD_MIN_EMISSIVE,
    );
    boostShowroomMaterialEmissive(
      rig.hazardMaterials,
      hazardActive,
      hazardPulse * SHOWROOM_HAZARD_INTENSITY.on,
      delta,
      HAZARD_MIN_EMISSIVE,
    );
  });

  return (
    <group ref={rootRef}>
      <primitive object={object} />
      <AssetInteractionZones
        rig={rig}
        onToggleLeftDoor={onToggleLeftDoor}
        onToggleRightDoor={onToggleRightDoor}
        onToggleTrunk={onToggleTrunk}
      />
    </group>
  );
}
