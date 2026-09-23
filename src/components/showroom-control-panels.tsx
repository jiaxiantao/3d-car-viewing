"use client";

import type { CarCameraPreset } from "@/components/car-showroom-scene";
import { Button } from "@/components/ui/button";
import {
  CAR_CATEGORY_OPTIONS,
  type CarCategoryKey,
} from "@/lib/car-categories";
import { SHOWROOM_PAINT_OPTIONS } from "@/lib/showroom-paint-options";
import {
  INTERACTION_TABS,
  type InteractionTab,
} from "@/lib/use-showroom-page-state";
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
  cameraPreset: CarCameraPreset;
  onSelectCamera: (preset: CarCameraPreset) => void;
  autoTour: boolean;
  onToggleAutoTour: () => void;
  reduceMotion: boolean;
  activeTab: InteractionTab;
  onChangeTab: (tab: InteractionTab) => void;
  leftDoorOpen: boolean;
  rightDoorOpen: boolean;
  trunkOpen: boolean;
  sunroofOpen: boolean;
  lightsOn: boolean;
  hazardOn: boolean;
  onToggleLeftDoor: () => void;
  onToggleRightDoor: () => void;
  onToggleTrunk: () => void;
  onToggleSunroof: () => void;
  onToggleLights: () => void;
  onToggleHazard: () => void;
  supportsInteraction: (key: keyof AssetRigCapabilities) => boolean;
  interactionHint: (key: keyof AssetRigCapabilities) => string | undefined;
  unsupportedInteractionNote: string | null;
  engineOn: boolean;
  braking: boolean;
  onToggleEngine: () => void;
  onToggleBraking: () => void;
  wheelSpinHint: string | undefined;
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
  selectedPaintId: string;
  onSelectPaint: (id: string) => void;
};

export function ShowroomControlPanels(props: ShowroomControlPanelsProps) {
  const {
    useAssetModel,
    onToggleAssetModel,
    selectedCategory,
    onSelectCategory,
    selectedModelLabel,
    assetRigCaps,
    wheelSpinUnavailable,
    wheelReadyCategory,
    cameraPreset,
    onSelectCamera,
    autoTour,
    onToggleAutoTour,
    reduceMotion,
    activeTab,
    onChangeTab,
    leftDoorOpen,
    rightDoorOpen,
    trunkOpen,
    sunroofOpen,
    lightsOn,
    hazardOn,
    onToggleLeftDoor,
    onToggleRightDoor,
    onToggleTrunk,
    onToggleSunroof,
    onToggleLights,
    onToggleHazard,
    supportsInteraction,
    interactionHint,
    unsupportedInteractionNote,
    engineOn,
    braking,
    onToggleEngine,
    onToggleBraking,
    wheelSpinHint,
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
    selectedPaintId,
    onSelectPaint,
  } = props;

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
          当前模型：{selectedModelLabel || "加载中..."}。可将 GLB 放到
          `public/models/market/`，页面会自动优先加载。默认轿车体积更小且支持完整四轮动画。
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
        {wheelSpinUnavailable && wheelReadyCategory ? (
          <Button variant="secondary" onClick={() => onSelectCategory(wheelReadyCategory.key)}>
            切换到{wheelReadyCategory.label}（支持真实四轮转动）
          </Button>
        ) : null}
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
        <div className="flex flex-nowrap items-center gap-2 px-1 sm:flex-wrap sm:px-0">
          {(
            [
              { key: "overview", label: "全景视角" },
              { key: "front", label: "前脸视角" },
              { key: "side-left", label: "左侧视角" },
              { key: "side-right", label: "右侧视角" },
              { key: "rear", label: "车尾视角" },
              { key: "cockpit", label: "驾舱视角" },
            ] as const
          ).map((view) => (
            <Button
              key={view.key}
              variant={cameraPreset === view.key ? "default" : "outline"}
              onClick={() => onSelectCamera(view.key)}
              className="shrink-0"
            >
              {view.label}
            </Button>
          ))}
          <Button
            variant={autoTour ? "default" : "outline"}
            onClick={onToggleAutoTour}
            className="shrink-0"
            disabled={reduceMotion}
            title={reduceMotion ? "系统已开启减少动态效果" : undefined}
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
            id={`showroom-tab-${tab.id}`}
            aria-controls={`showroom-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => onChangeTab(tab.id)}
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
        <div
          role="tabpanel"
          id="showroom-panel-interaction"
          aria-labelledby="showroom-tab-interaction"
          className="flex flex-wrap gap-2 sm:gap-3"
        >
          <Button
            variant={leftDoorOpen ? "default" : "outline"}
            disabled={!supportsInteraction("leftDoor")}
            title={interactionHint("leftDoor")}
            aria-pressed={leftDoorOpen}
            onClick={onToggleLeftDoor}
          >
            {leftDoorOpen ? "关闭左前门" : "打开左前门"}
          </Button>
          <Button
            variant={rightDoorOpen ? "default" : "outline"}
            disabled={!supportsInteraction("rightDoor")}
            title={interactionHint("rightDoor")}
            aria-pressed={rightDoorOpen}
            onClick={onToggleRightDoor}
          >
            {rightDoorOpen ? "关闭右前门" : "打开右前门"}
          </Button>
          <Button
            variant={trunkOpen ? "default" : "outline"}
            disabled={!supportsInteraction("trunk")}
            title={interactionHint("trunk")}
            aria-pressed={trunkOpen}
            onClick={onToggleTrunk}
          >
            {trunkOpen ? "关闭后备箱" : "打开后备箱"}
          </Button>
          <Button
            variant={sunroofOpen ? "default" : "outline"}
            disabled={!supportsInteraction("sunroof")}
            title={interactionHint("sunroof")}
            aria-pressed={sunroofOpen}
            onClick={onToggleSunroof}
          >
            {sunroofOpen ? "关闭天窗" : "打开天窗"}
          </Button>
          <Button
            variant={lightsOn ? "default" : "outline"}
            aria-pressed={lightsOn}
            onClick={onToggleLights}
          >
            {lightsOn ? "关闭车灯" : "开启车灯"}
          </Button>
          <Button
            variant={hazardOn ? "default" : "outline"}
            aria-pressed={hazardOn}
            onClick={onToggleHazard}
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
        <div
          role="tabpanel"
          id="showroom-panel-drive"
          aria-labelledby="showroom-tab-drive"
          className="grid gap-4"
        >
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button
              variant={engineOn ? "default" : "outline"}
              title={wheelSpinHint}
              aria-pressed={engineOn}
              onClick={onToggleEngine}
            >
              {engineOn ? "熄火" : "启动车辆"}
            </Button>
            <Button
              variant={braking ? "default" : "outline"}
              aria-pressed={braking}
              onClick={onToggleBraking}
            >
              {braking ? "松开制动" : "模拟制动"}
            </Button>
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
      ) : null}

      {activeTab === "paint" ? (
        <div
          role="tabpanel"
          id="showroom-panel-paint"
          aria-labelledby="showroom-tab-paint"
          className="grid gap-4"
        >
          <div className="flex flex-wrap gap-2">
            {SHOWROOM_PAINT_OPTIONS.map((paint) => {
              const active = selectedPaintId === paint.id;
              return (
                <button
                  key={paint.id}
                  type="button"
                  onClick={() => onSelectPaint(paint.id)}
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
  );
}
