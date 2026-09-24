"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AssetRigCapabilities,
  AssetRigDebug,
  CarCameraPreset,
  CarShowroomState,
  ShowroomSceneHandle,
} from "@/components/car-showroom-scene";
import {
  CAR_CATEGORIES,
  CAR_CATEGORY_OPTIONS,
  DEFAULT_CAR_CATEGORY_KEY,
  resolveCarCategoryKey,
  type CarCategoryKey,
} from "@/lib/car-categories";
import { scheduleIdleGltfPreloads, isShowroomModelPrepared } from "@/lib/gltf-scene-cache";
import {
  SHOWROOM_DEFAULT_PAINT_ID,
  resolveShowroomPaint,
} from "@/lib/showroom-paint-options";
import type { ShowroomSceneMode } from "@/lib/showroom-scene-modes";
import {
  copyShowroomShareUrl,
  readShowroomUrlState,
  useShowroomUrlState,
} from "@/lib/use-showroom-url-state";
import { useShowroomShortcuts } from "@/lib/use-showroom-shortcuts";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const VALID_CAMERA_PRESETS: CarCameraPreset[] = [
  "overview",
  "front",
  "side-left",
  "side-right",
  "rear",
  "cockpit",
];

function isCoarsePointerMobile(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
}

export function useShowroomPageState() {
  const reduceMotion = usePrefersReducedMotion();

  const [leftDoorOpen, setLeftDoorOpen] = useState(false);
  const [rightDoorOpen, setRightDoorOpen] = useState(false);
  const [trunkOpen, setTrunkOpen] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [seatDriverOffset, setSeatDriverOffset] = useState(0);
  const [seatPassengerOffset, setSeatPassengerOffset] = useState(0);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CarCameraPreset>("overview");
  const [hazardOn, setHazardOn] = useState(false);
  const [sunroofOpen, setSunroofOpen] = useState(false);
  const [autoTour, setAutoTour] = useState(false);
  const [selectedPaintId, setSelectedPaintId] = useState<string>(SHOWROOM_DEFAULT_PAINT_ID);
  const [useAssetModel, setUseAssetModel] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CarCategoryKey>(DEFAULT_CAR_CATEGORY_KEY);
  const [speedKph, setSpeedKph] = useState(28);
  const [braking, setBraking] = useState(false);
  const [assetRigCaps, setAssetRigCaps] = useState<AssetRigCapabilities | null>(null);
  const [assetRigDebug, setAssetRigDebug] = useState<AssetRigDebug | null>(null);
  const [sceneMode, setSceneMode] = useState<ShowroomSceneMode>("studio");

  const [capturing, setCapturing] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const sceneHandleRef = useRef<ShowroomSceneHandle | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-shot URL hydration on mount */
  useEffect(() => {
    const initial = readShowroomUrlState();
    if (initial.category) {
      setSelectedCategory(initial.category);
    }
    if (initial.paintId) {
      setSelectedPaintId(initial.paintId);
    }
    if (
      initial.cameraPreset &&
      VALID_CAMERA_PRESETS.includes(initial.cameraPreset as CarCameraPreset)
    ) {
      setCameraPreset(initial.cameraPreset as CarCameraPreset);
    }
    if (initial.sceneMode) {
      setSceneMode(initial.sceneMode);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useShowroomUrlState({
    category: selectedCategory,
    paintId: selectedPaintId,
    cameraPreset,
    sceneMode,
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const effectiveAutoTour = autoTour && !reduceMotion;

  const wheelReadyCategory = useMemo(
    () => CAR_CATEGORY_OPTIONS.find((item) => item.key === "sedan"),
    [],
  );

  const activeCategory = useMemo(() => CAR_CATEGORIES[selectedCategory], [selectedCategory]);
  const selectedModelUrl = activeCategory.primaryUrl;
  const selectedModelLabel = `${activeCategory.label}（主流实车模型）`;

  useEffect(() => {
    if (!useAssetModel) {
      return;
    }
    const otherUrls = CAR_CATEGORY_OPTIONS.map((item) => item.primaryUrl).filter(
      (url) => url !== selectedModelUrl,
    );
    // Warm full prepared packages (clone + rig) so category switches stay on the main thread briefly.
    return scheduleIdleGltfPreloads(otherUrls, {
      respectNetworkConstraints: true,
      // Still preload one alternate on mobile; desktop warms all remaining models.
      currentOnly: isCoarsePointerMobile(),
    });
  }, [selectedModelUrl, useAssetModel]);

  const handleSelectCategory = useCallback((categoryKey: CarCategoryKey) => {
    const nextKey = resolveCarCategoryKey(categoryKey);
    const nextUrl = CAR_CATEGORIES[nextKey].primaryUrl;
    setSelectedCategory(nextKey);
    setUseAssetModel(true);
    setLeftDoorOpen(false);
    setRightDoorOpen(false);
    setTrunkOpen(false);
    setSunroofOpen(false);
    // Warm packages keep previous caps until the scene swaps — avoids control flicker.
    if (!isShowroomModelPrepared(nextUrl)) {
      setAssetRigCaps(null);
      setAssetRigDebug(null);
    }
  }, []);

  const handleAssetRigCapabilities = useCallback(
    (capabilities: AssetRigCapabilities | null) => {
      setAssetRigCaps(capabilities);
    },
    [],
  );
  const handleAssetRigDebug = useCallback((debug: AssetRigDebug | null) => {
    setAssetRigDebug(debug);
  }, []);

  const assetModelLoading = useAssetModel && assetRigCaps === null;

  const selectedPaint = useMemo(() => resolveShowroomPaint(selectedPaintId), [selectedPaintId]);

  const supportsInteraction = useCallback(
    (key: keyof AssetRigCapabilities) => {
      if (!useAssetModel) {
        return true;
      }
      if (!assetRigCaps) {
        return false;
      }
      return assetRigCaps[key];
    },
    [assetRigCaps, useAssetModel],
  );

  const interactionHint = useCallback(
    (key: keyof AssetRigCapabilities) => {
      if (assetModelLoading) {
        return "车模加载中，请稍候…";
      }
      return supportsInteraction(key)
        ? undefined
        : "当前 GLB 未包含可独立活动的该部件，无法开合。";
    },
    [assetModelLoading, supportsInteraction],
  );

  const unsupportedInteractionLabels = useMemo(() => {
    if (!useAssetModel || !assetRigCaps) {
      return [] as string[];
    }
    const labels: string[] = [];
    if (!assetRigCaps.leftDoor) labels.push("左前门");
    if (!assetRigCaps.rightDoor) labels.push("右前门");
    if (!assetRigCaps.trunk) labels.push("后备箱");
    if (!assetRigCaps.sunroof) labels.push("天窗");
    if (!assetRigCaps.wheels) labels.push("车轮转动");
    return labels;
  }, [assetRigCaps, useAssetModel]);

  const wheelSwitchAdvice = unsupportedInteractionLabels.includes("车轮转动")
    ? `真实四轮转动请切换${CAR_CATEGORIES.sedan.label}。`
    : "";
  const unsupportedInteractionNote =
    unsupportedInteractionLabels.length > 0
      ? `当前 GLB 的「${unsupportedInteractionLabels.join("、")}」无法单独开合（按钮已禁用）。车灯、双闪、启动与整车动态仍可用。${wheelSwitchAdvice}`
      : null;

  const wheelSpinUnavailable = useAssetModel && assetRigCaps ? !assetRigCaps.wheels : false;
  const wheelSpinHint = wheelSpinUnavailable
    ? "当前模型未识别到可独立旋转的真实车轮，启动车辆仅表现为整车动态。"
    : undefined;

  const sceneState: CarShowroomState = useMemo(
    () => ({
      leftDoorOpen,
      rightDoorOpen,
      trunkOpen,
      lightsOn,
      engineOn,
      seatDriverOffset,
      seatPassengerOffset,
      steeringAngle,
      hazardOn,
      sunroofOpen,
      bodyColor: selectedPaint.primary,
      bodyColorSecondary: selectedPaint.secondary ?? null,
      speedKph,
      braking,
    }),
    [
      engineOn,
      leftDoorOpen,
      lightsOn,
      rightDoorOpen,
      seatDriverOffset,
      seatPassengerOffset,
      steeringAngle,
      hazardOn,
      sunroofOpen,
      selectedPaint,
      speedKph,
      braking,
      trunkOpen,
    ],
  );

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    },
    [],
  );

  const handleScreenshot = useCallback(async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const blob = await sceneHandleRef.current?.captureScreenshot();
      if (!blob) {
        showStatus("截图未就绪，请稍候重试");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `3d-car-${selectedCategory}-${Date.now()}.png`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      showStatus(`已保存 ${filename}`);
    } catch (error) {
      console.warn("[showroom] screenshot failed", error);
      showStatus("截图失败，请重试");
    } finally {
      setCapturing(false);
    }
  }, [capturing, selectedCategory, showStatus]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await sceneHandleRef.current?.exitFullscreen();
      } else {
        await sceneHandleRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.warn("[showroom] fullscreen toggle failed", error);
      showStatus("浏览器拒绝全屏请求");
    }
  }, [showStatus]);

  const handleCopyShareLink = useCallback(async () => {
    if (copyingLink) {
      return;
    }
    setCopyingLink(true);
    try {
      await copyShowroomShareUrl({
        category: selectedCategory,
        paintId: selectedPaintId,
        cameraPreset,
        sceneMode,
      });
      showStatus("已复制分享链接，可直接发送给他人");
    } catch (error) {
      console.warn("[showroom] copy share link failed", error);
      showStatus("复制失败，请检查浏览器剪贴板权限");
    } finally {
      setCopyingLink(false);
    }
  }, [
    cameraPreset,
    copyingLink,
    sceneMode,
    selectedCategory,
    selectedPaintId,
    showStatus,
  ]);

  const handleSelectCamera = useCallback((preset: CarCameraPreset) => {
    setCameraPreset(preset);
    setAutoTour(false);
  }, []);

  const handleToggleAutoTour = useCallback(() => {
    if (reduceMotion) {
      showStatus("系统已开启「减少动态效果」，环车巡检已禁用");
      setAutoTour(false);
      return;
    }
    setAutoTour((value) => !value);
  }, [reduceMotion, showStatus]);

  useShowroomShortcuts({
    onCameraOverview: () => handleSelectCamera("overview"),
    onCameraFront: () => handleSelectCamera("front"),
    onCameraSideLeft: () => handleSelectCamera("side-left"),
    onCameraSideRight: () => handleSelectCamera("side-right"),
    onCameraRear: () => handleSelectCamera("rear"),
    onCameraCockpit: () => handleSelectCamera("cockpit"),
    onToggleAutoTour: handleToggleAutoTour,
    onToggleEngine: () => setEngineOn((value) => !value),
    onToggleLights: () => setLightsOn((value) => !value),
    onToggleHazard: () => setHazardOn((value) => !value),
    onToggleLeftDoor: () => {
      if (supportsInteraction("leftDoor")) setLeftDoorOpen((value) => !value);
    },
    onToggleRightDoor: () => {
      if (supportsInteraction("rightDoor")) setRightDoorOpen((value) => !value);
    },
    onToggleTrunk: () => {
      if (supportsInteraction("trunk")) setTrunkOpen((value) => !value);
    },
    onCaptureScreenshot: handleScreenshot,
    onToggleFullscreen: handleToggleFullscreen,
    onCopyShareLink: handleCopyShareLink,
  });

  function applyWelcomeMode() {
    setLeftDoorOpen(true);
    setRightDoorOpen(true);
    setTrunkOpen(false);
    setLightsOn(true);
    setEngineOn(false);
    setSteeringAngle(0);
    setHazardOn(true);
    setSunroofOpen(false);
    setSpeedKph(0);
    setBraking(false);
    setCameraPreset("overview");
    setAutoTour(false);
  }

  function applyDriveMode() {
    setLeftDoorOpen(false);
    setRightDoorOpen(false);
    setTrunkOpen(false);
    setLightsOn(true);
    setEngineOn(true);
    setSteeringAngle(-16);
    setHazardOn(false);
    setSunroofOpen(false);
    setSpeedKph(45);
    setBraking(false);
    setCameraPreset("side-right");
    setAutoTour(false);
  }

  function resetAll() {
    setLeftDoorOpen(false);
    setRightDoorOpen(false);
    setTrunkOpen(false);
    setLightsOn(false);
    setEngineOn(false);
    setSeatDriverOffset(0);
    setSeatPassengerOffset(0);
    setSteeringAngle(0);
    setHazardOn(false);
    setSunroofOpen(false);
    setCameraPreset("overview");
    setAutoTour(false);
    setSelectedPaintId(SHOWROOM_DEFAULT_PAINT_ID);
    setSpeedKph(28);
    setBraking(false);
  }

  return {
    reduceMotion,
    leftDoorOpen,
    setLeftDoorOpen,
    rightDoorOpen,
    setRightDoorOpen,
    trunkOpen,
    setTrunkOpen,
    lightsOn,
    setLightsOn,
    engineOn,
    setEngineOn,
    seatDriverOffset,
    setSeatDriverOffset,
    seatPassengerOffset,
    setSeatPassengerOffset,
    steeringAngle,
    setSteeringAngle,
    cameraPreset,
    hazardOn,
    setHazardOn,
    sunroofOpen,
    setSunroofOpen,
    autoTour: effectiveAutoTour,
    selectedPaintId,
    setSelectedPaintId,
    useAssetModel,
    setUseAssetModel,
    selectedCategory,
    speedKph,
    setSpeedKph,
    braking,
    setBraking,
    assetRigCaps,
    assetRigDebug,
    sceneMode,
    setSceneMode,
    capturing,
    copyingLink,
    isFullscreen,
    statusMessage,
    shortcutsOpen,
    setShortcutsOpen,
    sceneHandleRef,
    wheelReadyCategory,
    activeCategory,
    selectedModelUrl,
    selectedModelLabel,
    handleSelectCategory,
    handleAssetRigCapabilities,
    handleAssetRigDebug,
    supportsInteraction,
    interactionHint,
    unsupportedInteractionNote,
    wheelSpinUnavailable,
    wheelSpinHint,
    sceneState,
    handleScreenshot,
    handleToggleFullscreen,
    handleCopyShareLink,
    handleSelectCamera,
    handleToggleAutoTour,
    applyWelcomeMode,
    applyDriveMode,
    resetAll,
  };
}
