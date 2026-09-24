"use client";

import { Button } from "@/components/ui/button";
import {
  CAR_CATEGORY_OPTIONS,
  type CarCategoryKey,
} from "@/lib/car-categories";
import type { AssetRigCapabilities } from "@/components/car-showroom-scene";

type ShowroomControlPanelsProps = {
  useAssetModel: boolean;
  onToggleAssetModel: () => void;
  selectedCategory: CarCategoryKey;
  onSelectCategory: (key: CarCategoryKey) => void;
  selectedModelLabel: string;
  assetRigCaps: AssetRigCapabilities | null;
  wheelSpinUnavailable: boolean;
  wheelReadyCategory: { key: CarCategoryKey; label: string } | undefined;
  unsupportedInteractionNote: string | null;
  onApplyWelcomeMode: () => void;
  onApplyDriveMode: () => void;
  onResetAll: () => void;
};

export function ShowroomControlPanels({
  useAssetModel,
  onToggleAssetModel,
  selectedCategory,
  onSelectCategory,
  selectedModelLabel,
  assetRigCaps,
  wheelSpinUnavailable,
  wheelReadyCategory,
  unsupportedInteractionNote,
  onApplyWelcomeMode,
  onApplyDriveMode,
  onResetAll,
}: ShowroomControlPanelsProps) {
  return (
    <section className="grid gap-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={useAssetModel ? "default" : "outline"} onClick={onToggleAssetModel}>
          {useAssetModel ? "使用几何体车模" : "尝试加载 GLB 车模"}
        </Button>
        {CAR_CATEGORY_OPTIONS.map((model) => (
          <Button
            key={model.key}
            variant={selectedCategory === model.key ? "default" : "outline"}
            onClick={() => onSelectCategory(model.key)}
            title={model.capabilityHint}
          >
            <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span>{model.label}</span>
              {model.capabilityHint ? (
                <span className="text-[10px] font-normal text-slate-400 sm:text-xs">
                  {model.capabilityHint}
                </span>
              ) : null}
            </span>
          </Button>
        ))}
        <p className="basis-full text-xs text-slate-400 sm:basis-auto">
          当前模型：{selectedModelLabel || "加载中..."}。车门 / 灯光 / 车漆 / 视角等常用操作在上方画布区域。
        </p>
        {useAssetModel && assetRigCaps ? (
          <p className="w-full text-xs text-slate-500">
            GLB 部件识别：左前门 {assetRigCaps.leftDoor ? "✓" : "—"} · 右前门{" "}
            {assetRigCaps.rightDoor ? "✓" : "—"} · 后备箱 {assetRigCaps.trunk ? "✓" : "—"} · 车灯{" "}
            {assetRigCaps.headLights ? "✓" : "—"} · 尾灯 {assetRigCaps.tailLights ? "✓" : "—"} ·
            天窗 {assetRigCaps.sunroof ? "✓" : "—"} · 车轮 {assetRigCaps.wheels ? "✓" : "—"}
            {assetRigCaps.leftDoor ? "" : "（未识别到的部件见 documentation/market-glb-rig.md）"}
          </p>
        ) : null}
        {unsupportedInteractionNote ? (
          <p className="w-full text-xs leading-6 text-amber-300/80">{unsupportedInteractionNote}</p>
        ) : null}
        {wheelSpinUnavailable && wheelReadyCategory ? (
          <Button variant="secondary" onClick={() => onSelectCategory(wheelReadyCategory.key)}>
            切换到{wheelReadyCategory.label}（支持真实四轮转动）
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">模式预设</h2>
          <p className="text-xs text-slate-500">一键预设</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button variant="secondary" onClick={onApplyWelcomeMode}>
            迎宾模式
          </Button>
          <Button variant="secondary" onClick={onApplyDriveMode}>
            驾驶预备模式
          </Button>
          <Button variant="outline" onClick={onResetAll}>
            复位全部状态
          </Button>
        </div>
      </div>
    </section>
  );
}
