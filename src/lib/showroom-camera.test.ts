import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { anchorCockpitOrbit, resolveShowroomCameraPose } from "@/lib/showroom-camera";
import type { ShowroomCameraPose } from "@/lib/showroom-camera";

function orbitCameraAroundTarget(
  camera: THREE.Vector3,
  target: THREE.Vector3,
  deltaTheta: number,
  deltaPhi = 0,
) {
  const offset = camera.clone().sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += deltaTheta;
  spherical.phi += deltaPhi;
  spherical.makeSafe();
  offset.setFromSpherical(spherical);
  camera.copy(target).add(offset);
}

function expectDragStaysOnEye(pose: ShowroomCameraPose) {
  const pivot = pose.position.clone();
  const camera = pose.position.clone();
  const target = pose.target.clone();
  const roadTarget = pose.target.clone();
  const baseRadius = camera.distanceTo(target);
  const before = new THREE.Spherical().setFromVector3(camera.clone().sub(target));

  anchorCockpitOrbit(camera, target, pivot, baseRadius);
  expect(camera.distanceTo(pivot)).toBeLessThan(1e-8);
  expect(target.distanceTo(roadTarget)).toBeLessThan(1e-8);

  orbitCameraAroundTarget(camera, target, 0.7, -0.05);
  expect(camera.distanceTo(pivot)).toBeGreaterThan(0.15);

  anchorCockpitOrbit(camera, target, pivot, baseRadius);

  expect(camera.distanceTo(pivot)).toBeLessThan(1e-6);
  expect(camera.distanceTo(target)).toBeCloseTo(baseRadius, 5);
  const after = new THREE.Spherical().setFromVector3(camera.clone().sub(target));
  expect(after.theta).toBeCloseTo(before.theta + 0.7, 5);
  expect(after.phi).toBeCloseTo(before.phi - 0.05, 5);
  expect(camera.distanceTo(roadTarget)).toBeGreaterThan(0.15);
}

describe("cockpit drag orbit", () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-2, -0.22, -0.9),
    new THREE.Vector3(2, 1.05, 0.9),
  );
  const wheel = new THREE.Vector3(-0.36, 0.55, 0.31);

  it("keeps every cockpit eye fixed while the gaze turns", () => {
    expectDragStaysOnEye(resolveShowroomCameraPose("cockpit", null, null));
    expectDragStaysOnEye(resolveShowroomCameraPose("cockpit", bounds, wheel));
    expectDragStaysOnEye(resolveShowroomCameraPose("cockpit", bounds, wheel, "xiaomi-yu7"));
    expectDragStaysOnEye(resolveShowroomCameraPose("cockpit", bounds, null, "bmw-m2"));
  });

  it("dollies along the gaze from the seat when the orbit radius changes", () => {
    const pose = resolveShowroomCameraPose("cockpit", bounds, wheel);
    const pivot = pose.position.clone();
    const camera = pose.position.clone();
    const target = pose.target.clone();
    const baseRadius = camera.distanceTo(target);
    const look = target.clone().sub(camera).normalize();

    const offset = camera.clone().sub(target).multiplyScalar(0.5);
    camera.copy(target).add(offset);
    anchorCockpitOrbit(camera, target, pivot, baseRadius);

    const moved = camera.clone().sub(pivot);
    expect(moved.dot(look)).toBeCloseTo(baseRadius * 0.5, 4);
    expect(moved.length()).toBeCloseTo(baseRadius * 0.5, 4);
    expect(target.clone().sub(camera).normalize().dot(look)).toBeCloseTo(1, 5);
  });
});
