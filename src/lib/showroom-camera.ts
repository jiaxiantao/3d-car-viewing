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
const TMP_OFFSET = new THREE.Vector3();

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
    const position = new THREE.Vector3(
      GEOMETRIC_CABIN_CENTER.x - 0.35,
      GEOMETRIC_CABIN_CENTER.y + 0.22,
      GEOMETRIC_STEERING.z + 0.24,
    );
    return {
      position,
      target: cockpitRoadTarget(position, 0),
    };
  }
  return {
    position: new THREE.Vector3(5.2, 2.4, 4.6),
    target: new THREE.Vector3(0, GEOMETRIC_CABIN_CENTER.y, 0),
  };
}

/** Exterior-style cockpit for models without a separate steering mesh (BMW M2). */
export const COCKPIT_CAMERA_FOV = 52;

/** Closer to a real wheel, so a wider lens keeps the rim from filling the frame. */
export const COCKPIT_WHEEL_FOV = 64;

/**
 * Downward pitch from the driver's eye to a point on the road ahead.
 * Steep enough that the windshield shows ground, shallow enough to stay inside
 * the orbit polar clamp (about 0.6–1.5 rad).
 */
const COCKPIT_ROAD_PITCH = 0.42;

/** Look from the driver's eye toward the ground in front of the car (forward = −X). */
function cockpitRoadTarget(eye: THREE.Vector3, groundY: number, pitch = COCKPIT_ROAD_PITCH) {
  const roadY = groundY + 0.04;
  const drop = Math.max(eye.y - roadY, 0.35);
  const ahead = drop / Math.tan(pitch);
  return new THREE.Vector3(eye.x - ahead, roadY, eye.z);
}

/**
 * Cars whose cabin mesh does not match the shared driver's-eye guess.
 * Fractions are of the normalized bounds: x from the front bumper, y from the
 * ground, z from the center toward the driver (+Z).
 */
const COCKPIT_PROFILE_TUNES: Record<
  string,
  {
    eyeBack?: number;
    eyeUp?: number;
    pitch?: number;
    seat?: { x: number; y: number; z: number };
  }
> = {
  // Shared eye sits in the tall YU7 rim. A higher eye clears it, but 0.38m
  // puts the head against the roof. 0.24m stays just above the rim; the shallow
  // pitch keeps the look ray out the windshield instead of into the wheel.
  "xiaomi-yu7": { eyeBack: 0.46, eyeUp: 0.24, pitch: 0.12 },
  // M2 has no steering mesh. x=0.40 lands on the hood; the shared fallback sits
  // in the rear cabin. 0.536 is about 10cm behind the cowl seat so the rim
  // enters the lower frame, while the look ray still clears the bonnet.
  "bmw-m2": { pitch: 0.14, seat: { x: 0.536, y: 0.805, z: 0.149 } },
};

/**
 * Driver's-eye view out the windshield.
 * Showroom forward is −X, so the driver sits at a larger X than the wheel.
 * The eye stays just behind the rim; the gaze is pitched down at the road so
 * the ground is visible instead of a level view into the sky.
 */
export function getCockpitCameraPose(
  bounds: THREE.Box3,
  steeringWheelCenter?: THREE.Vector3 | null,
  profileId?: string | null,
): ShowroomCameraPose {
  const size = bounds.getSize(TMP_SIZE);
  const center = bounds.getCenter(TMP_CENTER);
  const tune = profileId ? COCKPIT_PROFILE_TUNES[profileId] : undefined;
  if (!steeringWheelCenter && tune?.seat) {
    const position = new THREE.Vector3(
      bounds.min.x + size.x * tune.seat.x,
      bounds.min.y + size.y * tune.seat.y,
      center.z + size.z * tune.seat.z,
    );
    return {
      position,
      target: cockpitRoadTarget(position, bounds.min.y, tune.pitch),
    };
  }
  if (steeringWheelCenter) {
    const wheel = steeringWheelCenter.clone();
    const eyeBack = tune?.eyeBack ?? Math.min(0.42, size.x * 0.11);
    const eyeUp = tune?.eyeUp ?? Math.min(0.28, Math.max(0.18, size.y * 0.13));
    const towardCenter = Math.sign(center.z - wheel.z) || 1;
    const eyeSide = Math.min(0.04, size.z * 0.025) * towardCenter;
    const position = new THREE.Vector3(wheel.x + eyeBack, wheel.y + eyeUp, wheel.z + eyeSide);
    return {
      position,
      target: cockpitRoadTarget(position, bounds.min.y, tune?.pitch),
    };
  }
  const wheel = new THREE.Vector3(
    bounds.min.x + size.x * 0.4,
    bounds.min.y + size.y * 0.58,
    center.z + size.z * 0.18,
  );
  const eyeBack = Math.min(0.78, size.x * 0.18);
  const eyeUp = Math.min(0.1, size.y * 0.06);
  const towardCenter = Math.sign(center.z - wheel.z) || 1;
  const eyeSide = Math.min(0.05, size.z * 0.04) * towardCenter;
  const position = new THREE.Vector3(wheel.x + eyeBack, wheel.y + eyeUp, wheel.z + eyeSide);
  return {
    position,
    target: cockpitRoadTarget(position, bounds.min.y, tune?.pitch),
  };
}

/** Camera poses derived from normalized GLB bounds (showroom forward = −X). */
export function getBoundsCameraPose(
  preset: ShowroomCameraPreset,
  bounds: THREE.Box3,
  steeringWheelCenter?: THREE.Vector3 | null,
  profileId?: string | null,
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
    return getCockpitCameraPose(bounds, steeringWheelCenter, profileId);
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
  steeringWheelCenter?: THREE.Vector3 | null,
  profileId?: string | null,
): ShowroomCameraPose {
  if (bounds && !bounds.isEmpty()) {
    return getBoundsCameraPose(preset, bounds, steeringWheelCenter, profileId);
  }
  return getGeometricCameraPose(preset);
}

/**
 * OrbitControls swings the camera around `target`. The cockpit gaze target sits
 * on the road ahead, so a raw drag would carry the eye out of the seat.
 * This shifts the camera/target pair so the eye stays on `pivot` (the driver's
 * viewpoint) while the dragged gaze direction is kept.
 * The camera-to-target offset is preserved, so damping and the orbit clamps
 * stay valid. A radius change dollies along that gaze from the seat.
 */
export function anchorCockpitOrbit(
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  pivot: THREE.Vector3,
  baseRadius: number,
) {
  TMP_OFFSET.copy(cameraPosition).sub(target);
  const radius = TMP_OFFSET.length();
  if (radius < 1e-5 || baseRadius < 1e-5) {
    cameraPosition.copy(pivot);
    return;
  }
  const dolly = baseRadius - radius;
  cameraPosition.copy(pivot).addScaledVector(TMP_OFFSET, -dolly / radius);
  target.copy(cameraPosition).sub(TMP_OFFSET);
}

/** Interior shots sit well inside the exterior orbit clamp. */
const COCKPIT_MIN_DISTANCE = 0.18;

export function getOrbitDistanceLimits(
  bounds: THREE.Box3 | null | undefined,
  preset?: ShowroomCameraPreset,
) {
  if (!bounds || bounds.isEmpty()) {
    return preset === "cockpit"
      ? { minDistance: COCKPIT_MIN_DISTANCE, maxDistance: 9 }
      : { minDistance: 3.8, maxDistance: 9 };
  }
  const size = bounds.getSize(TMP_SIZE);
  const span = Math.max(size.x, size.y, size.z, 1e-3);
  const exteriorMin = Math.max(2.6, span * 0.42);
  return {
    minDistance: preset === "cockpit" ? COCKPIT_MIN_DISTANCE : exteriorMin,
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
