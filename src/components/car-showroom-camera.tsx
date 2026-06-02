import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { resolveShowroomCameraPose, sampleAutoTourPose } from "@/lib/showroom-camera";

import type { CarCameraPreset } from "@/components/car-showroom-scene";
import type { OrbitControlsLike } from "@/components/car-showroom-scene";

type CameraRigProps = {
  preset: CarCameraPreset;
  autoTour: boolean;
  controlsRef: { current: OrbitControlsLike | null | undefined };
  framingBounds: THREE.Box3 | null;
  framingBoundsKey: string;
};

export function CameraRig({
  preset,
  autoTour,
  controlsRef,
  framingBounds,
  framingBoundsKey,
}: CameraRigProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const fromPositionRef = useRef(new THREE.Vector3(5.2, 2.4, 4.6));
  const toPositionRef = useRef(new THREE.Vector3(5.2, 2.4, 4.6));
  const fromTargetRef = useRef(new THREE.Vector3(0, 0.45, 0));
  const toTargetRef = useRef(new THREE.Vector3(0, 0.45, 0));
  const transitionProgressRef = useRef(1);
  const prevPresetRef = useRef<CarCameraPreset | null>(null);
  const prevFramingBoundsKeyRef = useRef(framingBoundsKey);
  const prevAutoTourRef = useRef(autoTour);
  const tourPositionRef = useRef(new THREE.Vector3());
  const tourTargetRef = useRef(new THREE.Vector3());
  const lerpPositionRef = useRef(new THREE.Vector3());
  const lerpTargetRef = useRef(new THREE.Vector3());

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
      const nextPose = resolveShowroomCameraPose(nextPreset, framingBounds);
      toPositionRef.current.copy(nextPose.position);
      toTargetRef.current.copy(nextPose.target);
      transitionProgressRef.current = 0;
    },
    [controlsRef, framingBounds],
  );

  useEffect(() => {
    if (autoTour) {
      prevPresetRef.current = preset;
      prevFramingBoundsKeyRef.current = framingBoundsKey;
      return;
    }

    const presetChanged = prevPresetRef.current !== preset;
    const boundsChanged = prevFramingBoundsKeyRef.current !== framingBoundsKey;
    prevPresetRef.current = preset;
    prevFramingBoundsKeyRef.current = framingBoundsKey;

    if (!presetChanged && !boundsChanged) {
      return;
    }

    beginTransitionToPreset(preset);
  }, [autoTour, beginTransitionToPreset, framingBoundsKey, preset]);

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

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={45} position={[5.2, 2.4, 4.6]} />;
}

