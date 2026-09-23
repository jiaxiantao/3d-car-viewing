"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { AssetCarRig } from "@/lib/asset-car-rig";
import { isShowroomModelPrepared, loadGltfScene, releaseDisplayedScene } from "@/lib/gltf-scene-cache";
import { publicAssetPath } from "@/lib/public-asset-path";
import { getOrbitDistanceLimits } from "@/lib/showroom-camera";
import {
  ShowroomHeadlightSpotlights,
  ShowroomImageBasedLighting,
  ShowroomReflectiveFloor,
} from "@/components/showroom-environment";
import { CameraRig } from "@/components/car-showroom-camera";
import { SHOWROOM_SCENE_MODES } from "@/lib/showroom-scene-modes";
import { AssetModel } from "@/components/showroom/asset-car-model";
import { resetHoverCursor } from "@/components/showroom/interactive-pointer";
import { ShowroomAssetLoadingOverlay } from "@/components/showroom/loading-overlay";
import { CarModel, ShowroomAccentLights } from "@/components/showroom/procedural-car-model";
import {
  CACHED_LOADING_OVERLAY_MS,
  MIN_LOADING_OVERLAY_MS,
  type AssetLoadState,
  type CarShowroomSceneProps,
  type ShowroomSceneHandle,
} from "@/components/showroom/types";

export type {
  AssetRigCapabilities,
  AssetRigDebug,
  CarCameraPreset,
  CarShowroomState,
  OrbitControlsLike,
  ShowroomSceneHandle,
} from "@/components/showroom/types";

/** Bridge that registers an imperative handle once `gl` is ready. */
function ShowroomSceneControlBridge({
  handleRef,
  containerRef,
}: {
  handleRef: RefObject<ShowroomSceneHandle | null> | undefined;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { gl, scene, camera, advance, invalidate } = useThree();
  useEffect(() => {
    if (!handleRef) {
      return;
    }
    const handle: ShowroomSceneHandle = {
      captureScreenshot: async () => {
        // Force a render on demand so toBlob captures the latest frame.
        try {
          invalidate();
          advance(performance.now() / 1000);
        } catch {
          gl.render(scene, camera);
        }
        return new Promise<Blob | null>((resolve) => {
          gl.domElement.toBlob((blob) => resolve(blob), "image/png");
        });
      },
      requestFullscreen: async () => {
        const target = containerRef.current ?? gl.domElement;
        if (target?.requestFullscreen) {
          await target.requestFullscreen();
        }
      },
      exitFullscreen: async () => {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      },
    };
    handleRef.current = handle;
    return () => {
      if (handleRef.current === handle) {
        handleRef.current = null;
      }
    };
  }, [advance, camera, containerRef, gl, handleRef, invalidate, scene]);
  return null;
}

export function CarShowroomScene({
  state,
  cameraPreset,
  autoTour,
  useAssetModel,
  modelUrl = publicAssetPath("/models/market/sedan-mainstream.glb"),
  modelAlternateUrls,
  modelFallbackUrl,
  sceneMode = "studio",
  onAssetRigCapabilities,
  onAssetRigDebug,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
  controlHandleRef,
  reduceMotion = false,
}: CarShowroomSceneProps) {
  const [assetScene, setAssetScene] = useState<THREE.Object3D | null>(null);
  const [assetRig, setAssetRig] = useState<AssetCarRig | null>(null);
  const [assetLoadState, setAssetLoadState] = useState<AssetLoadState>("idle");
  const [useGeometricFallback, setUseGeometricFallback] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const controlsRef = useRef(null);
  const displayedRootRef = useRef<THREE.Object3D | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sceneConfig = SHOWROOM_SCENE_MODES[sceneMode];
  const environmentIntensity =
    state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
      ? sceneConfig.environmentIntensity.headlightsOn
      : sceneConfig.environmentIntensity.base;
  const ambientIntensity =
    state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
      ? sceneConfig.ambient.headlightsOn
      : sceneConfig.ambient.base;
  const directionalIntensity =
    state.lightsOn && (!useAssetModel || assetRig?.capabilities.headLights)
      ? sceneConfig.directional.headlightsOn
      : sceneConfig.directional.base;

  // Reset `cursor: pointer` when the canvas unmounts (e.g. switching pages mid-hover).
  useEffect(
    () => () => {
      resetHoverCursor();
    },
    [],
  );

  const isAssetLoading = useAssetModel && assetLoadState === "loading";
  // Skip fullscreen overlay when the target model is already prepared in memory.
  const showBlockingOverlay =
    isAssetLoading && !isShowroomModelPrepared(modelUrl);
  const [overlayHoldUntil, setOverlayHoldUntil] = useState(0);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false);
  const [displayedLoadProgress, setDisplayedLoadProgress] = useState(0);

  useEffect(() => {
    if (showBlockingOverlay) {
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
  }, [showBlockingOverlay, overlayHoldUntil]);

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
        releaseDisplayedScene(displayedRootRef.current);
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
      const firstUrl = candidateUrls[0];
      const warm = Boolean(firstUrl && isShowroomModelPrepared(firstUrl));
      // Warm packages swap instantly — keep previous caps/scene to avoid UI flicker.
      if (!warm) {
        setAssetLoadState("loading");
        setLoadProgress(0);
        setUseGeometricFallback(false);
        onAssetRigCapabilities?.(null);
        onAssetRigDebug?.(null);
      } else {
        setAssetLoadState("loading");
        setLoadProgress(1);
      }
    });

    const tryLoad = async (index: number) => {
      if (!active) {
        return;
      }
      if (index >= candidateUrls.length) {
        if (displayedRootRef.current) {
          releaseDisplayedScene(displayedRootRef.current);
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
        const loaded = await loadGltfScene(url, (ratio) => {
          if (active) {
            setLoadProgress(ratio);
          }
        });
        if (!active) {
          releaseDisplayedScene(loaded.root);
          return;
        }
        if (displayedRootRef.current && displayedRootRef.current !== loaded.root) {
          // Keep GPU resources in the prepared-model cache for instant switch-back.
          releaseDisplayedScene(displayedRootRef.current);
        }
        displayedRootRef.current = loaded.root;
        const rig = loaded.rig;
        setLoadProgress(1);
        setOverlayHoldUntil(
          Date.now() + (loaded.fromCache ? CACHED_LOADING_OVERLAY_MS : MIN_LOADING_OVERLAY_MS),
        );
        setAssetRig(rig);
        setAssetScene(loaded.root);
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
    <div
      ref={containerRef}
      className="relative h-[52vh] min-h-[360px] w-full overflow-hidden rounded-4xl border border-white/10 bg-slate-950/80 sm:h-[520px] sm:min-h-[420px]"
    >
      {useAssetModel && assetLoadState === "error" ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
          <p className="rounded-full border border-amber-400/30 bg-amber-950/80 px-3 py-1 text-xs text-amber-100">
            GLB 加载失败，已切换为几何体车模
          </p>
        </div>
      ) : null}
      <Canvas
        className="h-full w-full"
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.75]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ShowroomSceneControlBridge handleRef={controlHandleRef} containerRef={containerRef} />
        <AdaptiveDpr pixelated={false} />
        <AdaptiveEvents />
        <CameraRig
          preset={cameraPreset}
          autoTour={autoTour}
          controlsRef={controlsRef}
          framingBounds={framingBounds}
          framingBoundsKey={framingBoundsKey}
        />
        <color attach="background" args={[sceneConfig.background]} />
        {sceneConfig.fog ? (
          <fog
            attach="fog"
            args={[sceneConfig.fog.color, sceneConfig.fog.near, sceneConfig.fog.far]}
          />
        ) : null}
        <ShowroomImageBasedLighting intensity={environmentIntensity} />
        <hemisphereLight
          args={[sceneConfig.hemisphere.sky, sceneConfig.hemisphere.ground, sceneConfig.hemisphere.intensity]}
        />
        <ambientLight intensity={ambientIntensity} />
        <ShowroomAccentLights
          lightsOn={state.lightsOn}
          cameraPreset={cameraPreset}
          useAssetModel={Boolean(showAssetCar)}
          assetScene={showAssetCar ? assetScene : null}
        />
        <directionalLight
          position={[5, 8, 3]}
          intensity={directionalIntensity}
          color={sceneConfig.directionalColor}
          castShadow
          shadow-mapSize-height={1024}
          shadow-mapSize-width={1024}
        />
        <directionalLight
          position={[-3, 4, -2]}
          intensity={sceneConfig.rimDirectional}
          color="#94a3b8"
        />
        <ShowroomHeadlightSpotlights
          lightsOn={state.lightsOn}
          rig={assetRig}
          sceneMode={sceneMode}
        />
        <pointLight
          position={[-4, 2, -3]}
          intensity={sceneConfig.fillPoint}
          color="#93c5fd"
        />

        {showAssetCar ? (
          <AssetModel
            object={assetScene}
            rig={assetRig}
            state={state}
            reduceMotion={reduceMotion}
            onToggleLeftDoor={onToggleLeftDoor}
            onToggleRightDoor={onToggleRightDoor}
            onToggleTrunk={onToggleTrunk}
          />
        ) : showGeometricCar ? (
          <CarModel
            state={state}
            reduceMotion={reduceMotion}
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
          sceneMode={sceneMode}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={!autoTour}
          enableDamping
          dampingFactor={0.08}
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
