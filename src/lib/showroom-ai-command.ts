/**
 * Maps a remote model's tool call onto the showroom controls that already exist.
 * The model cannot invent meshes, specs, or new interactions.
 */

import {
  CAR_CATEGORIES,
  CAR_CATEGORY_OPTIONS,
  isCarCategoryKey,
  isCarInteractionDisabled,
  type CarBodyInteraction,
  type CarCategoryKey,
} from "@/lib/car-categories";
import type { CarCameraPreset } from "@/components/showroom/types";
import {
  SHOWROOM_PAINT_OPTIONS,
  SHOWROOM_FACTORY_PAINT_ID,
  parseShowroomPaintRequest,
  resolveShowroomPaint,
} from "@/lib/showroom-paint-options";
import {
  SHOWROOM_PRESETS,
  matchShowroomPreset,
  type ShowroomPresetBodyKey,
  type ShowroomPresetId,
  type ShowroomPresetSnapshot,
} from "@/lib/showroom-presets";
import { showroomCapabilityNote } from "@/lib/showroom-capability-note";
import {
  SHOWROOM_LIGHTING_OPTIONS,
  SHOWROOM_VENUE_OPTIONS,
  isShowroomLightingMode,
  isShowroomVenueMode,
  type ShowroomLightingMode,
  type ShowroomVenueMode,
} from "@/lib/showroom-scene-modes";

const CAMERA_PRESETS: CarCameraPreset[] = [
  "overview",
  "front",
  "side-left",
  "side-right",
  "rear",
  "cockpit",
];

const CAMERA_LABELS: Record<CarCameraPreset, string> = {
  overview: "全景",
  front: "前脸",
  "side-left": "左侧",
  "side-right": "右侧",
  rear: "车尾",
  cockpit: "驾舱",
};

const CAMERA_ALIASES: Record<string, CarCameraPreset> = {
  overview: "overview",
  全景: "overview",
  外观: "overview",
  环视: "overview",
  front: "front",
  前脸: "front",
  正面: "front",
  车头: "front",
  sideleft: "side-left",
  左侧: "side-left",
  sideright: "side-right",
  右侧: "side-right",
  rear: "rear",
  车尾: "rear",
  尾部: "rear",
  cockpit: "cockpit",
  驾舱: "cockpit",
  驾驶舱: "cockpit",
  驾驶室: "cockpit",
  驾驶室仓位: "cockpit",
  内饰: "cockpit",
  座舱: "cockpit",
};

const VENUE_ALIASES: Record<string, ShowroomVenueMode> = {
  studio: "studio",
  影棚: "studio",
  工作室: "studio",
  hall: "hall",
  大厅: "hall",
  展厅: "hall",
  road: "road",
  公路: "road",
  道路: "road",
  高速: "road",
};

const LIGHT_ALIASES: Record<string, ShowroomLightingMode> = {
  day: "day",
  白天: "day",
  日光: "day",
  night: "night",
  夜晚: "night",
  夜间: "night",
  夜景: "night",
};

const MODEL_ALIASES: Record<string, CarCategoryKey> = {
  su7ultra: "su7-ultra",
  xiaomisu7ultra: "su7-ultra",
  小米su7ultra: "su7-ultra",
  yu7: "yu7",
  xiaomiyu7: "yu7",
  小米yu7: "yu7",
  su7max: "su7-max",
  xiaomisu7max: "su7-max",
  小米su7max: "su7-max",
  q3: "suv",
  audiq3: "suv",
  奥迪q3: "suv",
  奥迪: "suv",
  g63: "g63",
  amgg63: "g63",
  奔驰: "g63",
  奔驰amgg63: "g63",
  jeep: "jeep",
  wrangler: "jeep",
  牧马人: "jeep",
  g900: "offroad",
  brabus: "offroad",
  巴博斯: "offroad",
  巴博斯g900: "offroad",
  m2: "sedan",
  bmw: "sedan",
  bmvm2: "sedan",
  宝马: "sedan",
  宝马m2: "sedan",
};

const PAINT_ALIASES: Record<string, string> = {
  默认: SHOWROOM_FACTORY_PAINT_ID,
  原厂: SHOWROOM_FACTORY_PAINT_ID,
  白色: "pearl-white",
  黑色: "obsidian-black",
  蓝色: "glacier-blue",
  红色: "lava-red",
  绿色: "forest-green",
  紫色: "star-purple",
};

export type ShowroomAiBodyAvailability = {
  leftDoor: boolean;
  rightDoor: boolean;
  trunk: boolean;
  sunroof: boolean;
};

export type ShowroomAiScene = {
  model: CarCategoryKey;
  paintId: string;
  camera: CarCameraPreset;
  venue: ShowroomVenueMode;
  light: ShowroomLightingMode;
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
  speedKph: number;
  steeringAngle: number;
  /** False when the wheels are fused to the body. Omitted means they can spin. */
  wheels?: boolean;
  body: ShowroomAiBodyAvailability;
};

export type ShowroomControlPatch = {
  model?: CarCategoryKey;
  paintId?: string;
  camera?: CarCameraPreset;
  venue?: ShowroomVenueMode;
  lighting?: ShowroomLightingMode;
  leftDoorOpen?: boolean;
  rightDoorOpen?: boolean;
  trunkOpen?: boolean;
  sunroofOpen?: boolean;
  lightsOn?: boolean;
  hazardOn?: boolean;
  engineOn?: boolean;
  braking?: boolean;
  autoTour?: boolean;
  speedKph?: number;
  steeringAngle?: number;
  seatDriverOffset?: number;
  seatPassengerOffset?: number;
};

export type ShowroomControlResult = {
  applied: string[];
  skipped: string[];
  patch: ShowroomControlPatch;
};

type PresetName = ShowroomPresetId | "reset";

type ParsedControl = {
  model?: CarCategoryKey;
  paintId?: string;
  camera?: CarCameraPreset;
  venue?: ShowroomVenueMode;
  light?: ShowroomLightingMode;
  leftDoor?: boolean;
  rightDoor?: boolean;
  trunk?: boolean;
  sunroof?: boolean;
  lights?: boolean;
  hazard?: boolean;
  engine?: boolean;
  braking?: boolean;
  autoTour?: boolean;
  preset?: PresetName;
};

const CONTROL_TOOL_NAME = "control_showroom";

function compact(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isCameraPreset(value: string): value is CarCameraPreset {
  return (CAMERA_PRESETS as string[]).includes(value);
}

export function coerceShowroomAiScene(value: unknown): ShowroomAiScene | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<ShowroomAiScene>;
  if (!isCarCategoryKey(raw.model) || !isCameraPreset(String(raw.camera ?? ""))) {
    return null;
  }
  if (!isShowroomVenueMode(raw.venue) || !isShowroomLightingMode(raw.light)) {
    return null;
  }
  const paint = resolveShowroomPaint(typeof raw.paintId === "string" ? raw.paintId : null);
  const body = raw.body;
  if (!body || typeof body !== "object") {
    return null;
  }
  return {
    model: raw.model,
    paintId: paint.id,
    camera: raw.camera as CarCameraPreset,
    venue: raw.venue,
    light: raw.light,
    leftDoorOpen: Boolean(raw.leftDoorOpen),
    rightDoorOpen: Boolean(raw.rightDoorOpen),
    trunkOpen: Boolean(raw.trunkOpen),
    sunroofOpen: Boolean(raw.sunroofOpen),
    lightsOn: Boolean(raw.lightsOn),
    hazardOn: Boolean(raw.hazardOn),
    engineOn: Boolean(raw.engineOn),
    braking: Boolean(raw.braking),
    autoTour: Boolean(raw.autoTour),
    reduceMotion: Boolean(raw.reduceMotion),
    wheels: raw.wheels !== false,
    speedKph: typeof raw.speedKph === "number" && Number.isFinite(raw.speedKph) ? raw.speedKph : 0,
    steeringAngle:
      typeof raw.steeringAngle === "number" && Number.isFinite(raw.steeringAngle)
        ? raw.steeringAngle
        : 0,
    body: {
      leftDoor: Boolean(body.leftDoor),
      rightDoor: Boolean(body.rightDoor),
      trunk: Boolean(body.trunk),
      sunroof: Boolean(body.sunroof),
    },
  };
}

function bodyForTarget(scene: ShowroomAiScene, model: CarCategoryKey, switching: boolean): ShowroomAiBodyAvailability {
  if (!switching) {
    return scene.body;
  }
  const category = CAR_CATEGORIES[model];
  const allowed = (key: CarBodyInteraction) => !isCarInteractionDisabled(category, key);
  return {
    leftDoor: allowed("leftDoor"),
    rightDoor: allowed("rightDoor"),
    trunk: allowed("trunk"),
    sunroof: allowed("sunroof"),
  };
}

function resolveModel(raw: string): CarCategoryKey | null {
  const token = compact(raw);
  for (const category of CAR_CATEGORY_OPTIONS) {
    if (compact(category.key) === token || compact(category.label) === token) {
      return category.key;
    }
  }
  return MODEL_ALIASES[token] ?? null;
}

function resolvePaintId(raw: string): string | null {
  const alias = PAINT_ALIASES[compact(raw)];
  if (alias) {
    return alias;
  }
  return parseShowroomPaintRequest(raw)?.id ?? null;
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1) {
    return true;
  }
  if (value === 0) {
    return false;
  }
  if (typeof value !== "string") {
    return null;
  }
  const token = compact(value);
  if (["true", "1", "on", "open", "yes", "开", "打开", "开启"].includes(token)) {
    return true;
  }
  if (["false", "0", "off", "close", "closed", "no", "关", "关闭"].includes(token)) {
    return false;
  }
  return null;
}

function parseControlInput(
  input: unknown,
): { ok: true; fields: ParsedControl } | { ok: false; reason: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "无法识别的展厅指令。" };
  }
  const raw = input as Record<string, unknown>;
  const fields: ParsedControl = {};
  const skipped: string[] = [];

  if (typeof raw.model === "string" && raw.model.trim()) {
    const model = resolveModel(raw.model);
    if (model) {
      fields.model = model;
    } else {
      skipped.push(`没有这个车型：${raw.model.trim()}`);
    }
  }
  const customColor = typeof raw.customColor === "string" ? raw.customColor.trim() : "";
  const catalogPaint = typeof raw.paint === "string" ? raw.paint.trim() : "";
  const customPaintId = customColor ? resolvePaintId(customColor) : null;
  const catalogPaintId = catalogPaint ? resolvePaintId(catalogPaint) : null;
  if (customPaintId) {
    fields.paintId = customPaintId;
  } else if (catalogPaintId) {
    fields.paintId = catalogPaintId;
  } else if (customColor || catalogPaint) {
    skipped.push(`无法识别这个车漆：${customColor || catalogPaint}`);
  }
  if (typeof raw.camera === "string" && raw.camera.trim()) {
    const camera = CAMERA_ALIASES[compact(raw.camera)];
    if (camera) {
      fields.camera = camera;
    } else {
      skipped.push(`没有这个视角：${raw.camera.trim()}`);
    }
  }
  if (typeof raw.venue === "string" && raw.venue.trim()) {
    const venue = VENUE_ALIASES[compact(raw.venue)];
    if (venue) {
      fields.venue = venue;
    } else {
      skipped.push(`没有这个场地：${raw.venue.trim()}`);
    }
  }
  if (typeof raw.light === "string" && raw.light.trim()) {
    const light = LIGHT_ALIASES[compact(raw.light)];
    if (light) {
      fields.light = light;
    } else {
      skipped.push(`没有这个光线：${raw.light.trim()}`);
    }
  }
  if (typeof raw.preset === "string" && raw.preset.trim()) {
    const preset = compact(raw.preset);
    if (preset === "welcome" || preset === "迎宾" || preset === "迎宾模式") {
      fields.preset = "welcome";
    } else if (preset === "drive" || preset === "试驾" || preset === "试驾模式") {
      fields.preset = "drive";
    } else if (preset === "reset" || preset === "重置" || preset === "恢复默认") {
      fields.preset = "reset";
    } else {
      skipped.push(`没有这个模式：${raw.preset.trim()}`);
    }
  }

  const boolFields = [
    ["leftDoor", "leftDoor"],
    ["rightDoor", "rightDoor"],
    ["trunk", "trunk"],
    ["sunroof", "sunroof"],
    ["lights", "lights"],
    ["hazard", "hazard"],
    ["engine", "engine"],
    ["braking", "braking"],
    ["autoTour", "autoTour"],
  ] as const;
  for (const [source, target] of boolFields) {
    if (raw[source] === undefined) {
      continue;
    }
    const parsed = parseBool(raw[source]);
    if (parsed === null) {
      skipped.push(`无法理解 ${source} 的取值。`);
    } else {
      fields[target] = parsed;
    }
  }

  if (skipped.length > 0 && Object.keys(fields).length === 0) {
    return { ok: false, reason: skipped.join(" ") };
  }
  return { ok: true, fields: { ...fields, ...noteSkipped(fields, skipped) } };
}

function noteSkipped(fields: ParsedControl, skipped: string[]): ParsedControl & { skippedNotes?: string[] } {
  if (skipped.length === 0) {
    return fields;
  }
  return Object.assign(fields, { skippedNotes: skipped });
}

function doorLabel(open: boolean): string {
  return open ? "打开" : "关闭";
}

function resetPatch(): ShowroomControlPatch {
  return {
    paintId: SHOWROOM_FACTORY_PAINT_ID,
    camera: "overview",
    leftDoorOpen: false,
    rightDoorOpen: false,
    trunkOpen: false,
    sunroofOpen: false,
    lightsOn: false,
    hazardOn: false,
    engineOn: false,
    braking: false,
    autoTour: false,
    speedKph: 28,
    steeringAngle: 0,
    seatDriverOffset: 0,
    seatPassengerOffset: 0,
  };
}

function presetPatch(preset: ShowroomPresetId, body: ShowroomAiBodyAvailability, skipped: string[]): ShowroomControlPatch {
  const source = SHOWROOM_PRESETS[preset];
  const patch: ShowroomControlPatch = {
    camera: source.cameraPreset,
    leftDoorOpen: source.leftDoorOpen,
    rightDoorOpen: source.rightDoorOpen,
    trunkOpen: source.trunkOpen,
    sunroofOpen: source.sunroofOpen,
    lightsOn: source.lightsOn,
    hazardOn: source.hazardOn,
    engineOn: source.engineOn,
    braking: source.braking,
    autoTour: source.autoTour,
    speedKph: source.speedKph,
    steeringAngle: source.steeringAngle,
  };
  if (source.venue) {
    patch.venue = source.venue;
  }
  const blocked: Array<
    [
      keyof ShowroomAiBodyAvailability,
      "leftDoorOpen" | "rightDoorOpen" | "trunkOpen" | "sunroofOpen",
      string,
    ]
  > = [
    ["leftDoor", "leftDoorOpen", "左门"],
    ["rightDoor", "rightDoorOpen", "右门"],
    ["trunk", "trunkOpen", "后备箱"],
    ["sunroof", "sunroofOpen", "天窗"],
  ];
  for (const [bodyKey, patchKey, label] of blocked) {
    if (patch[patchKey] === true && !body[bodyKey]) {
      patch[patchKey] = false;
      skipped.push(`${label}当前不可开，预设未打开它。`);
    }
  }
  return patch;
}

function explicitBody(
  open: boolean | undefined,
  current: boolean,
  available: boolean,
  label: string,
  patchKey: "leftDoorOpen" | "rightDoorOpen" | "trunkOpen" | "sunroofOpen",
  patch: ShowroomControlPatch,
  applied: string[],
  skipped: string[],
) {
  if (open === undefined) {
    return;
  }
  if (open && !available) {
    skipped.push(`${label}当前车型不可开。`);
    return;
  }
  if (open === current) {
    skipped.push(`${label}已经${doorLabel(open)}。`);
    return;
  }
  patch[patchKey] = open;
  applied.push(`${label}：${doorLabel(open)}`);
}

function presetSnapshot(scene: ShowroomAiScene): ShowroomPresetSnapshot {
  return {
    leftDoorOpen: scene.leftDoorOpen,
    rightDoorOpen: scene.rightDoorOpen,
    trunkOpen: scene.trunkOpen,
    lightsOn: scene.lightsOn,
    engineOn: scene.engineOn,
    steeringAngle: scene.steeringAngle,
    hazardOn: scene.hazardOn,
    sunroofOpen: scene.sunroofOpen,
    speedKph: scene.speedKph,
    braking: scene.braking,
    cameraPreset: scene.camera,
    autoTour: scene.autoTour,
    venue: scene.venue,
  };
}

function unavailablePresetKeys(body: ShowroomAiBodyAvailability): ShowroomPresetBodyKey[] {
  const ignore: ShowroomPresetBodyKey[] = [];
  if (!body.leftDoor) {
    ignore.push("leftDoorOpen");
  }
  if (!body.rightDoor) {
    ignore.push("rightDoorOpen");
  }
  if (!body.trunk) {
    ignore.push("trunkOpen");
  }
  if (!body.sunroof) {
    ignore.push("sunroofOpen");
  }
  return ignore;
}

export function planShowroomControl(input: unknown, scene: ShowroomAiScene): ShowroomControlResult {
  const parsed = parseControlInput(input);
  if (!parsed.ok) {
    return { applied: [], skipped: [parsed.reason], patch: {} };
  }
  const fields = parsed.fields as ParsedControl & { skippedNotes?: string[] };
  const skipped = [...(fields.skippedNotes ?? [])];
  const meaningful = Object.entries(fields).some(([key, value]) => key !== "skippedNotes" && value !== undefined);
  if (!meaningful) {
    return { applied: [], skipped: skipped.length > 0 ? skipped : ["没有可执行的操作。"], patch: {} };
  }

  const switching = Boolean(fields.model && fields.model !== scene.model);
  const body = bodyForTarget(scene, fields.model ?? scene.model, switching);
  const applied: string[] = [];
  let patch: ShowroomControlPatch = {};

  if (fields.preset === "reset") {
    patch = resetPatch();
    applied.push("恢复默认状态");
  } else if (fields.preset === "welcome" || fields.preset === "drive") {
    const presetLabel = fields.preset === "welcome" ? "迎宾模式" : "试驾模式";
    if (matchShowroomPreset(presetSnapshot(scene), unavailablePresetKeys(body)) === fields.preset) {
      skipped.push(`已经是${presetLabel}。`);
    } else {
      patch = presetPatch(fields.preset, body, skipped);
      applied.push(presetLabel);
    }
  }

  if (fields.model && fields.model !== scene.model) {
    patch.model = fields.model;
    applied.push(`车型：${CAR_CATEGORIES[fields.model].label}`);
  }
  if (fields.paintId) {
    const paint = resolveShowroomPaint(fields.paintId);
    if (fields.paintId === scene.paintId) {
      skipped.push(`车漆已经是${paint.label}。`);
    } else {
      patch.paintId = fields.paintId;
      applied.push(`车漆：${paint.label}`);
    }
  }
  if (fields.camera) {
    if (fields.camera === scene.camera) {
      skipped.push(`视角已经是${CAMERA_LABELS[fields.camera]}。`);
    } else {
      patch.camera = fields.camera;
      applied.push(`视角：${CAMERA_LABELS[fields.camera]}`);
    }
    if (fields.autoTour !== true && scene.autoTour) {
      patch.autoTour = false;
      applied.push("已停止环车巡检");
    }
  }
  if (fields.venue) {
    const label = SHOWROOM_VENUE_OPTIONS.find((item) => item.id === fields.venue)?.label ?? fields.venue;
    if (fields.venue === scene.venue) {
      skipped.push(`场地已经是${label}。`);
    } else {
      patch.venue = fields.venue;
      applied.push(`场地：${label}`);
    }
  }
  if (fields.light) {
    const label = SHOWROOM_LIGHTING_OPTIONS.find((item) => item.id === fields.light)?.label ?? fields.light;
    if (fields.light === scene.light) {
      skipped.push(`光线已经是${label}。`);
    } else {
      patch.lighting = fields.light;
      applied.push(`光线：${label}`);
    }
  }

  explicitBody(
    fields.leftDoor,
    scene.leftDoorOpen,
    body.leftDoor,
    "左门",
    "leftDoorOpen",
    patch,
    applied,
    skipped,
  );
  explicitBody(
    fields.rightDoor,
    scene.rightDoorOpen,
    body.rightDoor,
    "右门",
    "rightDoorOpen",
    patch,
    applied,
    skipped,
  );
  explicitBody(fields.trunk, scene.trunkOpen, body.trunk, "后备箱", "trunkOpen", patch, applied, skipped);
  explicitBody(
    fields.sunroof,
    scene.sunroofOpen,
    body.sunroof,
    "天窗",
    "sunroofOpen",
    patch,
    applied,
    skipped,
  );

  if (fields.lights !== undefined) {
    if (fields.lights === scene.lightsOn) {
      skipped.push(`车灯已经${fields.lights ? "开启" : "关闭"}。`);
    } else {
      patch.lightsOn = fields.lights;
      applied.push(`车灯：${fields.lights ? "开启" : "关闭"}`);
    }
  }
  if (fields.hazard !== undefined) {
    if (fields.hazard === scene.hazardOn) {
      skipped.push(`双闪已经${fields.hazard ? "开启" : "关闭"}。`);
    } else {
      patch.hazardOn = fields.hazard;
      applied.push(`双闪：${fields.hazard ? "开启" : "关闭"}`);
    }
  }
  if (fields.engine !== undefined) {
    if (fields.engine === scene.engineOn) {
      skipped.push(`发动机已经${fields.engine ? "启动" : "关闭"}。`);
    } else {
      patch.engineOn = fields.engine;
      applied.push(`发动机：${fields.engine ? "启动" : "关闭"}`);
    }
  }
  if (fields.braking !== undefined) {
    if (fields.braking === scene.braking) {
      skipped.push(`制动已经${fields.braking ? "踩下" : "松开"}。`);
    } else {
      patch.braking = fields.braking;
      applied.push(`制动：${fields.braking ? "踩下" : "松开"}`);
    }
  }
  if (fields.autoTour !== undefined) {
    if (fields.autoTour && scene.reduceMotion) {
      skipped.push("系统已开启减少动态效果，环车巡检保持关闭。");
      patch.autoTour = false;
    } else if (fields.autoTour === scene.autoTour) {
      skipped.push(`环车巡检已经${fields.autoTour ? "开启" : "关闭"}。`);
    } else {
      patch.autoTour = fields.autoTour;
      applied.push(`环车巡检：${fields.autoTour ? "开启" : "关闭"}`);
    }
  }

  return { applied, skipped, patch };
}

export function foldShowroomCommands(commands: unknown[], scene: ShowroomAiScene): ShowroomControlResult {
  const applied: string[] = [];
  const skipped: string[] = [];
  let patch: ShowroomControlPatch = {};
  let cursor = scene;
  if (commands.length === 0) {
    return { applied, skipped, patch };
  }
  for (const command of commands) {
    const result = planShowroomControl(command, cursor);
    applied.push(...result.applied);
    skipped.push(...result.skipped);
    patch = { ...patch, ...result.patch };
    cursor = sceneAfterPatch(cursor, result.patch);
  }
  return { applied, skipped, patch };
}

function sceneAfterPatch(scene: ShowroomAiScene, patch: ShowroomControlPatch): ShowroomAiScene {
  const model = patch.model ?? scene.model;
  return {
    ...scene,
    model,
    paintId: patch.paintId ?? scene.paintId,
    camera: patch.camera ?? scene.camera,
    venue: patch.venue ?? scene.venue,
    light: patch.lighting ?? scene.light,
    leftDoorOpen: patch.leftDoorOpen ?? scene.leftDoorOpen,
    rightDoorOpen: patch.rightDoorOpen ?? scene.rightDoorOpen,
    trunkOpen: patch.trunkOpen ?? scene.trunkOpen,
    sunroofOpen: patch.sunroofOpen ?? scene.sunroofOpen,
    lightsOn: patch.lightsOn ?? scene.lightsOn,
    hazardOn: patch.hazardOn ?? scene.hazardOn,
    engineOn: patch.engineOn ?? scene.engineOn,
    braking: patch.braking ?? scene.braking,
    autoTour: patch.autoTour ?? scene.autoTour,
    speedKph: patch.speedKph ?? scene.speedKph,
    steeringAngle: patch.steeringAngle ?? scene.steeringAngle,
    body: bodyForTarget(scene, model, model !== scene.model),
  };
}

function catalogLines(): string {
  const cars = CAR_CATEGORY_OPTIONS.map((item) => `${item.key}（${item.label}）`).join("、");
  const paints = SHOWROOM_PAINT_OPTIONS.map((item) => `${item.id}（${item.label}）`).join("、");
  const cameras = CAMERA_PRESETS.map((item) => `${item}（${CAMERA_LABELS[item]}）`).join("、");
  const venues = SHOWROOM_VENUE_OPTIONS.map((item) => `${item.id}（${item.label}）`).join("、");
  const lights = SHOWROOM_LIGHTING_OPTIONS.map((item) => `${item.id}（${item.label}）`).join("、");
  return `车型：${cars}。车漆：${paints}。视角：${cameras}。场地：${venues}。光线：${lights}。模式：welcome（迎宾）、drive（试驾）、reset（恢复默认）。`;
}

function capabilitySentence(scene: ShowroomAiScene): string {
  const label = CAR_CATEGORIES[scene.model].label;
  const limits = showroomCapabilityNote({
    modelLabel: label,
    leftDoor: scene.body.leftDoor,
    rightDoor: scene.body.rightDoor,
    trunk: scene.body.trunk,
    sunroof: scene.body.sunroof,
    wheels: scene.wheels !== false,
  });
  if (limits) {
    return `${limits}不要把这些部件设为打开，也不要改用别的车型或别的动作代替，直接说明做不到。`;
  }
  return `${label}的左门、右门、后备箱和天窗都可以单独打开。`;
}

export function buildShowroomAiSystemPrompt(scene: ShowroomAiScene): string {
  return [
    "你是浏览器 3D 看车展厅的控制器。",
    "用户要求改画面时，调用 control_showroom，只填写用户提到的字段，并用一句中文说明结果。",
    "画面已经处于目标状态时不要重复设置。色卡里有的车漆用 paint 填 id。色卡里没有的颜色用 customColor 填 #RRGGBB，不要改成最接近的色卡。",
    "只使用展厅里已有的车型、视角、场地、光线和部件。车漆可以是色卡或自定义色值。不要编造续航、价格或配置。",
    capabilitySentence(scene),
    "用户只是打招呼或询问与操作无关的问题时，不要改画面。",
    catalogLines(),
    `当前画面：${JSON.stringify(scene)}`,
  ].join("\n");
}

export function buildShowroomAiTools() {
  return [
    {
      type: "function" as const,
      function: {
        name: CONTROL_TOOL_NAME,
        description: "更新 3D 展厅中已经存在的车型、车漆、视角、场地、光线、部件和预设。",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            model: {
              type: "string",
              description: "车型 id 或中文名",
              enum: CAR_CATEGORY_OPTIONS.map((item) => item.key),
            },
            paint: {
              type: "string",
              description: "色卡车漆 id。只在用户要的颜色就在色卡里时填写。",
              enum: SHOWROOM_PAINT_OPTIONS.map((item) => item.id),
            },
            customColor: {
              type: "string",
              description:
                "色卡之外的车漆，用 #RRGGBB。例如银色 #C5C9CE、金色 #D4AF37。不要用它替换成别的色卡。",
            },
            camera: { type: "string", enum: CAMERA_PRESETS },
            venue: { type: "string", enum: ["studio", "hall", "road"] },
            light: { type: "string", enum: ["day", "night"] },
            preset: { type: "string", enum: ["welcome", "drive", "reset"] },
            leftDoor: { type: "boolean" },
            rightDoor: { type: "boolean" },
            trunk: { type: "boolean" },
            sunroof: { type: "boolean" },
            lights: { type: "boolean" },
            hazard: { type: "boolean" },
            engine: { type: "boolean" },
            braking: { type: "boolean" },
            autoTour: { type: "boolean" },
          },
        },
      },
    },
  ];
}

export type ShowroomAiHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export function sanitizeAiHistory(value: unknown): ShowroomAiHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: ShowroomAiHistoryItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const text = content.trim().slice(0, 800);
    if (!text) {
      continue;
    }
    items.push({ role, content: text });
  }
  return items.slice(-6);
}

export function sanitizeAiUserMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, 800);
  return text || null;
}

export function buildChatCompletionRequest(input: {
  model: string;
  message: string;
  history: ShowroomAiHistoryItem[];
  scene: ShowroomAiScene;
}) {
  return {
    model: input.model,
    temperature: 0.2,
    max_tokens: 400,
    messages: [
      { role: "system", content: buildShowroomAiSystemPrompt(input.scene) },
      ...input.history.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: input.message },
    ],
    tools: buildShowroomAiTools(),
    tool_choice: "auto",
  };
}

const CONTROL_KEYS = new Set([
  "model",
  "paint",
  "customColor",
  "camera",
  "venue",
  "light",
  "preset",
  "leftDoor",
  "rightDoor",
  "trunk",
  "sunroof",
  "lights",
  "hazard",
  "engine",
  "braking",
  "autoTour",
]);

function parseToolArguments(value: unknown): unknown | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") {
    return value;
  }
  return null;
}

function looksLikeControl(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).some((key) => CONTROL_KEYS.has(key));
}

export type ShowroomAiTurn = {
  reply: string;
  commands: unknown[];
};

export function readChatCompletion(payload: unknown): ShowroomAiTurn {
  if (!payload || typeof payload !== "object") {
    throw new Error("模型返回了无法解析的内容。");
  }
  const record = payload as {
    error?: { message?: string } | string;
    choices?: Array<{
      message?: {
        content?: unknown;
        tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
      };
    }>;
  };
  if (typeof record.error === "string" && record.error.trim()) {
    throw new Error(record.error.trim().slice(0, 300));
  }
  if (record.error && typeof record.error === "object" && record.error.message) {
    throw new Error(record.error.message.trim().slice(0, 300));
  }
  const message = record.choices?.[0]?.message;
  if (!message) {
    throw new Error("模型没有返回结果。");
  }
  const commands: unknown[] = [];
  for (const call of message.tool_calls ?? []) {
    if (call.function?.name !== CONTROL_TOOL_NAME) {
      continue;
    }
    const args = parseToolArguments(call.function.arguments);
    if (args) {
      commands.push(args);
    }
  }
  const content = readMessageText(message.content);
  const fenced = unwrapJsonFence(content);
  if (commands.length === 0 && looksLikeControl(parseToolArguments(fenced))) {
    const parsed = parseToolArguments(fenced);
    return { reply: "", commands: parsed ? [parsed] : [] };
  }
  return { reply: content, commands };
}

function readMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("")
    .trim();
}

function unwrapJsonFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || text;
}
