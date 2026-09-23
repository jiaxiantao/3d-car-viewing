"use client";

import type { ReactNode } from "react";

import type { AssetRigCapabilities, CarCameraPreset } from "@/components/car-showroom-scene";
import { SHOWROOM_PAINT_OPTIONS } from "@/lib/showroom-paint-options";
import { cn } from "@/lib/utils";
import {
  SHOWROOM_SCENE_MODES,
  SHOWROOM_SCENE_MODE_ORDER,
  type ShowroomSceneMode,
} from "@/lib/showroom-scene-modes";

type RailButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
};

function RailButton({
  label,
  active,
  disabled,
  title,
  onClick,
  pressed,
  className,
}: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed ?? active}
      className={cn(
        "min-h-9 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium leading-tight transition sm:text-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-cyan-200/70 bg-cyan-200/20 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
          : "border-white/12 bg-slate-950/55 text-slate-200 hover:border-white/25 hover:bg-white/10",
        className,
      )}
    >
      {label}
    </button>
  );
}

type ShowroomViewportChromeProps = {
  children: ReactNode;
  sceneMode: ShowroomSceneMode;
  onChangeSceneMode: (mode: ShowroomSceneMode) => void;
  onCaptureScreenshot: () => void;
  onToggleFullscreen: () => void;
  onCopyShareLink: () => void;
  isFullscreen: boolean;
  capturing?: boolean;
  copyingLink?: boolean;
  leftDoorOpen: boolean;
  rightDoorOpen: boolean;
  trunkOpen: boolean;
  sunroofOpen: boolean;
  lightsOn: boolean;
  hazardOn: boolean;
  engineOn: boolean;
  braking: boolean;
  autoTour: boolean;
  reduceMotion: boolean;
  cameraPreset: CarCameraPreset;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  onToggleSunroof: () => void;
  onToggleLights: () => void;
  onToggleHazard: () => void;
  onToggleEngine: () => void;
  onToggleBraking: () => void;
  onToggleAutoTour: () => void;
  onSelectCamera: (preset: CarCameraPreset) => void;
  selectedPaintId: string;
  onSelectPaint: (id: string) => void;
  supportsInteraction: (key: keyof AssetRigCapabilities) => boolean;
  interactionHint: (key: keyof AssetRigCapabilities) => string | undefined;
  wheelSpinHint?: string;
  helpOpen: boolean;
  onToggleHelp: () => void;
};

export function ShowroomViewportChrome({
  children,
  sceneMode,
  onChangeSceneMode,
  onCaptureScreenshot,
  onToggleFullscreen,
  onCopyShareLink,
  isFullscreen,
  capturing,
  copyingLink,
  leftDoorOpen,
  rightDoorOpen,
  trunkOpen,
  sunroofOpen,
  lightsOn,
  hazardOn,
  engineOn,
  braking,
  autoTour,
  reduceMotion,
  cameraPreset,
  onToggleLeftDoor,
  onToggleRightDoor,
  onToggleTrunk,
  onToggleSunroof,
  onToggleLights,
  onToggleHazard,
  onToggleEngine,
  onToggleBraking,
  onToggleAutoTour,
  onSelectCamera,
  selectedPaintId,
  onSelectPaint,
  supportsInteraction,
  interactionHint,
  wheelSpinHint,
  helpOpen,
  onToggleHelp,
}: ShowroomViewportChromeProps) {
  const paintSwatches = (
    <div
      role="listbox"
      aria-label="车漆配色"
      className="flex items-center gap-1.5"
    >
      <span className="shrink-0 pr-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
        车漆
      </span>
      {SHOWROOM_PAINT_OPTIONS.map((paint) => {
        const active = selectedPaintId === paint.id;
        return (
          <button
            key={paint.id}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={paint.label}
            title={paint.label}
            onClick={() => onSelectPaint(paint.id)}
            className={cn(
              "h-7 w-7 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 sm:h-8 sm:w-8",
              active
                ? "border-cyan-200 scale-110 shadow-[0_0_0_2px_rgba(34,211,238,0.45)]"
                : "border-white/25 hover:border-white/50 hover:scale-105",
            )}
            style={{
              background: paint.secondary
                ? `linear-gradient(135deg, ${paint.primary}, ${paint.secondary})`
                : paint.primary,
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="relative isolate">
      {children}

      {/* Top bar — scene + capture tools + help */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-2 sm:p-3">
        <div className="pointer-events-auto relative flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-slate-950/75 px-2 py-1.5 shadow-lg backdrop-blur-md sm:gap-2 sm:px-3">
          <div
            role="radiogroup"
            aria-label="展厅场景模式"
            className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 text-[11px] sm:text-xs"
          >
            {SHOWROOM_SCENE_MODE_ORDER.map((mode) => {
              const config = SHOWROOM_SCENE_MODES[mode];
              const isActive = sceneMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  title={config.description}
                  onClick={() => onChangeSceneMode(mode)}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition sm:px-3",
                    isActive
                      ? "bg-cyan-200 text-slate-950 shadow"
                      : "text-slate-300 hover:text-white",
                  )}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
          <div className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
          <button
            type="button"
            onClick={onCaptureScreenshot}
            disabled={capturing}
            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/10 disabled:opacity-50 sm:text-xs"
            title="截图（S）"
          >
            {capturing ? "保存中" : "截图"}
          </button>
          <button
            type="button"
            onClick={onCopyShareLink}
            disabled={copyingLink}
            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/10 disabled:opacity-50 sm:text-xs"
            title="复制分享链接（C）"
          >
            {copyingLink ? "复制中" : "分享"}
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/10 sm:text-xs"
            title={isFullscreen ? "退出全屏" : "全屏看车（F）"}
          >
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
          <button
            type="button"
            onClick={onToggleHelp}
            aria-expanded={helpOpen}
            aria-controls="showroom-help-panel"
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition sm:text-xs",
              helpOpen
                ? "border-cyan-200/70 bg-cyan-200/15 text-white"
                : "border-white/12 bg-white/5 text-slate-100 hover:bg-white/10",
            )}
            title="操作说明"
          >
            说明
          </button>

          {helpOpen ? (
            <div
              id="showroom-help-panel"
              role="region"
              aria-label="操作说明"
              className="absolute left-1/2 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-slate-950/95 p-3 text-left shadow-xl backdrop-blur-md"
            >
              <p className="text-xs leading-6 text-slate-300">
                常用操作在画布顶栏与左右侧；车型切换与座椅 / 车速等细项在下方。
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                键盘：
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">1-6</kbd>
                视角，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">E</kbd>
                启动，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">L</kbd>
                灯光，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">S</kbd>
                截图，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">C</kbd>
                分享，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">F</kbd>
                全屏，
                <kbd className="mx-0.5 rounded bg-white/10 px-1 py-0.5 text-[11px]">T</kbd>
                环车。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Left rail — body interaction (desktop / tablet) */}
      <aside
        aria-label="车身快捷操作"
        className="pointer-events-none absolute bottom-24 left-2 top-14 z-20 hidden w-[7.25rem] flex-col justify-center md:flex lg:left-3 lg:w-32"
      >
        <div className="pointer-events-auto flex max-h-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/12 bg-slate-950/70 p-1.5 shadow-lg backdrop-blur-md">
          <p className="px-1 pb-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            车身
          </p>
          <RailButton
            className="w-full"
            label={leftDoorOpen ? "关左门" : "开左门"}
            active={leftDoorOpen}
            disabled={!supportsInteraction("leftDoor")}
            title={interactionHint("leftDoor")}
            onClick={onToggleLeftDoor}
          />
          <RailButton
            className="w-full"
            label={rightDoorOpen ? "关右门" : "开右门"}
            active={rightDoorOpen}
            disabled={!supportsInteraction("rightDoor")}
            title={interactionHint("rightDoor")}
            onClick={onToggleRightDoor}
          />
          <RailButton
            className="w-full"
            label={trunkOpen ? "关后备箱" : "开后备箱"}
            active={trunkOpen}
            disabled={!supportsInteraction("trunk")}
            title={interactionHint("trunk")}
            onClick={onToggleTrunk}
          />
          <RailButton
            className="w-full"
            label={sunroofOpen ? "关天窗" : "开天窗"}
            active={sunroofOpen}
            disabled={!supportsInteraction("sunroof")}
            title={interactionHint("sunroof")}
            onClick={onToggleSunroof}
          />
          <RailButton
            className="w-full"
            label={lightsOn ? "关车灯" : "开车灯"}
            active={lightsOn}
            onClick={onToggleLights}
          />
          <RailButton
            className="w-full"
            label={hazardOn ? "关双闪" : "开双闪"}
            active={hazardOn}
            onClick={onToggleHazard}
          />
        </div>
      </aside>

      {/* Right rail — drive + view (desktop / tablet) */}
      <aside
        aria-label="驾驶与视角快捷操作"
        className="pointer-events-none absolute bottom-24 right-2 top-14 z-20 hidden w-[7.25rem] flex-col justify-center md:flex lg:right-3 lg:w-32"
      >
        <div className="pointer-events-auto flex max-h-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/12 bg-slate-950/70 p-1.5 shadow-lg backdrop-blur-md">
          <p className="px-1 pb-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            驾驶
          </p>
          <RailButton
            className="w-full"
            label={engineOn ? "熄火" : "启动"}
            active={engineOn}
            title={wheelSpinHint}
            onClick={onToggleEngine}
          />
          <RailButton
            className="w-full"
            label={braking ? "松制动" : "制动"}
            active={braking}
            onClick={onToggleBraking}
          />
          <RailButton
            className="w-full"
            label={autoTour ? "停巡检" : "环车"}
            active={autoTour}
            disabled={reduceMotion}
            title={reduceMotion ? "系统已开启减少动态效果" : "自动环车巡检（T）"}
            onClick={onToggleAutoTour}
          />
          <p className="px-1 pb-0.5 pt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            视角
          </p>
          {(
            [
              { key: "overview", label: "全景" },
              { key: "front", label: "前脸" },
              { key: "side-left", label: "左侧" },
              { key: "rear", label: "车尾" },
              { key: "cockpit", label: "驾舱" },
            ] as const
          ).map((view) => (
            <RailButton
              key={view.key}
              className="w-full"
              label={view.label}
              active={cameraPreset === view.key}
              onClick={() => onSelectCamera(view.key)}
            />
          ))}
        </div>
      </aside>

      {/* Desktop paint bar — bottom center of canvas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 hidden justify-center px-28 md:flex lg:px-36">
        <div className="pointer-events-auto max-w-full overflow-x-auto rounded-2xl border border-white/12 bg-slate-950/75 px-3 py-2 shadow-lg backdrop-blur-md">
          {paintSwatches}
        </div>
      </div>

      {/* Mobile quick strip — replaces side rails */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 p-2 md:hidden">
        <div className="pointer-events-auto overflow-x-auto rounded-2xl border border-white/12 bg-slate-950/80 px-2.5 py-2 shadow-lg backdrop-blur-md">
          {paintSwatches}
        </div>
        <div className="pointer-events-auto flex gap-1.5 overflow-x-auto rounded-2xl border border-white/12 bg-slate-950/80 p-1.5 shadow-lg backdrop-blur-md">
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label={lightsOn ? "关灯" : "车灯"}
            active={lightsOn}
            onClick={onToggleLights}
          />
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label={engineOn ? "熄火" : "启动"}
            active={engineOn}
            onClick={onToggleEngine}
          />
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label={leftDoorOpen ? "关左门" : "左门"}
            active={leftDoorOpen}
            disabled={!supportsInteraction("leftDoor")}
            onClick={onToggleLeftDoor}
          />
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label={rightDoorOpen ? "关右门" : "右门"}
            active={rightDoorOpen}
            disabled={!supportsInteraction("rightDoor")}
            onClick={onToggleRightDoor}
          />
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label={braking ? "松制动" : "制动"}
            active={braking}
            onClick={onToggleBraking}
          />
          <RailButton
            className="shrink-0 whitespace-nowrap"
            label="全景"
            active={cameraPreset === "overview"}
            onClick={() => onSelectCamera("overview")}
          />
        </div>
      </div>
    </div>
  );
}
