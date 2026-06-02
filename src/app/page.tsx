"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ShowroomDebugPanel } from "@/components/showroom-debug-panel";
import type {
  AssetRigCapabilities,
  AssetRigDebug,
  CarCameraPreset,
  ShowroomSceneHandle,
} from "@/components/car-showroom-scene";
import { Button } from "@/components/ui/button";
import { BookingDialog } from "@/components/booking-dialog";
import { CarSpecPanel } from "@/components/car-spec-panel";
import { ShowroomQuickActions } from "@/components/showroom-quick-actions";
import {
  CAR_CATEGORY_OPTIONS,
  CAR_SPECS,
  resolveCarCategoryKey,
  type CarCategoryKey,
} from "@/lib/car-specs";
import {
  SHOWROOM_DEFAULT_PAINT_ID,
  SHOWROOM_PAINT_OPTIONS,
  resolveShowroomPaint,
} from "@/lib/showroom-paint-options";
import type { ShowroomSceneMode } from "@/lib/showroom-scene-modes";
import {
  readShowroomUrlState,
  useShowroomUrlState,
} from "@/lib/use-showroom-url-state";
import { useShowroomShortcuts } from "@/lib/use-showroom-shortcuts";

const IS_DEV = process.env.NODE_ENV !== "production";
const VALID_CAMERA_PRESETS: CarCameraPreset[] = [
  "overview",
  "front",
  "side-left",
  "side-right",
  "rear",
  "cockpit",
];

const CarShowroomScene = dynamic(
  () => import("@/components/car-showroom-scene").then((mod) => mod.CarShowroomScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] min-h-[420px] items-center justify-center rounded-4xl border border-white/10 bg-slate-950/70 text-sm text-slate-400 sm:h-[520px]">
        加载 3D 看车场景...
      </div>
    ),
  },
);

const wheelReadyCategoryKey: CarCategoryKey = "sedan";

type InteractionTab = "interaction" | "drive" | "paint";
const INTERACTION_TABS: Array<{ id: InteractionTab; label: string }> = [
  { id: "interaction", label: "车身交互" },
  { id: "drive", label: "驾驶动态" },
  { id: "paint", label: "车漆 & 模式" },
];

export default function HomePage() {
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
  const [selectedCategory, setSelectedCategory] = useState<CarCategoryKey>("suv");
  const [speedKph, setSpeedKph] = useState(28);
  const [braking, setBraking] = useState(false);
  const [assetRigCaps, setAssetRigCaps] = useState<AssetRigCapabilities | null>(null);
  const [assetRigDebug, setAssetRigDebug] = useState<AssetRigDebug | null>(null);
  const [sceneMode, setSceneMode] = useState<ShowroomSceneMode>("studio");
  const [activeTab, setActiveTab] = useState<InteractionTab>("interaction");

  const [bookingOpen, setBookingOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sceneHandleRef = useRef<ShowroomSceneHandle | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  // Hydrate UI state from the URL once on the client. SSR uses defaults so the
  // initial paint matches; reading the URL after mount keeps deep links shareable
  // without triggering a hydration mismatch.
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

  const wheelReadyCategory = useMemo(
    () => CAR_CATEGORY_OPTIONS.find((item) => item.key === wheelReadyCategoryKey),
    [],
  );

  const activeCategory = useMemo(() => CAR_SPECS[selectedCategory], [selectedCategory]);
  const selectedModelUrl = activeCategory.primaryUrl;
  const selectedModelLabel = `${activeCategory.label}（主流实车模型）`;

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
        : "当前 GLB 车身为合并整体，未包含可独立活动的该部件，无法开合。";
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

  const unsupportedInteractionNote =
    unsupportedInteractionLabels.length > 0
      ? `当前 GLB 的「${unsupportedInteractionLabels.join("、")}」与车身合并，无法单独开合（对应按钮已禁用）。车灯、双闪、启动与整车动态仍可用；若要看到“真实四轮转动”，建议切换到支持独立轮节点的车型。`
      : null;

  const wheelSpinUnavailable = useAssetModel && assetRigCaps ? !assetRigCaps.wheels : false;
  const wheelSpinHint = wheelSpinUnavailable
    ? "当前模型未识别到可独立旋转的真实车轮，启动车辆仅表现为整车动态。"
    : undefined;

  const sceneState = useMemo(
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

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `3D 看车 · ${activeCategory.label}`,
          text: `${activeCategory.label} · ${activeCategory.tagline}`,
          url,
        });
        showStatus("分享菜单已打开");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
      showStatus("当前配置链接已复制");
    } catch (error) {
      console.warn("[showroom] share failed", error);
      showStatus("无法复制链接，请手动从地址栏分享");
    }
  }, [activeCategory.label, activeCategory.tagline, showStatus]);

  const handleSelectCamera = useCallback((preset: CarCameraPreset) => {
    setCameraPreset(preset);
    setAutoTour(false);
  }, []);

  useShowroomShortcuts({
    onCameraOverview: () => handleSelectCamera("overview"),
    onCameraFront: () => handleSelectCamera("front"),
    onCameraSideLeft: () => handleSelectCamera("side-left"),
    onCameraSideRight: () => handleSelectCamera("side-right"),
    onCameraRear: () => handleSelectCamera("rear"),
    onCameraCockpit: () => handleSelectCamera("cockpit"),
    onToggleAutoTour: () => setAutoTour((value) => !value),
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">3D Car Showroom</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          3D 看车交互舱
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-300">
          在浏览器中即时切换车型、车漆、场景与视角；车门 / 后备箱 / 灯光 / 启动 / 制动等交互全部支持物理拟真。
          <span className="hidden sm:inline">
            键盘可用 <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">1-6</kbd> 切换视角，
            <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">E</kbd> 启动，
            <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">L</kbd> 灯光，
            <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">S</kbd> 截图，
            <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">F</kbd> 全屏。
          </span>
        </p>
      </section>

      <CarShowroomScene
        state={sceneState}
        cameraPreset={cameraPreset}
        autoTour={autoTour}
        useAssetModel={useAssetModel}
        modelUrl={selectedModelUrl}
        sceneMode={sceneMode}
        controlHandleRef={sceneHandleRef}
        onAssetRigCapabilities={handleAssetRigCapabilities}
        onAssetRigDebug={handleAssetRigDebug}
        onToggleLeftDoor={() => setLeftDoorOpen((value) => !value)}
        onToggleRightDoor={() => setRightDoorOpen((value) => !value)}
        onToggleTrunk={() => setTrunkOpen((value) => !value)}
      />

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="-mt-2 flex justify-center text-xs text-cyan-200/80"
        >
          <span className="rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1">
            {statusMessage}
          </span>
        </div>
      ) : null}

      <ShowroomQuickActions
        sceneMode={sceneMode}
        onChangeSceneMode={setSceneMode}
        onCaptureScreenshot={handleScreenshot}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        capturing={capturing}
      />

      <CarSpecPanel
        spec={activeCategory}
        paint={selectedPaint}
        onBookNow={() => setBookingOpen(true)}
        onShare={handleShare}
        shareCopied={shareCopied}
      />

      {IS_DEV ? (
        <ShowroomDebugPanel
          assetRig={
            assetRigCaps && assetRigDebug
              ? { capabilities: assetRigCaps, debug: assetRigDebug }
              : null
          }
        />
      ) : null}

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={useAssetModel ? "default" : "outline"}
            onClick={() => setUseAssetModel((value) => !value)}
          >
            {useAssetModel ? "使用几何体车模" : "尝试加载 GLB 车模"}
          </Button>
          {CAR_CATEGORY_OPTIONS.map((model) => (
            <Button
              key={model.key}
              variant={selectedCategory === model.key ? "default" : "outline"}
              onClick={() => {
                setSelectedCategory(resolveCarCategoryKey(model.key));
                setUseAssetModel(true);
              }}
            >
              {model.label}
            </Button>
          ))}
          <p className="basis-full text-xs text-slate-400 sm:basis-auto">
            当前模型：{selectedModelLabel || "加载中..."}。可将 GLB 放到
            `public/models/market/`，页面会自动优先加载。
          </p>
          {useAssetModel && assetRigCaps ? (
            <p className="w-full text-xs text-slate-500">
              GLB 部件识别：左前门 {assetRigCaps.leftDoor ? "✓" : "—"} · 右前门{" "}
              {assetRigCaps.rightDoor ? "✓" : "—"} · 后备箱 {assetRigCaps.trunk ? "✓" : "—"} · 车灯{" "}
              {assetRigCaps.headLights ? "✓" : "—"} · 尾灯 {assetRigCaps.tailLights ? "✓" : "—"} ·
              天窗 {assetRigCaps.sunroof ? "✓" : "—"} · 车轮 {assetRigCaps.wheels ? "✓" : "—"}
              {assetRigCaps.leftDoor ? "" : "（未识别到的部件见 docs/market-glb-rig.md）"}
            </p>
          ) : null}
          {wheelSpinUnavailable && wheelReadyCategory ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedCategory(resolveCarCategoryKey(wheelReadyCategory.key));
                setUseAssetModel(true);
              }}
            >
              切换到{wheelReadyCategory.label}（支持真实四轮转动）
            </Button>
          ) : null}
        </div>

        <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
          <div className="flex flex-nowrap items-center gap-2 px-1 sm:flex-wrap sm:px-0">
            {([
              { key: "overview", label: "全景视角" },
              { key: "front", label: "前脸视角" },
              { key: "side-left", label: "左侧视角" },
              { key: "side-right", label: "右侧视角" },
              { key: "rear", label: "车尾视角" },
              { key: "cockpit", label: "驾舱视角" },
            ] as const).map((view) => (
              <Button
                key={view.key}
                variant={cameraPreset === view.key ? "default" : "outline"}
                onClick={() => handleSelectCamera(view.key)}
                className="shrink-0"
              >
                {view.label}
              </Button>
            ))}
            <Button
              variant={autoTour ? "default" : "outline"}
              onClick={() => setAutoTour((value) => !value)}
              className="shrink-0"
            >
              {autoTour ? "停止环车巡检" : "自动环车巡检"}
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="展厅交互分组"
          className="flex flex-wrap gap-1.5 border-b border-white/10 pb-1.5 text-xs"
        >
          {INTERACTION_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 transition ${
                activeTab === tab.id
                  ? "bg-white/10 font-semibold text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "interaction" ? (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button
              variant={leftDoorOpen ? "default" : "outline"}
              disabled={!supportsInteraction("leftDoor")}
              title={interactionHint("leftDoor")}
              aria-pressed={leftDoorOpen}
              onClick={() => setLeftDoorOpen((value) => !value)}
            >
              {leftDoorOpen ? "关闭左前门" : "打开左前门"}
            </Button>
            <Button
              variant={rightDoorOpen ? "default" : "outline"}
              disabled={!supportsInteraction("rightDoor")}
              title={interactionHint("rightDoor")}
              aria-pressed={rightDoorOpen}
              onClick={() => setRightDoorOpen((value) => !value)}
            >
              {rightDoorOpen ? "关闭右前门" : "打开右前门"}
            </Button>
            <Button
              variant={trunkOpen ? "default" : "outline"}
              disabled={!supportsInteraction("trunk")}
              title={interactionHint("trunk")}
              aria-pressed={trunkOpen}
              onClick={() => setTrunkOpen((value) => !value)}
            >
              {trunkOpen ? "关闭后备箱" : "打开后备箱"}
            </Button>
            <Button
              variant={sunroofOpen ? "default" : "outline"}
              disabled={!supportsInteraction("sunroof")}
              title={interactionHint("sunroof")}
              aria-pressed={sunroofOpen}
              onClick={() => setSunroofOpen((value) => !value)}
            >
              {sunroofOpen ? "关闭天窗" : "打开天窗"}
            </Button>
            <Button
              variant={lightsOn ? "default" : "outline"}
              aria-pressed={lightsOn}
              onClick={() => setLightsOn((value) => !value)}
            >
              {lightsOn ? "关闭车灯" : "开启车灯"}
            </Button>
            <Button
              variant={hazardOn ? "default" : "outline"}
              aria-pressed={hazardOn}
              onClick={() => setHazardOn((value) => !value)}
            >
              {hazardOn ? "关闭双闪" : "开启双闪"}
            </Button>
            {unsupportedInteractionNote ? (
              <p className="basis-full text-xs leading-6 text-amber-300/80">
                {unsupportedInteractionNote}
              </p>
            ) : null}
          </div>
        ) : null}

        {activeTab === "drive" ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button
                variant={engineOn ? "default" : "outline"}
                title={wheelSpinHint}
                aria-pressed={engineOn}
                onClick={() => setEngineOn((value) => !value)}
              >
                {engineOn ? "熄火" : "启动车辆"}
              </Button>
              <Button
                variant={braking ? "default" : "outline"}
                aria-pressed={braking}
                onClick={() => setBraking((value) => !value)}
              >
                {braking ? "松开制动" : "模拟制动"}
              </Button>
              <Button variant="secondary" onClick={applyWelcomeMode}>
                迎宾模式
              </Button>
              <Button variant="secondary" onClick={applyDriveMode}>
                驾驶预备模式
              </Button>
              <Button variant="outline" onClick={resetAll}>
                复位全部状态
              </Button>
            </div>

            <div className="grid gap-3">
              <label htmlFor="driver-seat-offset" className="text-sm font-medium text-slate-100">
                主驾座椅：{seatDriverOffset > 0 ? "向后" : seatDriverOffset < 0 ? "向前" : "中间"}
                {useAssetModel ? "（GLB 模型暂不支持座椅调节）" : ""}
              </label>
              <input
                id="driver-seat-offset"
                type="range"
                min={-45}
                max={45}
                disabled={useAssetModel}
                value={Math.round(seatDriverOffset * 100)}
                onChange={(event) => setSeatDriverOffset(Number(event.target.value) / 100)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="passenger-seat-offset" className="text-sm font-medium text-slate-100">
                副驾座椅：
                {seatPassengerOffset > 0 ? "向后" : seatPassengerOffset < 0 ? "向前" : "中间"}
                {useAssetModel ? "（GLB 模型暂不支持座椅调节）" : ""}
              </label>
              <input
                id="passenger-seat-offset"
                type="range"
                min={-45}
                max={45}
                disabled={useAssetModel}
                value={Math.round(seatPassengerOffset * 100)}
                onChange={(event) => setSeatPassengerOffset(Number(event.target.value) / 100)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="steering-angle" className="text-sm font-medium text-slate-100">
                方向盘角度：
                {steeringAngle > 0
                  ? `右转 ${steeringAngle}°`
                  : steeringAngle < 0
                    ? `左转 ${Math.abs(steeringAngle)}°`
                    : "居中"}
                {useAssetModel && !supportsInteraction("wheels")
                  ? "（当前 GLB 未识别到可转向车轮）"
                  : ""}
              </label>
              <input
                id="steering-angle"
                type="range"
                min={-42}
                max={42}
                disabled={useAssetModel && !supportsInteraction("wheels")}
                value={Math.round(steeringAngle)}
                onChange={(event) => setSteeringAngle(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="speed-kph" className="text-sm font-medium text-slate-100">
                目标车速：{speedKph} km/h
                {!engineOn ? "（启动车辆后生效）" : null}
              </label>
              <input
                id="speed-kph"
                type="range"
                min={0}
                max={120}
                value={speedKph}
                onChange={(event) => setSpeedKph(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700"
              />
            </div>
          </div>
        ) : null}

        {activeTab === "paint" ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {SHOWROOM_PAINT_OPTIONS.map((paint) => {
                const active = selectedPaintId === paint.id;
                return (
                  <button
                    key={paint.id}
                    type="button"
                    onClick={() => setSelectedPaintId(paint.id)}
                    aria-pressed={active}
                    title={paint.label}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-cyan-200/80 bg-cyan-200/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded-full ring-1 ring-white/40"
                      style={{
                        background: paint.secondary
                          ? `linear-gradient(135deg, ${paint.primary}, ${paint.secondary})`
                          : paint.primary,
                      }}
                    />
                    {paint.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-6 text-slate-400">
              提示：双闪联动尾灯闪烁；模拟制动时刹车灯会亮起；环车巡检会自动锁定镜头轨迹，
              如需手动拖拽观察请先停止巡检。
            </p>
          </div>
        ) : null}
      </section>

      {bookingOpen ? (
        <BookingDialog
          spec={activeCategory}
          paintLabel={selectedPaint.label}
          onClose={() => setBookingOpen(false)}
        />
      ) : null}
    </main>
  );
}
