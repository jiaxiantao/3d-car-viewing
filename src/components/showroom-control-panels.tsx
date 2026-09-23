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
  engineOn: boolean;
  supportsInteraction: (key: keyof AssetRigCapabilities) => boolean;
  onApplyWelcomeMode: () => void;
  onApplyDriveMode: () => void;
  onResetAll: () => void;
  seatDriverOffset: number;
  seatPassengerOffset: number;
  steeringAngle: number;
  speedKph: number;
  onSeatDriverOffset: (value: number) => void;
  onSeatPassengerOffset: (value: number) => void;
  onSteeringAngle: (value: number) => void;
  onSpeedKph: (value: number) => void;
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
  engineOn,
  supportsInteraction,
  onApplyWelcomeMode,
  onApplyDriveMode,
  onResetAll,
  seatDriverOffset,
  seatPassengerOffset,
  steeringAngle,
  speedKph,
  onSeatDriverOffset,
  onSeatPassengerOffset,
  onSteeringAngle,
  onSpeedKph,
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
          <h2 className="text-sm font-semibold text-slate-100">高级调节</h2>
          <p className="text-xs text-slate-500">座椅 / 方向盘 / 车速与一键预设</p>
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
            onChange={(event) => onSeatDriverOffset(Number(event.target.value) / 100)}
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
            onChange={(event) => onSeatPassengerOffset(Number(event.target.value) / 100)}
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
            onChange={(event) => onSteeringAngle(Number(event.target.value))}
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
            onChange={(event) => onSpeedKph(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700"
          />
        </div>
      </div>
    </section>
  );
}
