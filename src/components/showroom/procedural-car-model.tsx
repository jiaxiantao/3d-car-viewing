"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  SHOWROOM_HAZARD_INTENSITY,
  SHOWROOM_TAIL_LAMP_COLOR,
} from "@/lib/asset-car-rig";
import { SHOWROOM_GROUND_Y } from "@/components/showroom-environment";
import { interactivePointerHandlers } from "@/components/showroom/interactive-pointer";
import {
  ENGINE_IGNITION_DURATION,
  type CarCameraPreset,
  type CarModelProps,
} from "@/components/showroom/types";

const SHOWROOM_TAIL_LAMP_HEX = `#${new THREE.Color(SHOWROOM_TAIL_LAMP_COLOR).getHexString()}`;

const DOOR_MAX_OPEN_RADIANS = (70 * Math.PI) / 180;
const TRUNK_MAX_OPEN_RADIANS = (75 * Math.PI) / 180;
const BODY_LENGTH = 3.2;
const BODY_WIDTH = 1.55;
const BODY_HALF_LENGTH = BODY_LENGTH / 2;
const CABIN_CENTER_X = 0.15;
const CABIN_DEPTH = 1.9;
const CABIN_WIDTH = 1.4;
const CHASSIS_HEIGHT = 0.55;
const CHASSIS_HALF_HEIGHT = CHASSIS_HEIGHT / 2;
const CABIN_TO_CHASSIS_HEIGHT_RATIO = 1.5 * 0.85;
const CABIN_HEIGHT = CHASSIS_HEIGHT * CABIN_TO_CHASSIS_HEIGHT_RATIO;
const CABIN_HEIGHT_BASE = 0.5;
const CABIN_HEIGHT_SCALE = CABIN_HEIGHT / CABIN_HEIGHT_BASE;
const CABIN_ON_CHASSIS_OVERLAP = 0.075;
const CABIN_CENTER_Y = CHASSIS_HALF_HEIGHT + CABIN_HEIGHT / 2 - CABIN_ON_CHASSIS_OVERLAP;
const CABIN_WALL_THICKNESS = 0.06;
const GLASS_THICKNESS = 0.018;
const WINDSHIELD_HEIGHT = 0.34 * CABIN_HEIGHT_SCALE;
const WINDSHIELD_WIDTH = CABIN_WIDTH * 0.82;
const WINDSHIELD_FORWARD_OFFSET = 0.08;
const WINDSHIELD_TILT_RADIANS = -0.5;
const SIDE_WINDOW_LENGTH = 0.78;
const SIDE_WINDOW_HEIGHT = 0.24 * CABIN_HEIGHT_SCALE;
const DOOR_PANEL_HEIGHT = 0.42;
const DOOR_CENTER_X = -0.82;
const DOOR_CENTER_Y = 0.35;
const DOOR_SIDE_Z = 0.82;
const CABIN_FLOOR_Y = CABIN_CENTER_Y - CABIN_HEIGHT / 2;
const INTERIOR_SEAT_Y = CABIN_FLOOR_Y + 0.1;
const TRUNK_PANEL_THICKNESS = 0.06;
const TRUNK_LID_DEPTH = TRUNK_PANEL_THICKNESS;
const CABIN_TOP_Y = CABIN_CENTER_Y + CABIN_HEIGHT / 2;
const SUNROOF_Y = CABIN_TOP_Y + 0.04;
const HEADLIGHT_Y = CHASSIS_HALF_HEIGHT * 0.8;
const TAILLIGHT_Y = CHASSIS_HALF_HEIGHT * 0.73;
const TRUNK_HINGE_X = BODY_HALF_LENGTH;
const TRUNK_LID_HEIGHT = 0.34;
const TRUNK_LID_HALF_HEIGHT = TRUNK_LID_HEIGHT / 2;
const TRUNK_HINGE_Y = CHASSIS_HALF_HEIGHT + TRUNK_LID_HEIGHT;
const TRUNK_HINGE_Z = 0;
const TRUNK_LID_OUTWARD_OFFSET = TRUNK_PANEL_THICKNESS / 2;
const TRUNK_PANEL_WIDTH = CABIN_WIDTH;
const CABIN_REAR_X = CABIN_CENTER_X + CABIN_DEPTH / 2;
const TRUNK_SLOPE_END_X = TRUNK_HINGE_X - 0.04;
const TRUNK_SLOPE_END_Y = TRUNK_HINGE_Y + 0.01;
const TRUNK_SLOPE_DX = TRUNK_SLOPE_END_X - CABIN_REAR_X;
const TRUNK_SLOPE_DY = TRUNK_SLOPE_END_Y - CABIN_TOP_Y;
const TRUNK_SLOPE_LENGTH = Math.hypot(TRUNK_SLOPE_DX, TRUNK_SLOPE_DY);
const TRUNK_SLOPE_ANGLE = Math.atan2(TRUNK_SLOPE_DY, TRUNK_SLOPE_DX);
const TRUNK_SLOPE_CENTER_X = (CABIN_REAR_X + TRUNK_SLOPE_END_X) / 2;
const TRUNK_SLOPE_CENTER_Y = (CABIN_TOP_Y + TRUNK_SLOPE_END_Y) / 2;
const TRUNK_SLOPE_THICKNESS = TRUNK_PANEL_THICKNESS;
const CABIN_FRONT_X = CABIN_CENTER_X - CABIN_DEPTH / 2;
const HOOD_LENGTH = BODY_HALF_LENGTH - CABIN_FRONT_X - 0.08;
const HOOD_CENTER_X = -BODY_HALF_LENGTH + HOOD_LENGTH / 2 + 0.02;
const HOOD_HEIGHT = 0.1;
const HOOD_Y = CHASSIS_HALF_HEIGHT - HOOD_HEIGHT / 2 + 0.02;
const SEAT_BACK_TILT = -0.28;
const STEERING_COLUMN_X = CABIN_CENTER_X - 0.78;
const STEERING_COLUMN_Y = INTERIOR_SEAT_Y + 0.24;
const STEERING_COLUMN_Z = 0.34;

const WHEEL_RADIUS = 0.27;
const WHEEL_WIDTH = 0.22;
const WHEEL_SPOKE_COUNT = 10;
const BODY_GROUND_CLEARANCE = 0.09;
const WHEEL_TOUCH_CLEARANCE = 0.01;
// Lower mount on the body so raising ride height keeps wheel contact with the floor.
const WHEEL_MOUNT_Y = -0.06 - BODY_GROUND_CLEARANCE;
const CAR_BASE_Y =
  SHOWROOM_GROUND_Y + WHEEL_RADIUS - WHEEL_MOUNT_Y + WHEEL_TOUCH_CLEARANCE;

export function ShowroomAccentLights({
  lightsOn,
  cameraPreset,
  useAssetModel,
  assetScene,
}: {
  lightsOn: boolean;
  cameraPreset: CarCameraPreset;
  useAssetModel: boolean;
  assetScene: THREE.Object3D | null;
}) {
  const interiorOn = cameraPreset === "cockpit";
  const assetBounds = useMemo(() => {
    if (!assetScene) {
      return null;
    }
    return new THREE.Box3().setFromObject(assetScene);
  }, [assetScene]);

  if (useAssetModel && assetBounds) {
    if (!interiorOn) {
      return null;
    }
    const center = assetBounds.getCenter(new THREE.Vector3());
    const size = assetBounds.getSize(new THREE.Vector3());
    const interiorIntensity = lightsOn ? 0.45 : 0.14;
    return (
      <pointLight
        position={[center.x - 0.4, center.y + size.y * 0.35, center.z]}
        intensity={interiorIntensity}
        distance={4}
        color="#bae6fd"
      />
    );
  }

  return (
    <>
      <pointLight
        position={[CABIN_CENTER_X - 0.35, CABIN_CENTER_Y + 0.12, 0]}
        intensity={interiorOn ? 0.5 : 0.06}
        distance={2.8}
        color="#bae6fd"
      />
      <pointLight
        position={[CABIN_CENTER_X + 0.15, CABIN_TOP_Y - 0.05, 0]}
        intensity={interiorOn ? 0.22 : 0}
        distance={2.2}
        color="#f8fafc"
      />
    </>
  );
}

function GeometricCabinShell({
  paintMaterial,
  interiorMaterial,
  glassMaterial,
}: {
  paintMaterial: THREE.MeshStandardMaterial;
  interiorMaterial: THREE.MeshStandardMaterial;
  glassMaterial: THREE.MeshPhysicalMaterial;
}) {
  const sideZ = CABIN_WIDTH / 2 - CABIN_WALL_THICKNESS / 2;
  const glassZ = CABIN_WIDTH / 2 - CABIN_WALL_THICKNESS / 2 + GLASS_THICKNESS * 0.5;
  const lowerSillY = -CABIN_HEIGHT * 0.16;
  const upperRailY = CABIN_HEIGHT * 0.32;
  const lowerSillHeight = 0.14 * CABIN_HEIGHT_SCALE;
  const upperRailHeight = 0.12 * CABIN_HEIGHT_SCALE;
  const rearGlassHeight = 0.3 * CABIN_HEIGHT_SCALE;

  return (
    <group position={[CABIN_CENTER_X, CABIN_CENTER_Y, 0]}>
      <mesh
        receiveShadow
        position={[0, -CABIN_HEIGHT / 2 + CABIN_WALL_THICKNESS / 2, 0]}
        material={interiorMaterial}
      >
        <boxGeometry args={[CABIN_DEPTH * 0.9, CABIN_WALL_THICKNESS, CABIN_WIDTH * 0.88]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, lowerSillY, sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_DEPTH * 0.94, lowerSillHeight, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, lowerSillY, -sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_DEPTH * 0.94, lowerSillHeight, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, upperRailY, sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_DEPTH * 0.94, upperRailHeight, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, upperRailY, -sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_DEPTH * 0.94, upperRailHeight, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[-CABIN_DEPTH / 2 + 0.05, 0, sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_WALL_THICKNESS, CABIN_HEIGHT * 0.88, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[-CABIN_DEPTH / 2 + 0.05, 0, -sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_WALL_THICKNESS, CABIN_HEIGHT * 0.88, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[CABIN_DEPTH / 2 - 0.05, 0.02, sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_WALL_THICKNESS, CABIN_HEIGHT * 0.75, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[CABIN_DEPTH / 2 - 0.05, 0.02, -sideZ]} material={paintMaterial}>
        <boxGeometry args={[CABIN_WALL_THICKNESS, CABIN_HEIGHT * 0.75, CABIN_WALL_THICKNESS]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, CABIN_HEIGHT / 2 - CABIN_WALL_THICKNESS / 2, 0]} material={paintMaterial}>
        <boxGeometry args={[CABIN_DEPTH * 0.62, CABIN_WALL_THICKNESS, CABIN_WIDTH - 0.52]} />
      </mesh>

      <mesh
        position={[
          -CABIN_DEPTH / 2 - WINDSHIELD_FORWARD_OFFSET,
          0.06 * CABIN_HEIGHT_SCALE,
          0,
        ]}
        rotation={[0, 0, WINDSHIELD_TILT_RADIANS]}
        material={glassMaterial}
      >
        <boxGeometry args={[GLASS_THICKNESS, WINDSHIELD_HEIGHT, WINDSHIELD_WIDTH]} />
      </mesh>
      <mesh position={[CABIN_DEPTH / 2 - 0.03, 0.05 * CABIN_HEIGHT_SCALE, 0]} material={glassMaterial}>
        <boxGeometry args={[GLASS_THICKNESS, rearGlassHeight, CABIN_WIDTH * 0.72]} />
      </mesh>
      <mesh position={[-0.08, 0.03, glassZ]} material={glassMaterial}>
        <boxGeometry args={[SIDE_WINDOW_LENGTH, SIDE_WINDOW_HEIGHT, GLASS_THICKNESS]} />
      </mesh>
      <mesh position={[-0.08, 0.03, -glassZ]} material={glassMaterial}>
        <boxGeometry args={[SIDE_WINDOW_LENGTH, SIDE_WINDOW_HEIGHT, GLASS_THICKNESS]} />
      </mesh>
    </group>
  );
}

function GeometricSeat({
  position,
}: {
  position: [number, number, number];
}) {
  const cushionMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.78, metalness: 0.06 }),
    [],
  );
  const backMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.82, metalness: 0.05 }),
    [],
  );

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.08, 0]} material={cushionMaterial}>
        <boxGeometry args={[0.42, 0.1, 0.3]} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[0.19, 0.24, 0]}
        rotation={[0, 0, SEAT_BACK_TILT]}
        material={backMaterial}
      >
        <boxGeometry args={[0.08, 0.32, 0.38]} />
      </mesh>
    </group>
  );
}

function GeometricWheel({
  spinGroupRef,
}: {
  spinGroupRef: (node: THREE.Group | null) => void;
}) {
  const tireMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a1f2e", roughness: 0.92, metalness: 0.05 }),
    [],
  );
  const spokeSilverMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8edf5",
        metalness: 0.62,
        roughness: 0.28,
      }),
    [],
  );
  const spokeDarkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#111827",
        metalness: 0.35,
        roughness: 0.45,
      }),
    [],
  );
  const hubMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#94a3b8",
        metalness: 0.75,
        roughness: 0.22,
      }),
    [],
  );
  const rimRingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        metalness: 0.65,
        roughness: 0.25,
      }),
    [],
  );
  const spokeIndices = useMemo(
    () => Array.from({ length: WHEEL_SPOKE_COUNT }, (_, index) => index),
    [],
  );

  return (
    <group ref={spinGroupRef}>
      <mesh castShadow receiveShadow material={tireMaterial}>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 32]} />
      </mesh>

      {spokeIndices.map((spokeIndex) => {
        const angle = (spokeIndex / WHEEL_SPOKE_COUNT) * Math.PI * 2;
        return (
          <mesh
            key={`sidewall-${spokeIndex}`}
            position={[
              Math.cos(angle) * (WHEEL_RADIUS + 0.014),
              0,
              Math.sin(angle) * (WHEEL_RADIUS + 0.014),
            ]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.045, WHEEL_WIDTH * 0.88, 0.09]} />
            <meshStandardMaterial
              color={spokeIndex % 2 === 0 ? "#e2e8f0" : "#334155"}
              metalness={0.45}
              roughness={0.38}
            />
          </mesh>
        );
      })}

      {([1, -1] as const).map((side) => (
        <group key={side} position={[0, side * (WHEEL_WIDTH / 2 + 0.02), 0]}>
          <mesh rotation={[side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]} castShadow>
            <circleGeometry args={[WHEEL_RADIUS * 0.9, 32]} />
            <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh material={hubMaterial} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
          </mesh>
          {spokeIndices.map((spokeIndex) => {
            const angle = (spokeIndex / WHEEL_SPOKE_COUNT) * Math.PI * 2;
            return (
              <group key={`${side}-spoke-${spokeIndex}`} rotation={[0, angle, 0]}>
                <mesh
                  position={[0.13, 0, 0]}
                  castShadow
                  material={spokeIndex % 2 === 0 ? spokeSilverMaterial : spokeDarkMaterial}
                >
                  <boxGeometry args={[0.24, 0.032, 0.06]} />
                </mesh>
              </group>
            );
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]} material={rimRingMaterial} castShadow>
            <torusGeometry args={[WHEEL_RADIUS * 0.88, 0.014, 8, 40]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CarModel({
  state,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
  overlayOnly = false,
  reduceMotion = false,
}: CarModelProps) {
  const rootRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);
  const trunkRef = useRef<THREE.Group>(null);
  const seatLeftRef = useRef<THREE.Group>(null);
  const seatRightRef = useRef<THREE.Group>(null);
  const steeringRef = useRef<THREE.Mesh>(null);
  const grilleMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0f172a", metalness: 0.5, roughness: 0.45 }),
    [],
  );
  const sunroofRef = useRef<THREE.Mesh>(null);
  const bodyPaintMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0ea5e9", metalness: 0.35, roughness: 0.3 }),
    [],
  );
  const cabinPaintMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#38bdf8", metalness: 0.38, roughness: 0.28 }),
    [],
  );
  const interiorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.88, metalness: 0.05 }),
    [],
  );
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#dbeafe",
        metalness: 0,
        roughness: 0.06,
        transparent: true,
        opacity: 0.45,
        transmission: 0.88,
        thickness: 0.35,
        ior: 1.45,
        envMapIntensity: 0.9,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const leftHeadLightRef = useRef<THREE.Mesh>(null);
  const rightHeadLightRef = useRef<THREE.Mesh>(null);
  const leftTailLightRef = useRef<THREE.Mesh>(null);
  const rightTailLightRef = useRef<THREE.Mesh>(null);
  const exhaustLeftRef = useRef<THREE.Mesh>(null);
  const exhaustRightRef = useRef<THREE.Mesh>(null);
  const frontSteerRefs = useRef<THREE.Group[]>([]);
  const wheelSpinRefs = useRef<THREE.Group[]>([]);
  const wheelSpinAnglesRef = useRef<number[]>([]);
  const velocityRef = useRef(0);
  const lastVelocityRef = useRef(0);
  const prevEngineOnRef = useRef(state.engineOn);
  const ignitionTimeRef = useRef(0);

  const bodyTargetColorRef = useRef(new THREE.Color(state.bodyColor));
  const cabinTargetColorRef = useRef(new THREE.Color(state.bodyColor));

  const hiddenHitboxMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const primary = new THREE.Color(state.bodyColor);
    const secondary = state.bodyColorSecondary
      ? new THREE.Color(state.bodyColorSecondary)
      : null;
    const bodyTarget = bodyTargetColorRef.current;
    if (secondary) {
      bodyTarget.copy(primary.clone().lerp(secondary, 0.32));
    } else {
      bodyTarget.copy(primary);
    }

    const cabinBase = secondary
      ? primary.clone().lerp(secondary, 0.72)
      : primary.clone();
    const cabinTarget = cabinTargetColorRef.current;
    cabinTarget.copy(cabinBase.offsetHSL(0, 0.02, 0.08));
  }, [state.bodyColor, state.bodyColorSecondary]);

  useFrame((renderState, delta) => {
    const t = renderState.clock.elapsedTime;
    const hazardPulse = state.hazardOn
      ? reduceMotion
        ? 1
        : Math.sin(t * 8) > 0
          ? 1
          : 0
      : 0;
    if (state.engineOn && !prevEngineOnRef.current) {
      ignitionTimeRef.current = ENGINE_IGNITION_DURATION;
    }
    prevEngineOnRef.current = state.engineOn;
    ignitionTimeRef.current = Math.max(0, ignitionTimeRef.current - delta);
    const ignitionProgress = ignitionTimeRef.current / ENGINE_IGNITION_DURATION;
    const ignitionPulse = Math.sin(ignitionProgress * Math.PI);

    if (leftDoorRef.current) {
      const target = state.leftDoorOpen ? -DOOR_MAX_OPEN_RADIANS : 0;
      leftDoorRef.current.rotation.y = THREE.MathUtils.damp(
        leftDoorRef.current.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (rightDoorRef.current) {
      const target = state.rightDoorOpen ? DOOR_MAX_OPEN_RADIANS : 0;
      rightDoorRef.current.rotation.y = THREE.MathUtils.damp(
        rightDoorRef.current.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (trunkRef.current) {
      const target = state.trunkOpen ? TRUNK_MAX_OPEN_RADIANS : 0;
      const nextZ = THREE.MathUtils.damp(trunkRef.current.rotation.z, target, 7, delta);
      trunkRef.current.rotation.set(0, 0, nextZ);
    }

    const seatDriverTarget = THREE.MathUtils.clamp(state.seatDriverOffset, -0.45, 0.45);
    const seatPassengerTarget = THREE.MathUtils.clamp(state.seatPassengerOffset, -0.45, 0.45);
    if (seatLeftRef.current) {
      seatLeftRef.current.position.z = THREE.MathUtils.damp(
        seatLeftRef.current.position.z,
        0.35 + seatDriverTarget,
        9,
        delta,
      );
    }
    if (seatRightRef.current) {
      seatRightRef.current.position.z = THREE.MathUtils.damp(
        seatRightRef.current.position.z,
        -0.35 + seatPassengerTarget,
        9,
        delta,
      );
    }

    const targetVelocity = state.engineOn ? state.speedKph / 3.6 : 0;
    const brakeFactor = state.braking ? 14 : 4;
    velocityRef.current = THREE.MathUtils.damp(
      velocityRef.current,
      targetVelocity,
      brakeFactor,
      delta,
    );

    // Spin around horizontal axle (local Y on wheel mesh inside mount group).
    const angularSpeed = velocityRef.current / WHEEL_RADIUS;
    for (let index = 0; index < wheelSpinRefs.current.length; index += 1) {
      const wheel = wheelSpinRefs.current[index];
      if (!wheel) {
        continue;
      }
      const nextSpin = (wheelSpinAnglesRef.current[index] ?? 0) + delta * angularSpeed;
      wheelSpinAnglesRef.current[index] = nextSpin;
      wheel.rotation.set(0, nextSpin, 0);
    }

    const steerInput = THREE.MathUtils.clamp(state.steeringAngle, -42, 42) * (Math.PI / 180);
    const wheelBase = 2.2;
    const trackWidth = 1.48;
    const minSteer = 0.001;
    const steerSign = Math.sign(steerInput);
    let leftSteerTarget = steerInput;
    let rightSteerTarget = steerInput;
    if (Math.abs(steerInput) > minSteer) {
      const turnRadius = wheelBase / Math.tan(Math.abs(steerInput));
      const inner = Math.atan(wheelBase / Math.max(0.2, turnRadius - trackWidth / 2));
      const outer = Math.atan(wheelBase / Math.max(0.2, turnRadius + trackWidth / 2));
      if (steerSign > 0) {
        leftSteerTarget = outer;
        rightSteerTarget = inner;
      } else {
        leftSteerTarget = -inner;
        rightSteerTarget = -outer;
      }
    }

    if (frontSteerRefs.current[0]) {
      frontSteerRefs.current[0].rotation.y = THREE.MathUtils.damp(
        frontSteerRefs.current[0].rotation.y,
        leftSteerTarget,
        6,
        delta,
      );
    }
    if (frontSteerRefs.current[1]) {
      frontSteerRefs.current[1].rotation.y = THREE.MathUtils.damp(
        frontSteerRefs.current[1].rotation.y,
        rightSteerTarget,
        6,
        delta,
      );
    }

    if (steeringRef.current) {
      steeringRef.current.rotation.y = THREE.MathUtils.damp(
        steeringRef.current.rotation.y,
        steerInput,
        8,
        delta,
      );
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
        CAR_BASE_Y + engineYOffset + ignitionLift,
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

    const enginePulse = state.engineOn
      ? 0.35 + 0.2 * Math.sin(t * (14 + state.speedKph * 0.08))
      : 0;
    if (exhaustLeftRef.current) {
      exhaustLeftRef.current.scale.setScalar(0.7 + enginePulse);
      (exhaustLeftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        enginePulse;
    }
    if (exhaustRightRef.current) {
      exhaustRightRef.current.scale.setScalar(0.7 + enginePulse);
      (exhaustRightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        enginePulse;
    }

    if (sunroofRef.current) {
      sunroofRef.current.position.x = THREE.MathUtils.damp(
        sunroofRef.current.position.x,
        state.sunroofOpen ? 0.3 : -0.02,
        7,
        delta,
      );
    }

    const colorLerp = THREE.MathUtils.clamp(delta * 4, 0, 1);
    bodyPaintMaterial.color.lerp(bodyTargetColorRef.current, colorLerp);
    cabinPaintMaterial.color.lerp(cabinTargetColorRef.current, colorLerp);

    const frontIntensity = state.lightsOn ? (state.engineOn ? 2.6 : 2.1) : 0.2;
    const ignitionHeadlightBoost = state.lightsOn ? ignitionPulse * 1.9 : 0;
    const { tailMax, tailMin, withHeadlights, on } = SHOWROOM_HAZARD_INTENSITY;
    const brakeBoost = state.braking ? tailMax * 0.85 : 0;
    const rearIntensity = state.lightsOn
      ? THREE.MathUtils.clamp(0.4 + hazardPulse * withHeadlights + brakeBoost, tailMin, tailMax)
      : THREE.MathUtils.clamp(hazardPulse * on + brakeBoost, 0, tailMax);
    for (const lightRef of [leftHeadLightRef, rightHeadLightRef]) {
      if (!lightRef.current) {
        continue;
      }
      const mat = lightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.damp(
        mat.emissiveIntensity,
        frontIntensity + ignitionHeadlightBoost,
        9,
        delta,
      );
    }
    for (const lightRef of [leftTailLightRef, rightTailLightRef]) {
      if (!lightRef.current) {
        continue;
      }
      const mat = lightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.set(SHOWROOM_TAIL_LAMP_HEX);
      mat.emissiveIntensity = THREE.MathUtils.damp(
        mat.emissiveIntensity,
        rearIntensity,
        9,
        delta,
      );
    }
  });

  return (
    <group ref={rootRef} position={[0, CAR_BASE_Y, 0]}>
      {!overlayOnly ? (
        <>
          <mesh castShadow receiveShadow material={bodyPaintMaterial}>
            <boxGeometry args={[BODY_LENGTH, CHASSIS_HEIGHT, BODY_WIDTH]} />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[HOOD_CENTER_X, HOOD_Y, 0]}
            material={bodyPaintMaterial}
          >
            <boxGeometry args={[HOOD_LENGTH, HOOD_HEIGHT, BODY_WIDTH * 0.92]} />
          </mesh>
          <mesh position={[-BODY_HALF_LENGTH + 0.05, HOOD_Y + 0.01, 0]} material={grilleMaterial} castShadow>
            <boxGeometry args={[0.07, HOOD_HEIGHT * 0.85, BODY_WIDTH * 0.42]} />
          </mesh>
          <GeometricCabinShell
            paintMaterial={cabinPaintMaterial}
            interiorMaterial={interiorMaterial}
            glassMaterial={glassMaterial}
          />
        </>
      ) : null}
      <mesh ref={sunroofRef} position={[-0.02, SUNROOF_Y, 0]} receiveShadow>
        <boxGeometry args={[0.72, 0.03, 0.42]} />
        {overlayOnly ? (
          <primitive object={hiddenHitboxMaterial} attach="material" />
        ) : (
          <meshStandardMaterial color="#020617" roughness={0.18} metalness={0.2} />
        )}
      </mesh>

      <group ref={leftDoorRef} position={[DOOR_CENTER_X, DOOR_CENTER_Y, DOOR_SIDE_Z]}>
        <mesh
          castShadow
          receiveShadow
          position={[0.56, 0, -0.04]}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLeftDoor();
          }}
          {...interactivePointerHandlers}
        >
          <boxGeometry args={[1.1, DOOR_PANEL_HEIGHT, 0.08]} />
          {overlayOnly ? (
            <primitive object={hiddenHitboxMaterial} attach="material" />
          ) : (
            <primitive object={cabinPaintMaterial} attach="material" />
          )}
        </mesh>
        {!overlayOnly ? (
          <mesh castShadow position={[0.2, 0.06, -0.08]} material={cabinPaintMaterial}>
            <boxGeometry args={[0.07, 0.05, 0.05]} />
          </mesh>
        ) : null}
      </group>

      <group ref={rightDoorRef} position={[DOOR_CENTER_X, DOOR_CENTER_Y, -DOOR_SIDE_Z]}>
        <mesh
          castShadow
          receiveShadow
          position={[0.56, 0, 0.04]}
          onClick={(event) => {
            event.stopPropagation();
            onToggleRightDoor();
          }}
          {...interactivePointerHandlers}
        >
          <boxGeometry args={[1.1, DOOR_PANEL_HEIGHT, 0.08]} />
          {overlayOnly ? (
            <primitive object={hiddenHitboxMaterial} attach="material" />
          ) : (
            <primitive object={cabinPaintMaterial} attach="material" />
          )}
        </mesh>
        {!overlayOnly ? (
          <mesh castShadow position={[0.2, 0.06, 0.08]} material={cabinPaintMaterial}>
            <boxGeometry args={[0.07, 0.05, 0.05]} />
          </mesh>
        ) : null}
      </group>

      {!overlayOnly ? (
        <mesh
          position={[TRUNK_SLOPE_CENTER_X, TRUNK_SLOPE_CENTER_Y, TRUNK_HINGE_Z]}
          rotation={[0, 0, TRUNK_SLOPE_ANGLE]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[TRUNK_SLOPE_LENGTH, TRUNK_SLOPE_THICKNESS, TRUNK_PANEL_WIDTH]} />
          <primitive object={cabinPaintMaterial} attach="material" />
        </mesh>
      ) : null}

      <group ref={trunkRef} position={[TRUNK_SLOPE_END_X, TRUNK_SLOPE_END_Y, TRUNK_HINGE_Z]}>
        <mesh
          castShadow
          receiveShadow
          position={[TRUNK_LID_OUTWARD_OFFSET, -TRUNK_LID_HALF_HEIGHT, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTrunk();
          }}
          {...interactivePointerHandlers}
        >
          <boxGeometry args={[TRUNK_LID_DEPTH, TRUNK_LID_HEIGHT, TRUNK_PANEL_WIDTH]} />
          {overlayOnly ? (
            <primitive object={hiddenHitboxMaterial} attach="material" />
          ) : (
            <primitive object={cabinPaintMaterial} attach="material" />
          )}
        </mesh>
      </group>

      {!overlayOnly ? (
        <>
          <group ref={seatLeftRef} position={[CABIN_CENTER_X - 0.55, INTERIOR_SEAT_Y, 0.35]}>
            <GeometricSeat position={[0, 0, 0]} />
          </group>
          <group ref={seatRightRef} position={[CABIN_CENTER_X - 0.55, INTERIOR_SEAT_Y, -0.35]}>
            <GeometricSeat position={[0, 0, 0]} />
          </group>
          <mesh
            ref={steeringRef}
            position={[STEERING_COLUMN_X, STEERING_COLUMN_Y, STEERING_COLUMN_Z]}
            rotation={[Math.PI / 2, 0, SEAT_BACK_TILT]}
            castShadow
          >
            <torusGeometry args={[0.12, 0.026, 16, 36]} />
            <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.55} />
          </mesh>
          {[
            { x: -1.1, y: WHEEL_MOUNT_Y, z: 0.75, steer: true },
            { x: 1.08, y: WHEEL_MOUNT_Y, z: 0.75, steer: false },
            { x: -1.1, y: WHEEL_MOUNT_Y, z: -0.75, steer: true },
            { x: 1.08, y: WHEEL_MOUNT_Y, z: -0.75, steer: false },
          ].map((position, index) => {
            const frontSteerIndex = index === 0 ? 0 : index === 2 ? 1 : -1;
            return (
              <group
                key={`wheel-${index}`}
                ref={(node) => {
                  if (!node || frontSteerIndex < 0) {
                    return;
                  }
                  frontSteerRefs.current[frontSteerIndex] = node;
                }}
                position={[position.x, position.y, position.z]}
              >
                <group rotation={[Math.PI / 2, 0, 0]}>
                  <GeometricWheel
                    spinGroupRef={(node) => {
                      if (node) {
                        wheelSpinRefs.current[index] = node;
                      }
                    }}
                  />
                </group>
              </group>
            );
          })}
        </>
      ) : null}

      <mesh ref={leftHeadLightRef} position={[-1.56, HEADLIGHT_Y, 0.45]} visible={!overlayOnly}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial
          emissive={state.lightsOn ? "#fde68a" : "#0f172a"}
          emissiveIntensity={state.lightsOn ? 2.1 : 0.2}
          color={state.lightsOn ? "#fef3c7" : "#334155"}
        />
      </mesh>
      <mesh ref={rightHeadLightRef} position={[-1.56, HEADLIGHT_Y, -0.45]} visible={!overlayOnly}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial
          emissive={state.lightsOn ? "#fde68a" : "#0f172a"}
          emissiveIntensity={state.lightsOn ? 2.1 : 0.2}
          color={state.lightsOn ? "#fef3c7" : "#334155"}
        />
      </mesh>
      <mesh ref={leftTailLightRef} position={[1.57, TAILLIGHT_Y, 0.44]} visible={!overlayOnly}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={rightTailLightRef} position={[1.57, TAILLIGHT_Y, -0.44]} visible={!overlayOnly}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
      </mesh>

      {state.lightsOn && !overlayOnly ? (
        <>
          <pointLight
            position={[-2.2, HEADLIGHT_Y + 0.02, 0.45]}
            intensity={state.engineOn ? 4.8 : 3.8}
            distance={5.5}
            color="#fef3c7"
          />
          <pointLight
            position={[-2.2, HEADLIGHT_Y + 0.02, -0.45]}
            intensity={state.engineOn ? 4.8 : 3.8}
            distance={5.5}
            color="#fef3c7"
          />
        </>
      ) : null}

      <mesh ref={exhaustLeftRef} position={[1.7, 0.02, 0.42]} visible={!overlayOnly || state.engineOn}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#94a3b8" emissive="#cbd5e1" emissiveIntensity={0} />
      </mesh>
      <mesh
        ref={exhaustRightRef}
        position={[1.7, 0.02, -0.42]}
        visible={!overlayOnly || state.engineOn}
      >
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#94a3b8" emissive="#cbd5e1" emissiveIntensity={0} />
      </mesh>
    </group>
  );
}
