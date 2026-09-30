"use client";

import { Button } from "@/components/ui/button";
import {
  CAR_CATEGORIES,
  CAR_CATEGORY_OPTIONS,
  isCarInteractionDisabled,
  type CarBodyInteraction,
  type CarCategoryKey,
} from "@/lib/car-categories";
import type { AssetRigCapabilities } from "@/components/car-showroom-scene";

function interactionMark(
  categoryKey: CarCategoryKey,
  key: CarBodyInteraction,
  recognized: boolean,
) {
  if (isCarInteractionDisabled(CAR_CATEGORIES[categoryKey], key)) {
    return "禁用";
  }
  return recognized ? "✓" : "—";
}

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
  allGlbFailed?: boolean;
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
  allGlbFailed = false,
}: ShowroomControlPanelsProps) {
  return (
    <section className="grid gap-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {CAR_CATEGORY_OPTIONS.map((model) => (
          <Button
            key={model.key}
            variant={useAssetModel && selectedCategory === model.key ? "default" : "outline"}
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
        <Button variant={useAssetModel ? "outline" : "default"} onClick={onToggleAssetModel}>
          {useAssetModel ? "使用几何体车模" : "尝试加载 GLB 车模"}
        </Button>
        <p className="basis-full text-xs text-slate-400 sm:basis-auto">
          当前模型：{selectedModelLabel || "加载中..."}。车门 / 灯光 / 车漆 / 视角等常用操作在上方画布区域。
        </p>
        {useAssetModel && assetRigCaps ? (
          <p className="w-full text-xs text-slate-500">
            GLB 部件识别：左前门 {interactionMark(selectedCategory, "leftDoor", assetRigCaps.leftDoor)}{" "}
            · 右前门 {interactionMark(selectedCategory, "rightDoor", assetRigCaps.rightDoor)} ·
            后备箱 {interactionMark(selectedCategory, "trunk", assetRigCaps.trunk)} · 车灯{" "}
            {assetRigCaps.headLights ? "✓" : "—"} · 尾灯 {assetRigCaps.tailLights ? "✓" : "—"} ·
            天窗 {interactionMark(selectedCategory, "sunroof", assetRigCaps.sunroof)} · 车轮{" "}
            {assetRigCaps.wheels ? "✓" : "—"}
            {assetRigCaps.leftDoor ? "" : "（未识别到的部件见 documentation/market-glb-rig.md）"}
          </p>
        ) : null}
        {allGlbFailed && !useAssetModel ? (
          <p className="w-full text-xs leading-6 text-amber-300/80">
            所有 GLB 车模加载失败，已切换为几何体车模。可点「尝试加载 GLB 车模」或任一车型重试。
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
    </section>
  );
}
