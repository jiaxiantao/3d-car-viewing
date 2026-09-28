/**
 * Centralized paint catalog — kept in `lib/` so URL state and structured data
 * can reference IDs without importing the React page.
 */

export type ShowroomPaintOption = {
  id: string;
  label: string;
  /** Omitted for the factory swatch, which leaves the model's own paint in place. */
  primary?: string;
  secondary?: string;
  factory?: boolean;
};

/** Keep the GLB or geometric body's authored color. No swatch is copied onto the paint. */
export const SHOWROOM_FACTORY_PAINT_ID = "factory";

export const SHOWROOM_PAINT_OPTIONS: ShowroomPaintOption[] = [
  { id: SHOWROOM_FACTORY_PAINT_ID, label: "默认车漆", factory: true },
  { id: "pearl-white", label: "珍珠白", primary: "#e2e8f0" },
  { id: "obsidian-black", label: "曜石黑", primary: "#111827" },
  { id: "glacier-blue", label: "冰川蓝", primary: "#0ea5e9" },
  { id: "lava-red", label: "熔岩红", primary: "#f43f5e" },
  { id: "forest-green", label: "森野绿", primary: "#22c55e" },
  { id: "star-purple", label: "星幕紫", primary: "#a855f7" },
  { id: "sunset-gradient", label: "日落渐变", primary: "#fb7185", secondary: "#f59e0b" },
  { id: "aurora-gradient", label: "极光渐变", primary: "#06b6d4", secondary: "#8b5cf6" },
];

export const SHOWROOM_DEFAULT_PAINT_ID = SHOWROOM_FACTORY_PAINT_ID;

export function resolveShowroomPaint(id: string | null | undefined): ShowroomPaintOption {
  return (
    SHOWROOM_PAINT_OPTIONS.find((paint) => paint.id === id) ?? SHOWROOM_PAINT_OPTIONS[0]
  );
}
