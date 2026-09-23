"use client";

import dynamic from "next/dynamic";

import { ShowroomControlPanels } from "@/components/showroom-control-panels";
import { ShowroomDebugPanel } from "@/components/showroom-debug-panel";
import { ShowroomViewportChrome } from "@/components/showroom-viewport-chrome";
import { useShowroomPageState } from "@/lib/use-showroom-page-state";

const IS_DEV = process.env.NODE_ENV !== "production";

const CarShowroomScene = dynamic(
  () => import("@/components/car-showroom-scene").then((mod) => mod.CarShowroomScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[52vh] min-h-[360px] items-center justify-center rounded-4xl border border-white/10 bg-slate-950/70 text-sm text-slate-400 sm:h-[520px] sm:min-h-[420px]">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <span>正在加载 3D 看车代码包…</span>
          <span className="text-xs text-slate-500">随后将拉取车模资源</span>
        </div>
      </div>
    ),
  },
);

export default function HomePage() {
  const showroom = useShowroomPageState();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">3D Car Showroom</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          3D 看车交互舱
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-300">
          在浏览器中即时切换车型、车漆、场景与视角。常用操作已放在看车画面顶栏与左右侧，细项调节仍在下方面板。
        </p>
        <div className="sm:hidden">
          <button
            type="button"
            className="text-xs text-cyan-200/80 underline-offset-2 hover:underline"
            onClick={() => showroom.setShortcutsOpen((open) => !open)}
            aria-expanded={showroom.shortcutsOpen}
          >
            {showroom.shortcutsOpen ? "收起操作提示" : "展开操作提示"}
          </button>
          {showroom.shortcutsOpen ? (
            <p className="mt-2 text-xs leading-6 text-slate-400">
              键盘：
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">1-6</kbd> 视角，
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">E</kbd> 启动，
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">L</kbd> 灯光，
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">S</kbd> 截图，
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">C</kbd> 分享，
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">F</kbd> 全屏。
            </p>
          ) : null}
        </div>
        <p className="hidden text-sm leading-7 text-slate-300 sm:block">
          键盘可用 <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">1-6</kbd> 切换视角，
          <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">E</kbd> 启动，
          <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">L</kbd> 灯光，
          <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">S</kbd> 截图，
          <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">C</kbd> 分享，
          <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">F</kbd> 全屏。
        </p>
      </section>

      <ShowroomViewportChrome
        sceneMode={showroom.sceneMode}
        onChangeSceneMode={showroom.setSceneMode}
        onCaptureScreenshot={showroom.handleScreenshot}
        onToggleFullscreen={showroom.handleToggleFullscreen}
        onCopyShareLink={showroom.handleCopyShareLink}
        isFullscreen={showroom.isFullscreen}
        capturing={showroom.capturing}
        copyingLink={showroom.copyingLink}
        leftDoorOpen={showroom.leftDoorOpen}
        rightDoorOpen={showroom.rightDoorOpen}
        trunkOpen={showroom.trunkOpen}
        sunroofOpen={showroom.sunroofOpen}
        lightsOn={showroom.lightsOn}
        hazardOn={showroom.hazardOn}
        engineOn={showroom.engineOn}
        braking={showroom.braking}
        autoTour={showroom.autoTour}
        reduceMotion={showroom.reduceMotion}
        cameraPreset={showroom.cameraPreset}
        onToggleLeftDoor={() => showroom.setLeftDoorOpen((value) => !value)}
        onToggleRightDoor={() => showroom.setRightDoorOpen((value) => !value)}
        onToggleTrunk={() => showroom.setTrunkOpen((value) => !value)}
        onToggleSunroof={() => showroom.setSunroofOpen((value) => !value)}
        onToggleLights={() => showroom.setLightsOn((value) => !value)}
        onToggleHazard={() => showroom.setHazardOn((value) => !value)}
        onToggleEngine={() => showroom.setEngineOn((value) => !value)}
        onToggleBraking={() => showroom.setBraking((value) => !value)}
        onToggleAutoTour={showroom.handleToggleAutoTour}
        onSelectCamera={showroom.handleSelectCamera}
        selectedPaintId={showroom.selectedPaintId}
        onSelectPaint={showroom.setSelectedPaintId}
        supportsInteraction={showroom.supportsInteraction}
        interactionHint={showroom.interactionHint}
        wheelSpinHint={showroom.wheelSpinHint}
      >
        <CarShowroomScene
          state={showroom.sceneState}
          cameraPreset={showroom.cameraPreset}
          autoTour={showroom.autoTour}
          useAssetModel={showroom.useAssetModel}
          modelUrl={showroom.selectedModelUrl}
          sceneMode={showroom.sceneMode}
          reduceMotion={showroom.reduceMotion}
          controlHandleRef={showroom.sceneHandleRef}
          onAssetRigCapabilities={showroom.handleAssetRigCapabilities}
          onAssetRigDebug={showroom.handleAssetRigDebug}
          onToggleLeftDoor={() => showroom.setLeftDoorOpen((value) => !value)}
          onToggleRightDoor={() => showroom.setRightDoorOpen((value) => !value)}
          onToggleTrunk={() => showroom.setTrunkOpen((value) => !value)}
        />
      </ShowroomViewportChrome>

      {showroom.statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="-mt-2 flex justify-center text-xs text-cyan-200/80"
        >
          <span className="rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1">
            {showroom.statusMessage}
          </span>
        </div>
      ) : null}

      {IS_DEV ? (
        <ShowroomDebugPanel
          assetRig={
            showroom.assetRigCaps && showroom.assetRigDebug
              ? { capabilities: showroom.assetRigCaps, debug: showroom.assetRigDebug }
              : null
          }
        />
      ) : null}

      <ShowroomControlPanels
        useAssetModel={showroom.useAssetModel}
        onToggleAssetModel={() => showroom.setUseAssetModel((value) => !value)}
        selectedCategory={showroom.selectedCategory}
        onSelectCategory={showroom.handleSelectCategory}
        selectedModelLabel={showroom.selectedModelLabel}
        assetRigCaps={showroom.assetRigCaps}
        wheelSpinUnavailable={showroom.wheelSpinUnavailable}
        wheelReadyCategory={showroom.wheelReadyCategory}
        cameraPreset={showroom.cameraPreset}
        onSelectCamera={showroom.handleSelectCamera}
        autoTour={showroom.autoTour}
        onToggleAutoTour={showroom.handleToggleAutoTour}
        reduceMotion={showroom.reduceMotion}
        activeTab={showroom.activeTab}
        onChangeTab={showroom.setActiveTab}
        leftDoorOpen={showroom.leftDoorOpen}
        rightDoorOpen={showroom.rightDoorOpen}
        trunkOpen={showroom.trunkOpen}
        sunroofOpen={showroom.sunroofOpen}
        lightsOn={showroom.lightsOn}
        hazardOn={showroom.hazardOn}
        onToggleLeftDoor={() => showroom.setLeftDoorOpen((value) => !value)}
        onToggleRightDoor={() => showroom.setRightDoorOpen((value) => !value)}
        onToggleTrunk={() => showroom.setTrunkOpen((value) => !value)}
        onToggleSunroof={() => showroom.setSunroofOpen((value) => !value)}
        onToggleLights={() => showroom.setLightsOn((value) => !value)}
        onToggleHazard={() => showroom.setHazardOn((value) => !value)}
        supportsInteraction={showroom.supportsInteraction}
        interactionHint={showroom.interactionHint}
        unsupportedInteractionNote={showroom.unsupportedInteractionNote}
        engineOn={showroom.engineOn}
        braking={showroom.braking}
        onToggleEngine={() => showroom.setEngineOn((value) => !value)}
        onToggleBraking={() => showroom.setBraking((value) => !value)}
        wheelSpinHint={showroom.wheelSpinHint}
        onApplyWelcomeMode={showroom.applyWelcomeMode}
        onApplyDriveMode={showroom.applyDriveMode}
        onResetAll={showroom.resetAll}
        seatDriverOffset={showroom.seatDriverOffset}
        seatPassengerOffset={showroom.seatPassengerOffset}
        steeringAngle={showroom.steeringAngle}
        speedKph={showroom.speedKph}
        onSeatDriverOffset={showroom.setSeatDriverOffset}
        onSeatPassengerOffset={showroom.setSeatPassengerOffset}
        onSteeringAngle={showroom.setSteeringAngle}
        onSpeedKph={showroom.setSpeedKph}
        selectedPaintId={showroom.selectedPaintId}
        onSelectPaint={showroom.setSelectedPaintId}
      />
    </main>
  );
}
