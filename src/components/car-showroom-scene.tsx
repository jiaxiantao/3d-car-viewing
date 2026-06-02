"use client";

import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  ASSET_DOOR_MAX_OPEN_RADIANS,
  ASSET_TRUNK_MAX_OPEN_RADIANS,
  applyWheelMotion,
  boostShowroomMaterialEmissive,
  discoverAssetCarRig,
  SHOWROOM_HEADLAMP_INTENSITY,
  SHOWROOM_HAZARD_INTENSITY,
  SHOWROOM_TAIL_LAMP_COLOR,
  type AssetCarRig,
} from "@/lib/asset-car-rig";
import { normalizeMarketModel } from "@/lib/normalize-market-model";
import { getOrbitDistanceLimits, type ShowroomCameraPreset } from "@/lib/showroom-camera";
import {
  SHOWROOM_GROUND_Y,
  SHOWROOM_SCENE_LIGHTING,
  ShowroomHeadlightSpotlights,
  ShowroomImageBasedLighting,
  ShowroomReflectiveFloor,
} from "@/components/showroom-environment";
import { CameraRig } from "@/components/car-showroom-camera";

export type OrbitControlsLike = {
  target: THREE.Vector3;
  update: () => void;
};

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
const ENGINE_IGNITION_DURATION = 0.9;
/** Keep overlay visible long enough to perceive when GLB is cached locally. */
const MIN_LOADING_OVERLAY_MS = 480;
const HAZARD_MIN_EMISSIVE = { minActiveIntensity: 0 };
const SHOWROOM_TAIL_LAMP_HEX = `#${new THREE.Color(SHOWROOM_TAIL_LAMP_COLOR).getHexString()}`;

const sharedGltfLoader = new GLTFLoader();
const gltfSceneCache = new Map<string, THREE.Object3D>();
const GLTF_SCENE_CACHE_LIMIT = 6;

const interactivePointerHandlers = {
  onPointerOver: (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
  },
  onPointerOut: () => {
    document.body.style.cursor = "";
  },
};

function ShowroomAccentLights({
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

export type CarCameraPreset = ShowroomCameraPreset;

type CarShowroomState = {
  leftDoorOpen: boolean;
  rightDoorOpen: boolean;
  trunkOpen: boolean;
  lightsOn: boolean;
  engineOn: boolean;
  seatDriverOffset: number;
  seatPassengerOffset: number;
  steeringAngle: number;
  hazardOn: boolean;
  sunroofOpen: boolean;
  bodyColor: string;
  bodyColorSecondary: string | null;
  speedKph: number;
  braking: boolean;
};

export type AssetRigCapabilities = AssetCarRig["capabilities"];
export type AssetRigDebug = AssetCarRig["debug"];

type AssetLoadState = "idle" | "loading" | "ready" | "error";

type CarShowroomSceneProps = {
  state: CarShowroomState;
  cameraPreset: CarCameraPreset;
  autoTour: boolean;
  useAssetModel: boolean;
  modelUrl?: string;
  modelAlternateUrls?: string[];
  modelFallbackUrl?: string;
  onAssetRigCapabilities?: (capabilities: AssetRigCapabilities | null) => void;
  onAssetRigDebug?: (debug: AssetRigDebug | null) => void;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
};

function disposeLoadedScene(root: THREE.Object3D) {
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

async function loadGltfScene(url: string, onProgress?: (ratio: number) => void) {
  const cached = gltfSceneCache.get(url);
  if (cached) {
    const instance = cached.clone(true);
    // Object3D.clone deep-copies userData as plain JSON, so Box3 methods are lost.
    // Rebuild rig on each cloned instance to keep runtime helpers like bounds.isEmpty().
    instance.userData.showroomRig = discoverAssetCarRig(instance, url);
    onProgress?.(1);
    return instance;
  }

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
        if (gltfSceneCache.size > GLTF_SCENE_CACHE_LIMIT) {
          const oldestKey = gltfSceneCache.keys().next().value as string | undefined;
          if (oldestKey && oldestKey !== url) {
            const stale = gltfSceneCache.get(oldestKey);
            if (stale) {
              disposeLoadedScene(stale);
            }
            gltfSceneCache.delete(oldestKey);
          }
        }
        const loadedScene = templateScene.clone(true);
        const rig = discoverAssetCarRig(loadedScene, url);
        loadedScene.userData.showroomRig = rig;
        onProgress?.(1);
        resolve(loadedScene);
      },
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress?.(Math.min(0.92, event.loaded / event.total));
          return;
        }
        if (event.loaded > 0) {
          // Some static hosts omit Content-Length; approximate from bytes loaded.
          onProgress?.(Math.min(0.75, event.loaded / 48_000_000));
        }
      },
      reject,
    );
  });
}

type CarModelProps = {
  state: CarShowroomState;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  overlayOnly?: boolean;
};

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

function AssetModel({
  object,
  rig,
  state,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
}: {
  object: THREE.Object3D;
  rig: AssetCarRig;
  state: CarShowroomState;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
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
  const sunroofBaseYRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    wheelSpinAngleRef.current = 0;
    wheelSteerAngleRef.current = 0;
    prevEngineOnRef.current = false;
    ignitionTimeRef.current = 0;
    sunroofBaseYRef.current.clear();
    for (const node of rig.sunroofNodes) {
      sunroofBaseYRef.current.set(node.uuid, node.position.y);
    }
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
    const hazardPulse = state.hazardOn ? (Math.sin(t * 8) > 0 ? 1 : 0) : 0;
    const hazardActive = hazardPulse > 0;
    if (state.engineOn && !prevEngineOnRef.current) {
      ignitionTimeRef.current = ENGINE_IGNITION_DURATION;
    }
    prevEngineOnRef.current = state.engineOn;
    ignitionTimeRef.current = Math.max(0, ignitionTimeRef.current - delta);
    const ignitionProgress = ignitionTimeRef.current / ENGINE_IGNITION_DURATION;
    const ignitionPulse = Math.sin(ignitionProgress * Math.PI);

    if (rig.leftDoorPivot) {
      const target = state.leftDoorOpen ? -ASSET_DOOR_MAX_OPEN_RADIANS : 0;
      rig.leftDoorPivot.rotation.y = THREE.MathUtils.damp(
        rig.leftDoorPivot.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (rig.rightDoorPivot) {
      const target = state.rightDoorOpen ? ASSET_DOOR_MAX_OPEN_RADIANS : 0;
      rig.rightDoorPivot.rotation.y = THREE.MathUtils.damp(
        rig.rightDoorPivot.rotation.y,
        target,
        8,
        delta,
      );
    }
    if (rig.trunkPivot) {
      const target = state.trunkOpen ? ASSET_TRUNK_MAX_OPEN_RADIANS : 0;
      rig.trunkPivot.rotation.z = THREE.MathUtils.damp(rig.trunkPivot.rotation.z, target, 7, delta);
    }

    for (const node of rig.sunroofNodes) {
      const baseY = sunroofBaseYRef.current.get(node.uuid) ?? node.position.y;
      node.position.y = THREE.MathUtils.damp(
        node.position.y,
        state.sunroofOpen ? baseY + 0.14 : baseY,
        7,
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
      const engineYOffset = state.engineOn ? Math.sin(t * 8) * 0.02 : 0;
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
    const tailLit = state.lightsOn || hazardActive;
    const tailIntensity = state.lightsOn
      ? 1.1 + hazardPulse * SHOWROOM_HAZARD_INTENSITY.withHeadlights
      : hazardPulse * SHOWROOM_HAZARD_INTENSITY.on;
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

function CarModel({
  state,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
  overlayOnly = false,
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
    const hazardPulse = state.hazardOn ? (Math.sin(t * 8) > 0 ? 1 : 0) : 0;
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
      const engineYOffset = state.engineOn ? Math.sin(t * 8) * 0.02 : 0;
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
    const rearIntensity = state.lightsOn
      ? THREE.MathUtils.clamp(0.4 + hazardPulse * withHeadlights, tailMin, tailMax)
      : THREE.MathUtils.clamp(hazardPulse * on, 0, tailMax);
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

const LOADER_OVERLAY_STYLES = `
@keyframes showroom-loader-spin {
  to { transform: rotate(360deg); }
}
@keyframes showroom-loader-bar-indeterminate {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
`;

function ShowroomAssetLoadingOverlay({
  visible,
  displayProgress,
}: {
  visible: boolean;
  displayProgress: number;
}) {
  if (!visible) {
    return null;
  }

  const percent = Math.round(Math.min(100, Math.max(displayProgress, 0.08) * 100));
  const showIndeterminateBar = displayProgress < 0.2;

  return (
    <Html
      fullscreen
      zIndexRange={[200, 0]}
      style={{
        pointerEvents: "none",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: LOADER_OVERLAY_STYLES }} />
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(2, 6, 23, 0.5)",
          backdropFilter: "blur(2px)",
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            display: "flex",
            minWidth: 220,
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            borderRadius: 16,
            border: "1px solid rgba(34, 211, 238, 0.25)",
            background: "rgba(2, 6, 23, 0.92)",
            padding: "24px 32px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "2px solid rgba(34, 211, 238, 0.25)",
              borderTopColor: "rgb(34, 211, 238)",
              animation: "showroom-loader-spin 0.75s linear infinite",
            }}
          />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#f1f5f9" }}>
            正在切换车型…
          </p>
          <div
            style={{
              width: "100%",
              height: 6,
              overflow: "hidden",
              borderRadius: 999,
              background: "rgb(30, 41, 59)",
            }}
          >
            {showIndeterminateBar ? (
              <div
                style={{
                  width: "38%",
                  height: "100%",
                  borderRadius: 999,
                  background: "rgb(34, 211, 238)",
                  animation: "showroom-loader-bar-indeterminate 1.15s ease-in-out infinite",
                }}
              />
            ) : (
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "rgb(34, 211, 238)",
                  transition: "width 160ms ease-out",
                }}
              />
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{percent}%</p>
        </div>
      </div>
    </Html>
  );
}

export function CarShowroomScene({
  state,
  cameraPreset,
  autoTour,
  useAssetModel,
  modelUrl = "/models/market/suv-mainstream.glb",
  modelAlternateUrls,
  modelFallbackUrl,
  onAssetRigCapabilities,
  onAssetRigDebug,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
}: CarShowroomSceneProps) {
  const [assetScene, setAssetScene] = useState<THREE.Object3D | null>(null);
  const [assetRig, setAssetRig] = useState<AssetCarRig | null>(null);
  const [assetLoadState, setAssetLoadState] = useState<AssetLoadState>("idle");
  const [useGeometricFallback, setUseGeometricFallback] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const controlsRef = useRef(null);
  const displayedRootRef = useRef<THREE.Object3D | null>(null);

  const environmentIntensity =
    state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
      ? SHOWROOM_SCENE_LIGHTING.environmentIntensity.headlightsOn
      : SHOWROOM_SCENE_LIGHTING.environmentIntensity.base;

  const isAssetLoading = useAssetModel && assetLoadState === "loading";
  const [overlayHoldUntil, setOverlayHoldUntil] = useState(0);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false);
  const [displayedLoadProgress, setDisplayedLoadProgress] = useState(0);

  useEffect(() => {
    if (isAssetLoading) {
      const frame = requestAnimationFrame(() => setLoadingOverlayVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const remaining = overlayHoldUntil - Date.now();
    if (remaining <= 0) {
      const frame = requestAnimationFrame(() => {
        setLoadingOverlayVisible(false);
        setDisplayedLoadProgress(0);
      });
      return () => cancelAnimationFrame(frame);
    }

    const timer = window.setTimeout(() => {
      setLoadingOverlayVisible(false);
      setDisplayedLoadProgress(0);
      setOverlayHoldUntil(0);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [isAssetLoading, overlayHoldUntil]);

  useEffect(() => {
    if (!loadingOverlayVisible) {
      return;
    }

    const timer = window.setInterval(() => {
      setDisplayedLoadProgress((prev) => {
        const synthetic = Math.min(0.92, prev + 0.028);
        const fromNetwork = loadProgress > 0 ? loadProgress * 0.96 : 0;
        return Math.max(prev, synthetic, fromNetwork);
      });
    }, 90);

    return () => window.clearInterval(timer);
  }, [loadProgress, loadingOverlayVisible]);

  const showGeometricCar = !useAssetModel || useGeometricFallback;
  const showAssetCar =
    useAssetModel && !useGeometricFallback && assetScene && assetRig;

  const framingBounds = showAssetCar && assetRig ? assetRig.bounds : null;
  const framingBoundsKey = useMemo(() => {
    if (!framingBounds || typeof (framingBounds as THREE.Box3).isEmpty !== "function") {
      return "";
    }
    if ((framingBounds as THREE.Box3).isEmpty()) {
      return "";
    }
    return [
      framingBounds.min.x,
      framingBounds.min.y,
      framingBounds.min.z,
      framingBounds.max.x,
      framingBounds.max.y,
      framingBounds.max.z,
    ]
      .map((value) => value.toFixed(2))
      .join("|");
  }, [framingBounds]);

  const orbitLimits = useMemo(() => getOrbitDistanceLimits(framingBounds), [framingBounds]);

  const modelUrlChainKey = useMemo(
    () => [modelUrl, ...(modelAlternateUrls ?? []), modelFallbackUrl ?? ""].join("\0"),
    [modelAlternateUrls, modelFallbackUrl, modelUrl],
  );

  useEffect(() => {
    if (!useAssetModel) {
      if (displayedRootRef.current) {
        disposeLoadedScene(displayedRootRef.current);
        displayedRootRef.current = null;
      }
      queueMicrotask(() => {
        setAssetLoadState("idle");
        setUseGeometricFallback(false);
        setAssetScene(null);
        setAssetRig(null);
        setOverlayHoldUntil(0);
        onAssetRigCapabilities?.(null);
        onAssetRigDebug?.(null);
      });
      return;
    }

    let active = true;
    const candidateUrls = [modelUrl, ...(modelAlternateUrls ?? []), modelFallbackUrl].filter(
      (url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index,
    );

    queueMicrotask(() => {
      setAssetLoadState("loading");
      setLoadProgress(0);
      setUseGeometricFallback(false);
      onAssetRigCapabilities?.(null);
      onAssetRigDebug?.(null);
    });

    const tryLoad = async (index: number) => {
      if (!active) {
        return;
      }
      if (index >= candidateUrls.length) {
        if (displayedRootRef.current) {
          disposeLoadedScene(displayedRootRef.current);
          displayedRootRef.current = null;
        }
        setAssetScene(null);
        setAssetRig(null);
        setAssetLoadState("error");
        setUseGeometricFallback(true);
        onAssetRigCapabilities?.({
          leftDoor: true,
          rightDoor: true,
          trunk: true,
          sunroof: true,
          headLights: true,
          tailLights: true,
          wheels: true,
          wheelsSynthetic: false,
        });
        onAssetRigDebug?.(null);
        return;
      }

      const url = candidateUrls[index];
      try {
        const loadedScene = await loadGltfScene(url, (ratio) => {
          if (active) {
            setLoadProgress(ratio);
          }
        });
        if (!active) {
          disposeLoadedScene(loadedScene);
          return;
        }
        if (displayedRootRef.current && displayedRootRef.current !== loadedScene) {
          disposeLoadedScene(displayedRootRef.current);
        }
        displayedRootRef.current = loadedScene;
        const rig = loadedScene.userData.showroomRig as AssetCarRig;
        setLoadProgress(1);
        setOverlayHoldUntil(Date.now() + MIN_LOADING_OVERLAY_MS);
        setAssetRig(rig);
        setAssetScene(loadedScene);
        setAssetLoadState("ready");
        onAssetRigCapabilities?.(rig.capabilities);
        onAssetRigDebug?.(rig.debug);
      } catch {
        await tryLoad(index + 1);
      }
    };

    void tryLoad(0);

    return () => {
      active = false;
    };
    // modelUrlChainKey aggregates modelUrl / alternates / fallback to avoid redundant reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional chain key
  }, [modelUrlChainKey, onAssetRigCapabilities, onAssetRigDebug, useAssetModel]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-4xl border border-white/10 bg-slate-950/80">
      {useAssetModel && assetLoadState === "error" ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
          <p className="rounded-full border border-amber-400/30 bg-amber-950/80 px-3 py-1 text-xs text-amber-100">
            GLB 加载失败，已切换为几何体车模
          </p>
        </div>
      ) : null}
      <Canvas className="h-full w-full" shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]}>
        <CameraRig
          preset={cameraPreset}
          autoTour={autoTour}
          controlsRef={controlsRef}
          framingBounds={framingBounds}
          framingBoundsKey={framingBoundsKey}
        />
        <color attach="background" args={["#070d18"]} />
        <ShowroomImageBasedLighting intensity={environmentIntensity} />
        <hemisphereLight
          args={[
            SHOWROOM_SCENE_LIGHTING.hemisphere.sky,
            SHOWROOM_SCENE_LIGHTING.hemisphere.ground,
            SHOWROOM_SCENE_LIGHTING.hemisphere.intensity,
          ]}
        />
        <ambientLight
          intensity={
            state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
              ? SHOWROOM_SCENE_LIGHTING.ambient.headlightsOn
              : SHOWROOM_SCENE_LIGHTING.ambient.base
          }
        />
        <ShowroomAccentLights
          lightsOn={state.lightsOn}
          cameraPreset={cameraPreset}
          useAssetModel={Boolean(showAssetCar)}
          assetScene={showAssetCar ? assetScene : null}
        />
        <directionalLight
          position={[5, 8, 3]}
          intensity={
            state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
              ? SHOWROOM_SCENE_LIGHTING.directional.headlightsOn
              : SHOWROOM_SCENE_LIGHTING.directional.base
          }
          castShadow
          shadow-mapSize-height={1024}
          shadow-mapSize-width={1024}
        />
        <directionalLight
          position={[-3, 4, -2]}
          intensity={SHOWROOM_SCENE_LIGHTING.rimDirectional}
          color="#94a3b8"
        />
        <ShowroomHeadlightSpotlights lightsOn={state.lightsOn} rig={assetRig} />
        <pointLight
          position={[-4, 2, -3]}
          intensity={SHOWROOM_SCENE_LIGHTING.fillPoint}
          color="#93c5fd"
        />

        {showAssetCar ? (
          <AssetModel
            object={assetScene}
            rig={assetRig}
            state={state}
            onToggleLeftDoor={onToggleLeftDoor}
            onToggleRightDoor={onToggleRightDoor}
            onToggleTrunk={onToggleTrunk}
          />
        ) : showGeometricCar ? (
          <CarModel
            state={state}
            onToggleLeftDoor={onToggleLeftDoor}
            onToggleRightDoor={onToggleRightDoor}
            onToggleTrunk={onToggleTrunk}
          />
        ) : null}

        <ShowroomReflectiveFloor
          lightsOn={state.lightsOn}
          headLightsActive={
            useAssetModel ? Boolean(assetRig?.capabilities.headLights) : state.lightsOn
          }
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={!autoTour}
          minDistance={orbitLimits.minDistance}
          maxDistance={orbitLimits.maxDistance}
          minPolarAngle={0.6}
          maxPolarAngle={1.5}
        />
        <ShowroomAssetLoadingOverlay
          visible={loadingOverlayVisible}
          displayProgress={displayedLoadProgress}
        />
      </Canvas>
    </div>
  );
}
