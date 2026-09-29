import * as THREE from "three";

/** Coast and brake match the wheel-spin integrator on the car. */
export const DRIVE_DAMP_COAST = 4;
export const DRIVE_DAMP_BRAKE = 14;

export function driveTargetSpeedMps(engineOn: boolean, speedKph: number) {
  return engineOn ? speedKph / 3.6 : 0;
}

export function stepDriveSpeedMps(
  currentMps: number,
  targetMps: number,
  braking: boolean,
  deltaSeconds: number,
) {
  return THREE.MathUtils.damp(
    currentMps,
    targetMps,
    braking ? DRIVE_DAMP_BRAKE : DRIVE_DAMP_COAST,
    deltaSeconds,
  );
}

/**
 * Meters to slide roadside scenery along world +X.
 * Showroom forward is −X, so a positive speed (wheels rolling forward) moves
 * the road backward under the car. A negative speed moves it the other way.
 */
export function sceneryShiftX(speedMps: number, deltaSeconds: number) {
  return speedMps * deltaSeconds;
}

/** Fold `value` into `[min, min + span)`. */
export function wrapRange(value: number, min: number, span: number) {
  if (!(span > 0) || !Number.isFinite(value)) {
    return min;
  }
  const relative = value - min;
  const wrapped = ((relative % span) + span) % span;
  return min + wrapped;
}

/**
 * Window that keeps a row of objects one `gap` apart after they scroll off the end.
 * `min` / `max` are the placed positions, including jitter.
 */
export function repeatWindow(min: number, max: number, gap: number) {
  const span = Math.max(gap, max - min + gap);
  return { min, span };
}

/** Fold a texture offset into `[0, 1)`. */
export function wrapUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

/**
 * U offset for a plane whose +U is world +X.
 * Increasing Three.js `offset.x` samples a later texel, so the pattern slides
 * toward −X. A positive `travelX` (scenery moving toward +X) therefore uses a
 * negative offset.
 */
export function wrappedTextureOffset(travelX: number, worldLength: number, repeat: number) {
  if (!(worldLength > 0) || !Number.isFinite(travelX)) {
    return 0;
  }
  return wrapUnit((-(travelX / worldLength)) * repeat);
}
