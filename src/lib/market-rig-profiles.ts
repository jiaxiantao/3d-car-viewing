/**
 * Optional name-pattern overrides per market GLB.
 * Add entries when auto-discovery mislabels parts; patterns match mesh node names (case-insensitive).
 */
export type MarketRigProfile = {
  id: string;
  urlPattern: RegExp;
  leftDoor?: RegExp[];
  rightDoor?: RegExp[];
  /** Subset of door meshes used only to place the hinge (outer shell). */
  leftDoorHinge?: RegExp[];
  rightDoorHinge?: RegExp[];
  /**
   * One buffer that holds several doors' trim. Triangles inside each front-door
   * volume are split off and parented to that hinge; the rest stays on the body.
   */
  spanningDoorTrim?: RegExp[];
  trunk?: RegExp[];
  /** Outer shell used only to place the liftgate axis (roof seam). */
  trunkHinge?: RegExp[];
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
  urlPattern: /sedan-mainstream/i,
  // LightA* = headlamp lens; LightEmissiveA spans the body but carries rear emissive (not head).
  headLightMaterial: [/LightA(?:_Material\d*)?/i, /LightA(?!.*Emissive)/i],
  tailLightMaterial: [/red_glass/i, /LightEmissiveA/i],
  hazardLightMaterial: [/red_glass/i, /LightEmissiveA/i],
  paintMaterial: [/Paint_Material/i],
  // Four separable wheel group nodes ("3DWheel Front L/R", "3DWheel Rear L/R")
  // — each is spun in place about its own axle when the engine starts.
  wheel: [/3DWheel (Front|Rear) [LR]/i],
};

/**
 * Audi Q3 (`suv-mainstream.glb`) — door lists are hand-authored for this asset only.
 * Outer shell defines the hinge; remaining ids are every front-door mesh in that volume.
 * Showroom left is +Z (driver side when facing -X). These ids were authored on the
 * file's opposite side, so the lists are swapped to match that convention.
 */
const suvQ3Profile: MarketRigProfile = {
  id: "suv-q3",
  urlPattern: /suv-mainstream/i,
  leftDoorHinge: [/polySurface2889_Mesh_140/i, /polySurface5632_Mesh_162/i],
  rightDoorHinge: [/polySurface2908_Mesh_142/i, /polySurface5638_Mesh_165/i],
  leftDoor: [
    /polySurface2889_Mesh_140/i,
    /polySurface5632_Mesh_162/i,
    /Door_INT157_Mesh_087/i,
    /polySurface3102_Mesh_155/i,
    /Door_INT152_Mesh_084/i,
    /polySurface3011_Mesh_148/i,
    /polySurface2997_Mesh_144/i,
    /Q3_Exteroir332_Mesh_171/i,
    /polySurface3172_Mesh_158/i,
    /polySurface3049_Mesh_152/i,
    /polySurface3048_Mesh_151/i,
    /polySurface5643_Mesh_168/i,
    /Door_INT30_Mesh_096/i,
    /Door_INT136_Mesh_080/i,
    /Door_INT116_Mesh_074/i,
    /Door_INT113_Mesh_073/i,
    /Door_INT25_Mesh_094/i,
    /Door_INT26_Mesh_095/i,
    /Door_INT132_Mesh_079/i,
    /Door_INT9_Mesh_123/i,
    /Door_INT23_Mesh_093/i,
  ],
  // Beltline plastic (and its chrome lip) is one mesh for all four doors.
  spanningDoorTrim: [
    /Q3_Technology7_Mesh_232/i,
    /Primeam_Q3_10_Mesh_217/i,
    /Q3_Technology14_Mesh_230/i,
  ],
  rightDoor: [
    /polySurface2908_Mesh_142/i,
    /polySurface5638_Mesh_165/i,
    /polySurface3103_Mesh_156/i,
    /polySurface3104_Mesh_157/i,
    /polySurface3173_Mesh_159/i,
    /polySurface5628_Mesh_161/i,
    /polySurface3001_Mesh_146/i,
    /Q3_Exteroir331_Mesh_170/i,
    /polySurface3095_Mesh_153/i,
    /polySurface3097_Mesh_154/i,
    /polySurface17_Mesh_139/i,
    /polySurface5642_Mesh_167/i,
    /Door_INT146_Mesh_081/i,
    /Door_INT75_Mesh_116/i,
    /Door_INT1_Mesh_063/i,
    /Door_INT76_Mesh_117/i,
    /Door_INT89_Mesh_122/i,
    /Door_INT92_Mesh_126/i,
    /Door_INT21_Mesh_092/i,
    /Door_INT41_Mesh_102/i,
    /Door_INT45_Mesh_104/i,
    /Door_INT124_Mesh_077/i,
    /Door_INT43_Mesh_103/i,
  ],
  // Liftgate is one piece: painted shell, rear glass, badge, and inner trim.
  // The front-screen defroster shares the Boot_ext26 prefix (`Thrmoline1`) and stays on the body.
  trunkHinge: [/Boot_ext2_Mesh_049_Carpaint/i],
  trunk: [
    /Boot_ext2_Mesh_049_Carpaint/i,
    /Boot_ext3_Mesh_050_Windshild/i,
    /Boot_ext5_Mesh_051/i,
    /Boot_ext13_Mesh_045/i,
    /Boot_ext14_Mesh_046_Nameboard/i,
    /Boot_ext15_Mesh_047/i,
    /Boot_ext17_Mesh_048/i,
    /Boot_ext26_Mesh_192_Thrmoline_phong2mat/i,
    /Boot_INT10_Mesh_052/i,
    /Boot_INT30_Mesh_053/i,
    /Boot_INT40_Mesh_054/i,
    /Boot_INT41_Mesh_055/i,
    /Boot_INT52_Mesh_056/i,
    /Boot_INT53_Mesh_057/i,
    /Boot_INT54_Mesh_058/i,
    /Boot_INT55_Mesh_059/i,
    /Boot_INT57_Mesh_061/i,
    /Boot_INT58_Mesh_062/i,
    /boot_clamp1_Mesh_043/i,
    /boot_clamp12_Mesh_044/i,
    // Inner blades on the hatch. Quarter lamps (polySurface31*) stay on the body.
    /Door_Tail_lamp21_Mesh_131/i,
    /Door_Tail_lamp22_Mesh_132/i,
    /Door_Tail_lamp23_Mesh_133/i,
    /Door_Tail_lamp26_Mesh_134/i,
    /Door_Tail_lamp3_Mesh_135/i,
    /Door_Tail_lamp36_Mesh_136/i,
    /Door_Tail_lamp8_Mesh_137/i,
    /Door_Tail_lamp11_Mesh_130/i,
  ],
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
  // Tyre / rim / disc buffers each contain all four corners. They are split per
  // wheel at rig time. Brake calipers (`Alloy_Break`) stay fixed on the body.
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

/** Fingerprint of profile door/trunk lists — used to invalidate warm prepared GLB packages. */
export function marketRigProfilesFingerprint(): string {
  return MARKET_RIG_PROFILES.map((profile) => {
    const patterns = [
      ...(profile.leftDoor ?? []),
      ...(profile.rightDoor ?? []),
      ...(profile.leftDoorHinge ?? []),
      ...(profile.rightDoorHinge ?? []),
      ...(profile.trunk ?? []),
      ...(profile.trunkHinge ?? []),
      ...(profile.spanningDoorTrim ?? []),
      ...(profile.sunroof ?? []),
    ]
      .map((pattern) => pattern.source)
      .join("|");
    return `${profile.id}:${profile.bakedWheels ? 1 : 0}:${patterns.length}:${patterns}`;
  }).join(";");
}

export function resolveMarketRigProfile(modelUrl?: string): MarketRigProfile | null {
  if (!modelUrl) {
    return null;
  }
  return MARKET_RIG_PROFILES.find((profile) => profile.urlPattern.test(modelUrl)) ?? null;
}
