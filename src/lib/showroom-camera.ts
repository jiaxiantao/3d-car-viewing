import * as THREE from "three";

export type ShowroomCameraPreset =
  | "overview"
  | "front"
  | "side-left"
  | "side-right"
  | "rear"
  | "cockpit";

export type ShowroomCameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

const TMP_SIZE = new THREE.Vector3();
const TMP_CENTER = new THREE.Vector3();

/** Geometric fallback car — matches procedural `CarModel` proportions. */
const GEOMETRIC_CABIN_CENTER = new THREE.Vector3(0.15, 0.57, 0);
const GEOMETRIC_STEERING = new THREE.Vector3(-0.63, 0.34, 0.34);

export function getGeometricCameraPose(preset: ShowroomCameraPreset): ShowroomCameraPose {
  if (preset === "front") {
    return {
      position: new THREE.Vector3(-5.6, 1.8, 0),
      target: new THREE.Vector3(-0.8, 0.5, 0),
    };
  }
  if (preset === "side-left") {
    return {
      position: new THREE.Vector3(0.2, 1.9, 6.3),
      target: new THREE.Vector3(0.1, 0.45, 0),
    };
  }
  if (preset === "side-right") {
    return {
      position: new THREE.Vector3(0.2, 1.9, -6.3),
      target: new THREE.Vector3(0.1, 0.45, 0),
    };
  }
  if (preset === "rear") {
    return {
      position: new THREE.Vector3(5.9, 1.9, 0),
      target: new THREE.Vector3(1.2, 0.6, 0),
    };
  }
  if (preset === "cockpit") {
    return {
      position: new THREE.Vector3(
        GEOMETRIC_CABIN_CENTER.x - 0.35,
        GEOMETRIC_CABIN_CENTER.y + 0.52,
        GEOMETRIC_STEERING.z + 0.24,
      ),
      target: new THREE.Vector3(
        GEOMETRIC_STEERING.x - 0.08,
        GEOMETRIC_STEERING.y + 0.12,
        GEOMETRIC_STEERING.z,
      ),
    };
  }
  return {
    position: new THREE.Vector3(5.2, 2.4, 4.6),
    target: new THREE.Vector3(0, GEOMETRIC_CABIN_CENTER.y, 0),
  };
}

/** Camera poses derived from normalized GLB bounds (showroom forward = −X). */
export function getBoundsCameraPose(
  preset: ShowroomCameraPreset,
  bounds: THREE.Box3,
): ShowroomCameraPose {
  const size = bounds.getSize(TMP_SIZE);
  const center = bounds.getCenter(TMP_CENTER);
  const span = Math.max(size.x, size.y, size.z, 1e-3);
  const dist = span * 1.28;

  if (preset === "front") {
    return {
      position: new THREE.Vector3(
        bounds.min.x - dist * 0.9,
        center.y + size.y * 0.28,
        center.z,
      ),
      target: new THREE.Vector3(
        bounds.min.x + size.x * 0.1,
        center.y + size.y * 0.2,
        center.z,
      ),
    };
  }
  if (preset === "side-left") {
    return {
      position: new THREE.Vector3(center.x, center.y + size.y * 0.42, bounds.max.z + dist * 0.95),
      target: new THREE.Vector3(center.x, center.y + size.y * 0.15, center.z),
    };
  }
  if (preset === "side-right") {
    return {
      position: new THREE.Vector3(center.x, center.y + size.y * 0.42, bounds.min.z - dist * 0.95),
      target: new THREE.Vector3(center.x, center.y + size.y * 0.15, center.z),
    };
  }
  if (preset === "rear") {
    return {
      position: new THREE.Vector3(
        bounds.max.x + dist * 0.9,
        center.y + size.y * 0.32,
        center.z,
      ),
      target: new THREE.Vector3(
        bounds.max.x - size.x * 0.12,
        center.y + size.y * 0.22,
        center.z,
      ),
    };
  }
  if (preset === "cockpit") {
    const driverZ = center.z + size.z * 0.22;
    return {
      position: new THREE.Vector3(
        bounds.min.x + size.x * 0.38,
        center.y + size.y * 0.38,
        driverZ,
      ),
      target: new THREE.Vector3(
        bounds.min.x + size.x * 0.18,
        center.y + size.y * 0.24,
        center.z,
      ),
    };
  }
  return {
    position: new THREE.Vector3(
      center.x + span * 0.92,
      center.y + span * 0.52,
      center.z + span * 0.78,
    ),
    target: new THREE.Vector3(center.x, center.y + size.y * 0.12, center.z),
  };
}

export function resolveShowroomCameraPose(
  preset: ShowroomCameraPreset,
  bounds: THREE.Box3 | null | undefined,
): ShowroomCameraPose {
  if (bounds && !bounds.isEmpty()) {
    return getBoundsCameraPose(preset, bounds);
  }
  return getGeometricCameraPose(preset);
}

export function getOrbitDistanceLimits(bounds: THREE.Box3 | null | undefined) {
  if (!bounds || bounds.isEmpty()) {
    return { minDistance: 3.8, maxDistance: 9 };
  }
  const size = bounds.getSize(TMP_SIZE);
  const span = Math.max(size.x, size.y, size.z, 1e-3);
  return {
    minDistance: Math.max(2.6, span * 0.42),
    maxDistance: Math.max(7.5, span * 2.35),
  };
}

export function sampleAutoTourPose(
  bounds: THREE.Box3 | null | undefined,
  elapsedSeconds: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
) {
  const t = elapsedSeconds * 0.22;
  if (bounds && !bounds.isEmpty()) {
    const size = bounds.getSize(TMP_SIZE);
    const center = bounds.getCenter(TMP_CENTER);
    const span = Math.max(size.x, size.y, size.z, 1e-3);
    const radius = span * 1.55;
    const targetY = center.y + size.y * 0.12 + Math.sin(t * 2) * span * 0.03;
    outTarget.set(center.x, targetY, center.z);
    outPosition.set(
      center.x + Math.cos(t) * radius,
      center.y + span * 0.45 + Math.sin(t * 2) * span * 0.04,
      center.z + Math.sin(t) * radius,
    );
    return;
  }
  const targetY = 0.7 + Math.sin(t * 2) * 0.12;
  outTarget.set(0, GEOMETRIC_CABIN_CENTER.y, 0);
  outPosition.set(Math.cos(t) * 6.3, 2 + targetY, Math.sin(t) * 6.3);
}
