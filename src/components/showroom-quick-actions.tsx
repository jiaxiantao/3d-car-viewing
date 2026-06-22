"use client";

import { cn } from "@/lib/utils";
import {
  SHOWROOM_SCENE_MODES,
  SHOWROOM_SCENE_MODE_ORDER,
  type ShowroomSceneMode,
} from "@/lib/showroom-scene-modes";

type ShowroomQuickActionsProps = {
  sceneMode: ShowroomSceneMode;
  onChangeSceneMode: (mode: ShowroomSceneMode) => void;
  onCaptureScreenshot: () => void;
  onToggleFullscreen: () => void;
  onCopyShareLink: () => void;
  isFullscreen: boolean;
  capturing?: boolean;
  copyingLink?: boolean;
};

const ICON_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-slate-950/60 px-3 text-xs font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:opacity-50";

export function ShowroomQuickActions({
  sceneMode,
  onChangeSceneMode,
  onCaptureScreenshot,
  onToggleFullscreen,
  onCopyShareLink,
  isFullscreen,
  capturing,
  copyingLink,
}: ShowroomQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="展厅场景模式"
        className="inline-flex rounded-full border border-white/15 bg-slate-950/60 p-1 text-xs"
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
                "rounded-full px-3 py-1 transition",
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

      <button
        type="button"
        onClick={onCaptureScreenshot}
        disabled={capturing}
        className={ICON_BUTTON_CLASS}
        aria-label="保存当前画面为图片"
        title="截图（保存为 PNG）"
      >
        <span aria-hidden>📸</span>
        <span>{capturing ? "保存中..." : "截图"}</span>
      </button>
      <button
        type="button"
        onClick={onCopyShareLink}
        disabled={copyingLink}
        className={ICON_BUTTON_CLASS}
        aria-label="复制当前看车配置链接"
        title="复制分享链接（含车型 / 车漆 / 视角 / 场景）"
      >
        <span aria-hidden>🔗</span>
        <span>{copyingLink ? "复制中..." : "分享链接"}</span>
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={ICON_BUTTON_CLASS}
        aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
        aria-pressed={isFullscreen}
        title={isFullscreen ? "退出全屏（Esc）" : "全屏沉浸 (F)"}
      >
        <span aria-hidden>{isFullscreen ? "✕" : "⛶"}</span>
        <span>{isFullscreen ? "退出全屏" : "全屏看车"}</span>
      </button>
    </div>
  );
}
