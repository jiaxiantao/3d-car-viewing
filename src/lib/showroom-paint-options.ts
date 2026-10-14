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

const CUSTOM_PAINT_ID = /^custom-([0-9a-f]{6})$/i;

/** Common colors that are not on the showroom swatch card. */
const NAMED_CUSTOM_COLORS: Array<{ names: string[]; hex: string; label: string }> = [
  { names: ["银", "银色", "银灰", "金属银", "silver"], hex: "#c5c9ce", label: "银色" },
  { names: ["金", "金色", "香槟金", "gold"], hex: "#d4af37", label: "金色" },
  { names: ["灰", "灰色", "太空灰", "gray", "grey"], hex: "#6b7280", label: "灰色" },
  { names: ["橙", "橙色", "orange"], hex: "#f97316", label: "橙色" },
  { names: ["黄", "黄色", "yellow"], hex: "#eab308", label: "黄色" },
  { names: ["粉", "粉色", "pink"], hex: "#f9a8d4", label: "粉色" },
  { names: ["棕", "棕色", "咖啡", "咖啡色", "brown"], hex: "#8a5a3b", label: "棕色" },
  { names: ["米", "米色", "香槟", "beige"], hex: "#d6c4a8", label: "米色" },
  { names: ["青", "青色", "cyan"], hex: "#22d3ee", label: "青色" },
  { names: ["铜", "铜色", "copper"], hex: "#b87333", label: "铜色" },
];

function compactPaintToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function customPaintId(hex: string): string {
  return `custom-${hex.slice(1).toLowerCase()}`;
}

export function isCustomPaintId(id: string | null | undefined): boolean {
  return typeof id === "string" && CUSTOM_PAINT_ID.test(id);
}

export function isShowroomPaintId(id: string | null | undefined): boolean {
  return canonicalShowroomPaintId(id) !== null;
}

export function canonicalShowroomPaintId(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  if (SHOWROOM_PAINT_OPTIONS.some((paint) => paint.id === id)) {
    return id;
  }
  const custom = CUSTOM_PAINT_ID.exec(id);
  if (!custom) {
    return null;
  }
  return `custom-${custom[1].toLowerCase()}`;
}

function paintFromHex(hex: string, label?: string): ShowroomPaintOption {
  const normalized = hex.toLowerCase();
  const named = NAMED_CUSTOM_COLORS.find((item) => item.hex === normalized);
  return {
    id: customPaintId(normalized),
    label: label ?? named?.label ?? `自定义 ${normalized.toUpperCase()}`,
    primary: normalized,
  };
}

function parseHexColor(value: string): string | null {
  const token = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(token)) {
    const [r, g, b] = token;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(token)) {
    return `#${token.toLowerCase()}`;
  }
  return null;
}

/**
 * Catalog names stay on the swatch card. Any other color name or hex becomes
 * a custom paint the showroom can apply directly.
 */
export function parseShowroomPaintRequest(raw: string): ShowroomPaintOption | null {
  const token = compactPaintToken(raw);
  if (!token) {
    return null;
  }
  for (const paint of SHOWROOM_PAINT_OPTIONS) {
    if (compactPaintToken(paint.id) === token || compactPaintToken(paint.label) === token) {
      return paint;
    }
  }
  const named = NAMED_CUSTOM_COLORS.find((item) =>
    item.names.some((name) => compactPaintToken(name) === token),
  );
  if (named) {
    return paintFromHex(named.hex, named.label);
  }
  const hex = parseHexColor(raw);
  if (!hex) {
    return null;
  }
  return paintFromHex(hex);
}

export function resolveShowroomPaint(id: string | null | undefined): ShowroomPaintOption {
  const catalog = SHOWROOM_PAINT_OPTIONS.find((paint) => paint.id === id);
  if (catalog) {
    return catalog;
  }
  const custom = typeof id === "string" ? CUSTOM_PAINT_ID.exec(id) : null;
  if (custom) {
    return paintFromHex(`#${custom[1].toLowerCase()}`);
  }
  return SHOWROOM_PAINT_OPTIONS[0];
}
