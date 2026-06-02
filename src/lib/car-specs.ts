/**
 * Per-category showroom data shown in the spec / pricing card and used to populate
 * structured data for SEO. Numbers are illustrative — replace with real OEM values
 * before launching commercially.
 */

export type CarCategoryKey = "suv" | "sedan" | "offroad";

export type CarSpec = {
  key: CarCategoryKey;
  label: string;
  englishName: string;
  primaryUrl: string;
  tagline: string;
  /** Official starting price (in CNY 万元). */
  priceFromWan: number;
  /** Tab badge color override for the active state (hex). */
  accentColor: string;
  /** Headline performance numbers. */
  highlights: Array<{ label: string; value: string; unit?: string }>;
  /** Optional bullet copy under specs. */
  bullets: string[];
};

export const CAR_SPECS: Record<CarCategoryKey, CarSpec> = {
  suv: {
    key: "suv",
    label: "SUV",
    englishName: "Mainstream SUV",
    primaryUrl: "/models/market/suv-mainstream.glb",
    tagline: "都市家用 · 7 座大空间 · 高颜值",
    priceFromWan: 18.99,
    accentColor: "#22d3ee",
    highlights: [
      { label: "综合最大功率", value: "180", unit: "kW" },
      { label: "0–100 km/h", value: "7.6", unit: "s" },
      { label: "CLTC 续航", value: "560", unit: "km" },
      { label: "整备质量", value: "1980", unit: "kg" },
    ],
    bullets: ["前后双电机四驱", "L2+ 高速领航辅助", "全景天幕 + 三区独立空调"],
  },
  sedan: {
    key: "sedan",
    label: "小轿车",
    englishName: "Performance Sedan",
    primaryUrl: "/models/market/sedan-mainstream.glb",
    tagline: "运动后驱 · 操控乐趣 · 极致姿态",
    priceFromWan: 25.99,
    accentColor: "#a855f7",
    highlights: [
      { label: "综合最大功率", value: "250", unit: "kW" },
      { label: "0–100 km/h", value: "4.2", unit: "s" },
      { label: "CLTC 续航", value: "510", unit: "km" },
      { label: "前后配重", value: "50:50", unit: "" },
    ],
    bullets: ["后驱 / 四驱可选", "可变阻尼 CDC 悬架", "Bowers & Wilkins 旗舰音响"],
  },
  offroad: {
    key: "offroad",
    label: "越野车",
    englishName: "Hardcore Off-Road",
    primaryUrl: "/models/market/offroad-mainstream.glb",
    tagline: "硬派非承载 · 三把锁 · 全地形可达",
    priceFromWan: 88.88,
    accentColor: "#f59e0b",
    highlights: [
      { label: "综合最大功率", value: "441", unit: "kW" },
      { label: "0–100 km/h", value: "4.4", unit: "s" },
      { label: "涉水深度", value: "1000", unit: "mm" },
      { label: "接近角 / 离去角", value: "33° / 36°", unit: "" },
    ],
    bullets: ["前中后三把差速锁", "蟹行模式 + 坦克掉头", "高强度大梁 + 8 横梁"],
  },
};

export const CAR_CATEGORY_OPTIONS: Array<Pick<CarSpec, "key" | "label" | "primaryUrl">> = [
  { key: "suv", label: CAR_SPECS.suv.label, primaryUrl: CAR_SPECS.suv.primaryUrl },
  { key: "sedan", label: CAR_SPECS.sedan.label, primaryUrl: CAR_SPECS.sedan.primaryUrl },
  { key: "offroad", label: CAR_SPECS.offroad.label, primaryUrl: CAR_SPECS.offroad.primaryUrl },
];

export function isCarCategoryKey(value: unknown): value is CarCategoryKey {
  return value === "suv" || value === "sedan" || value === "offroad";
}

export function resolveCarCategoryKey(value: unknown): CarCategoryKey {
  return isCarCategoryKey(value) ? value : "suv";
}
