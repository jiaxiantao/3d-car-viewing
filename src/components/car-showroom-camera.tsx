import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import {
  COCKPIT_CAMERA_FOV,
  COCKPIT_WHEEL_FOV,
  anchorCockpitOrbit,
  resolveShowroomCameraPose,
  sampleAutoTourPose,
} from "@/lib/showroom-camera";

import type { CarCameraPreset } from "@/components/car-showroom-scene";
import type { OrbitControlsLike } from "@/components/car-showroom-scene";

type CameraRigProps = {
  preset: CarCameraPreset;
  autoTour: boolean;
  controlsRef: { current: OrbitControlsLike | null | undefined };
  framingBounds: THREE.Box3 | null;
  framingBoundsKey: string;
  steeringWheelCenter?: THREE.Vector3 | null;
  profileId?: string | null;
};

export function CameraRig({
  preset,
  autoTour,
  controlsRef,
  framingBounds,
  framingBoundsKey,
  steeringWheelCenter = null,
  profileId = null,
}: CameraRigProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const fromPositionRef = useRef(new THREE.Vector3(5.2, 2.4, 4.6));
  const toPositionRef = useRef(new THREE.Vector3(5.2, 2.4, 4.6));
  const fromTargetRef = useRef(new THREE.Vector3(0, 0.45, 0));
  const toTargetRef = useRef(new THREE.Vector3(0, 0.45, 0));
  const transitionProgressRef = useRef(1);
  const prevPresetRef = useRef<CarCameraPreset | null>(null);
  const prevFramingBoundsKeyRef = useRef(framingBoundsKey);
  const prevProfileIdRef = useRef(profileId);
  const prevAutoTourRef = useRef(autoTour);
  const tourPositionRef = useRef(new THREE.Vector3());
  const tourTargetRef = useRef(new THREE.Vector3());
  const lerpPositionRef = useRef(new THREE.Vector3());
  const lerpTargetRef = useRef(new THREE.Vector3());
  const cockpitPivotRef = useRef(new THREE.Vector3());
  const cockpitBaseRadiusRef = useRef(0);
  const cockpitPoseReadyRef = useRef(false);
  const cockpitAnchoredRef = useRef(false);

  const beginTransitionToPreset = useCallback(
    (nextPreset: CarCameraPreset) => {
      const camera = cameraRef.current;
      if (!camera) {
        return;
      }
      const controls = controlsRef.current;
      const currentTarget = controls?.target.clone() ?? toTargetRef.current.clone();
      fromPositionRef.current.copy(camera.position);
      fromTargetRef.current.copy(currentTarget);
      const nextPose = resolveShowroomCameraPose(
        nextPreset,
        framingBounds,
        steeringWheelCenter,
        profileId,
      );
      toPositionRef.current.copy(nextPose.position);
      toTargetRef.current.copy(nextPose.target);
      transitionProgressRef.current = 0;
      cockpitPoseReadyRef.current = nextPreset === "cockpit";
      cockpitAnchoredRef.current = false;
    },
    [controlsRef, framingBounds, profileId, steeringWheelCenter],
  );

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const cockpitFov = steeringWheelCenter ? COCKPIT_WHEEL_FOV : COCKPIT_CAMERA_FOV;
    camera.fov = preset === "cockpit" ? cockpitFov : 45;
    camera.updateProjectionMatrix();
  }, [preset, steeringWheelCenter]);

  useEffect(() => {
    if (autoTour) {
      prevPresetRef.current = preset;
      prevFramingBoundsKeyRef.current = framingBoundsKey;
      prevProfileIdRef.current = profileId;
      return;
    }

    const presetChanged = prevPresetRef.current !== preset;
    const boundsChanged = prevFramingBoundsKeyRef.current !== framingBoundsKey;
    const profileChanged = prevProfileIdRef.current !== profileId;
    prevPresetRef.current = preset;
    prevFramingBoundsKeyRef.current = framingBoundsKey;
    prevProfileIdRef.current = profileId;

    if (!presetChanged && !boundsChanged && !profileChanged) {
      return;
    }

    beginTransitionToPreset(preset);
  }, [autoTour, beginTransitionToPreset, framingBoundsKey, preset, profileId]);

  useEffect(() => {
    const wasAutoTour = prevAutoTourRef.current;
    prevAutoTourRef.current = autoTour;
    if (autoTour || !wasAutoTour) {
      return;
    }
    beginTransitionToPreset(preset);
  }, [autoTour, beginTransitionToPreset, preset]);

  useFrame((renderState, delta) => {
    if (!cameraRef.current) {
      return;
    }
    const controls = controlsRef.current;
    if (autoTour) {
      sampleAutoTourPose(
        framingBounds,
        renderState.clock.elapsedTime,
        tourPositionRef.current,
        tourTargetRef.current,
      );
      cameraRef.current.position.lerp(
        tourPositionRef.current,
        THREE.MathUtils.clamp(delta * 2, 0, 1),
      );
      if (controls) {
        controls.target.copy(tourTargetRef.current);
        controls.update();
      } else {
        cameraRef.current.lookAt(tourTargetRef.current);
      }
      return;
    }

    if (transitionProgressRef.current < 1) {
      transitionProgressRef.current = Math.min(1, transitionProgressRef.current + delta * 2.3);
      const alpha = THREE.MathUtils.smootherstep(transitionProgressRef.current, 0, 1);
      lerpPositionRef.current.lerpVectors(fromPositionRef.current, toPositionRef.current, alpha);
      lerpTargetRef.current.lerpVectors(fromTargetRef.current, toTargetRef.current, alpha);
      cameraRef.current.position.copy(lerpPositionRef.current);
      if (controls) {
        controls.target.copy(lerpTargetRef.current);
        controls.update();
      } else {
        cameraRef.current.lookAt(lerpTargetRef.current);
      }
    }
  });

  // Runs after OrbitControls.update (priority -1) so the rendered frame
  // already has the eye back on the cockpit viewpoint.
  useFrame(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (
      !camera ||
      !controls ||
      preset !== "cockpit" ||
      autoTour ||
      !cockpitPoseReadyRef.current ||
      transitionProgressRef.current < 1
    ) {
      cockpitAnchoredRef.current = false;
      return;
    }
    if (!cockpitAnchoredRef.current) {
      cockpitPivotRef.current.copy(toPositionRef.current);
      cockpitBaseRadiusRef.current = toPositionRef.current.distanceTo(toTargetRef.current);
      cockpitAnchoredRef.current = true;
    }
    anchorCockpitOrbit(
      camera.position,
      controls.target,
      cockpitPivotRef.current,
      cockpitBaseRadiusRef.current,
    );
    camera.lookAt(controls.target);
  }, -2);

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={45} position={[5.2, 2.4, 4.6]} />;
}

