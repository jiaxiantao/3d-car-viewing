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
      <div className="flex h-[58vh] min-h-[400px] items-center justify-center rounded-4xl border border-white/10 bg-slate-950/70 text-sm text-slate-400 sm:h-[560px] sm:min-h-[480px]">
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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">3D Car Showroom</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            3D 看车交互舱
          </h1>
        </div>
      </header>

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
        helpOpen={showroom.shortcutsOpen}
        onToggleHelp={() => showroom.setShortcutsOpen((open) => !open)}
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
        unsupportedInteractionNote={showroom.unsupportedInteractionNote}
        engineOn={showroom.engineOn}
        supportsInteraction={showroom.supportsInteraction}
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
      />
    </main>
  );
}
