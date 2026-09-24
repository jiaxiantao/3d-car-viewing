"use client";

import dynamic from "next/dynamic";

import { ShowroomControlPanels } from "@/components/showroom-control-panels";
import { ShowroomDebugPanel } from "@/components/showroom-debug-panel";
import { ShowroomViewportChrome } from "@/components/showroom-viewport-chrome";
import { useShowroomPageState } from "@/lib/use-showroom-page-state";

const IS_DEV = process.env.NODE_ENV !== "production";
const GITHUB_REPO_URL = "https://github.com/jiaxiantao/3d-car-viewing";

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
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">3D Car Showroom</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            3D 看车交互舱
          </h1>
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.68 7.68 0 0 1 8 4.77c.68.003 1.36.092 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
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
        onApplyWelcomeMode={showroom.applyWelcomeMode}
        onApplyDriveMode={showroom.applyDriveMode}
        onResetAll={showroom.resetAll}
      />
    </main>
  );
}
