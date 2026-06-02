/**
 * Optional name-pattern overrides per market GLB.
 * Add entries when auto-discovery mislabels parts; patterns match mesh node names (case-insensitive).
 */
export type MarketRigProfile = {
  id: string;
  urlPattern: RegExp;
  leftDoor?: RegExp[];
  rightDoor?: RegExp[];
  trunk?: RegExp[];
  headLight?: RegExp[];
  /** Match glTF material names when mesh nodes are generic (`Object_*`). */
  headLightMaterial?: RegExp[];
  tailLight?: RegExp[];
  tailLightMaterial?: RegExp[];
  hazardLight?: RegExp[];
  hazardLightMaterial?: RegExp[];
  sunroof?: RegExp[];
  wheel?: RegExp[];
  paintMaterial?: RegExp[];
  /** Road wheels are painted into the body shell; do not hide tyre meshes or add synthetic rollers. */
  bakedWheels?: boolean;
};

/** BMW M2 Coupe (Forza-style export; lights keyed by material name). */
const bmwM2Profile: MarketRigProfile = {
  id: "bmw-m2",
  urlPattern: /2023_bmw_m2_coupe/i,
  // LightA = headlamp lens; LightEmissiveA spans the body but carries rear emissive (not head).
  headLightMaterial: [/LightA_Material/i],
  tailLightMaterial: [/red_glass/i, /LightEmissiveA/i],
  hazardLightMaterial: [/red_glass/i, /LightEmissiveA/i],
  paintMaterial: [/Paint_Material/i],
  // Four separable wheel group nodes ("3DWheel Front L/R", "3DWheel Rear L/R")
  // — each is spun in place about its own axle when the engine starts.
  wheel: [/3DWheel (Front|Rear) [LR]/i],
};

/** Audi Q3–style Sketchfab SUV (`suv-mainstream.glb`). */
const suvQ3Profile: MarketRigProfile = {
  id: "suv-q3",
  urlPattern: /suv-mainstream/i,
  leftDoor: [
    /polySurface5638/i,
    /polySurface3173_Mesh_159_Door_Soft_Black_Plastic_Q3/i,
    /polySurface3103_Mesh_156_Door_Rubber/i,
    /polySurface3104_Mesh_157_Door_Black_Plastic_Noise/i,
  ],
  rightDoor: [
    /polySurface5634/i,
    /polySurface5632/i,
    /polySurface3102_Mesh_155_Door_Black_Plastic_Noise/i,
    /polySurface3173_Mesh_159_Door_Soft_Black_Plastic_Q4/i,
  ],
  trunk: [/Boot_ext2_Mesh_049_Carpaint/i, /Boot_ext17/i, /Boot_ext13_Mesh_045_Chrome/i, /Boot_ext5/i],
  headLight: [
    /\bHL\d_Mesh/i,
    /Hl_Projection_lamp/i,
    /Hl_inner_glass/i,
    /HL_Chrome/i,
    /HL7_Mesh.*Hl_Cover/i,
  ],
  tailLight: [/Tail_upper_Red/i, /Tail_inner_Red/i, /Tail_inner_White/i, /Tail_Cover_White/i],
  hazardLight: [/Tail_upper_Red/i, /Tail_inner_Red/i, /Emiss/i],
  sunroof: [/Q3_Exteroir337_Mesh_179_Roof_glass/i],
  bakedWheels: true,
};

/**
 * Brabus G900: road wheels are baked into the body; only a rear spare is a separate rig.
 * Do not list `wheel` patterns here — global discovery excludes spare / tailgate mounts.
 */
const offroadBrabusProfile: MarketRigProfile = {
  id: "offroad-brabus",
  urlPattern: /offroad-mainstream/i,
  // Outer rings: lights_lod0* / lamp_alpha; inner projector lenses: nlightsf* (not roof `lightled`).
  headLight: [/lights_lod0/i, /lamp_alpha/i, /\/\d+_lights_0/i, /nlightsf/i],
  tailLight: [/red_b/i, /g500_brake/i],
  hazardLight: [/red_b/i, /g500_brake/i],
  bakedWheels: true,
};

export const MARKET_RIG_PROFILES: MarketRigProfile[] = [
  bmwM2Profile,
  suvQ3Profile,
  offroadBrabusProfile,
];

export function resolveMarketRigProfile(modelUrl?: string): MarketRigProfile | null {
  if (!modelUrl) {
    return null;
  }
  return MARKET_RIG_PROFILES.find((profile) => profile.urlPattern.test(modelUrl)) ?? null;
}
