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
   * Signed offset of the door axis from the outer shell's leading face.
   * Positive sits ahead of that face (showroom -X). Negative sits behind it,
   * toward the rear of the car. Omit to use 1% of the door length ahead of the face.
   */
  doorHingeLead?: number;
  /**
   * Extra outward shift of the door axis, away from the cabin.
   * The default axis is inset from the outer paint. A large enough value
   * places the axis outside that skin so the open door leaves the body.
   */
  doorHingeOutset?: number;
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
  /**
   * Rearward travel as a fraction of the glass fore-aft span.
   * Omit to use the default (0.55). Xiaomi panoramic roofs use half of that.
   */
  sunroofSlideFraction?: number;
  /** Rear doors that swing with the same left/right toggles as the front doors. */
  leftRearDoor?: RegExp[];
  rightRearDoor?: RegExp[];
  leftRearDoorHinge?: RegExp[];
  rightRearDoorHinge?: RegExp[];
  /** Side-hinged tailgate (G-Class / Wrangler) instead of a roof-hinged liftgate. */
  barnTailgate?: boolean;
  /** Which jamb the barn tailgate swings from. Defaults to the vehicle-left edge. */
  barnTailgateSide?: "left" | "right";
  /**
   * Which face of the tailgate the axis sits on.
   * `outer` is the rear skin. `body` is the shut line against the cabin,
   * for a hinge box that also contains the spare.
   */
  barnTailgateFace?: "outer" | "body";
  /** Meters to shift the barn-door axis inboard from the outer skin, toward the cabin. */
  barnTailgateInset?: number;
  /**
   * One original node that already holds several disconnected islands
   * (a sill net in each door opening, plus pieces that stay on the body).
   * Each whole island is parented to the door that contains it.
   */
  doorIslandNodes?: RegExp[];
  /** Steering rim used for the cockpit camera when the node is not named "steering wheel". */
  steeringWheel?: RegExp[];
  wheel?: RegExp[];
  /**
   * Road-wheel meshes that may pack several corners into one buffer (split, then spun).
   * Unlike `wheel`, these are not already one node per corner.
   */
  wheelPart?: RegExp[];
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
  // Rim groups ("3DWheel Front L/R", "3DWheel Rear L/R") roll about their axles.
  // GLTFLoader sanitizes node names (spaces become "_"), so the pattern must
  // tolerate both separators. Only the tyre annulus is reprojected onto the face
  // atlas; spoke/hub UVs stay so the metal rim keeps its shape.
  // Sibling `Calliper *` nodes stay on the knuckle.
  wheel: [/3DWheel[\s_](Front|Rear)[\s_][LR]/i],
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
  // Shared across every door: beltline covers, the thin black sill line,
  // window-switch icons, the aluminum door card, and the three mirror studs
  // (`Thrmoline1` — one buffer, a cluster on each front door).
  spanningDoorTrim: [
    /Q3_Technology7_Mesh_232/i,
    /Primeam_Q3_10_Mesh_217/i,
    /Q3_Technology14_Mesh_230/i,
    /phong1SG1/i,
    /Dooricon_Mesh_138/i,
    /Interior86_Mesh_210/i,
    /Boot_ext26_Mesh_192_Thrmoline1/i,
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
  // `Thrmoline` (no 1) is the hatch heater. `Thrmoline1` is the mirror studs and is split onto the front doors.
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
 * Brabus G900: each road wheel is split across shared buffers (one side's axles,
 * or all four corners). Those parts are cut per corner and spun in place.
 * The tailgate spare stays on the body — do not use `wheel` (that treats each
 * match as an already-separated corner, e.g. BMW `3DWheel`).
 */
const offroadBrabusProfile: MarketRigProfile = {
  id: "offroad-brabus",
  urlPattern: /offroad-mainstream/i,
  // Door and tailgate islands are cut by position in `splitOffroadCabinPanels`.
  // The axis sits just behind the shut line, slightly outside the outer skin.
  doorHingeLead: -0.02,
  doorHingeOutset: 0.02,
  // Round lamps live in `lights_lod0*` (front islands only). Inner projectors are
  // `nlightsf20`. Skip body-sized `nlightsf_0` and the bumper `lamp_alpha` bar.
  headLight: [/lights_lod0/i, /nlightsf\d/i],
  tailLight: [/red_b/i, /g500_brake/i],
  hazardLight: [/red_b/i, /g500_brake/i],
  wheelPart: [
    /left_wheel/i,
    /right_wheel/i,
    /michelin/i,
    /rimdetail/i,
    /diamondcutrim/i,
    /wheel_track/i,
    /_gt_34_/i,
    /_gt_35_/i,
    /smallspecmap/i,
  ],
};

/**
 * Xiaomi SU7 Max: body kits are fused (no separable doors, hatch, or sunroof).
 * Headlamp and tail-lamp lenses are the FrontKit / RearKit light materials.
 * Each corner is a `3DWheel` group; brake calipers are children and stay fixed.
 */
const xiaomiSu7MaxProfile: MarketRigProfile = {
  id: "xiaomi-su7-max",
  urlPattern: /2024_xiaomi_su7_max/i,
  headLight: [/SM_FrontKit.*Light_glass/i, /SM_FrontKit.*MAT_Lights/i],
  tailLight: [/SM_RearKit.*Light_glass/i, /SM_RearKit.*MAT_Lights/i],
  hazardLight: [/SM_RearKit.*Light_glass/i, /SM_RearKit.*MAT_Lights/i],
  paintMaterial: [/^untitledMAT_CarPaint_SU7_Base1$/i],
  wheel: [/3DWheel[\s_](Front|Rear)[\s_][LR]/i],
};

/**
 * Xiaomi SU7 Ultra: front doors, hatch, panoramic roof, and lamps are separate meshes.
 * Showroom left is +Z. `trunk_*` names also appear on the front bumper, so only the
 * rear hatch ids are listed. The body-sized `carLight_bulb` buffers are not lamps.
 */
const xiaomiSu7UltraProfile: MarketRigProfile = {
  id: "xiaomi-su7-ultra",
  urlPattern: /2025_xiaomi_su7_ultra/i,
  // Axis sits on the shut line, only slightly outside the skin, so the open
  // door clears the fender without a wide gap.
  doorHingeLead: 0,
  doorHingeOutset: 0.06,
  leftDoorHinge: [/carPaint_4_carPaint_4/i],
  rightDoorHinge: [/carPaint_6_carPaint_6/i],
  leftDoor: [
    /carPaint_4_carPaint_4/i,
    /carInternal_DoorFront_carInternal_DoorFront/i,
    /carGlass_front_2_Side_2_carGlass_front_2_Side_2/i,
    /carWindowTrim_1_carWindowTrim_1/i,
    /carMirror_top_2_carMirror_top_2/i,
    /carMirror_bottom_2_carMirror_bottom_2/i,
    /carRearviewMirror_2_/i,
    /carPlastic_BrilliantBlack_3_2_/i,
  ],
  rightDoor: [
    /carPaint_6_carPaint_6/i,
    /carInternal_DoorFront_1__/i,
    /carGlass_front_2_Side_1_carGlass_front_2_Side_1/i,
    /carWindowTrim_3_carWindowTrim_3/i,
    /carMirror_top_1_carMirror_top_1/i,
    /carMirror_bottom_1_carMirror_bottom_1/i,
    /carRearviewMirror_1_/i,
    /carPlastic_BrilliantBlack_3_1_/i,
  ],
  trunkHinge: [/carPaint_8_carPaint_8/i],
  trunk: [
    /carPaint_8_carPaint_8/i,
    /carPaint_2_carPaint_2/i,
    /carPlastic_MatteBlack_trunk_7_/i,
    // Rear glass stays. The center bar's own rim is the seam, so the whole
    // cover rises; the two corner lenses stay on the fascia. `trunk_9` is the front bumper.
    /carLightGlass_Back_2_/i,
    /carLightPlastic_BrilliantBlack_2_/i,
    /carLight_bulb_2_/i,
    /carSpoilers_/i,
    /empennage_/i,
    /carTailBracket_/i,
    /carXiaoMi_1_/i,
    /carPlastic_BrilliantBlack_4_2_/i,
  ],
  sunroof: [/carRoof_su7Pro/i],
  sunroofSlideFraction: 0.275,
  headLight: [
    /carLightGlass_Front/i,
    /carLightPlastic_MatteBlack/i,
    /carLightPlastic_Chroming/i,
  ],
  tailLight: [
    /carLightGlass_Back/i,
    /carLightPlastic_BrilliantBlack_2_carLightPlastic/i,
    /carLight_bulb_2_/i,
  ],
  hazardLight: [
    /carLightGlass_Back/i,
    /carLightPlastic_BrilliantBlack_2_carLightPlastic/i,
    /carLight_bulb_2_/i,
  ],
  paintMaterial: [/^CarPaint$/i],
};

/**
 * Xiaomi YU7: same showroom interactions as SU7 Ultra. Rear-door shells
 * (`carPaint_9` / `carPaint_13`) stay on the body — the tray only swings front doors.
 */
const xiaomiYu7Profile: MarketRigProfile = {
  id: "xiaomi-yu7",
  urlPattern: /2025_xiaomi_yu7/i,
  // Axis sits on the shut line, only slightly outside the skin, so the open
  // door clears the fender without a wide gap.
  doorHingeLead: 0,
  doorHingeOutset: 0.06,
  leftDoorHinge: [/carPaint_4_carPaint_4/i],
  rightDoorHinge: [/carPaint_4_1__/i],
  leftDoor: [
    /carPaint_4_carPaint_4/i,
    /carInternal_DoorFront_carInternal_DoorFront/i,
    /carGlass_front_2_Side_2_carGlass_front_2_Side_2/i,
    /carWindowTrim_1_carWindowTrim_1/i,
    /carMirror_top_2_carMirror_top_2/i,
    /carMirror_bottom_2_carMirror_bottom_2/i,
    /carRearviewMirror_2_/i,
    /carPlastic_BrilliantBlack_3_2_/i,
    /carPlastic_BrilliantBlack_1_6_1__/i,
  ],
  rightDoor: [
    /carPaint_4_1__/i,
    /carInternal_DoorFront_1__/i,
    /carGlass_front_2_Side_2_1__/i,
    /carWindowTrim_1_1__/i,
    /carMirror_top_2_1__/i,
    /carMirror_bottom_2_1__/i,
    /carRearviewMirror_3_/i,
    /carPlastic_BrilliantBlack_3_3_/i,
    /carPlastic_BrilliantBlack_1_6_2__/i,
  ],
  trunkHinge: [/carPaint_8_carPaint_8/i],
  trunk: [
    /carPaint_8_carPaint_8/i,
    /carInternal_TrunkExternal/i,
    /carDuckTail_/i,
    // The rear glass is part of this hatch. The center tail bar rises with it;
    // the corner lenses (`Back_1`) stay on the fascia.
    /carGlass_back_1_carGlass_back_1/i,
    /carHeaterStrip_/i,
    /carLightGlass_Back_2_/i,
    /carLightPlastic_BrilliantBlack_2_carLightPlastic/i,
    /carLight_bulb_2_/i,
    /carXiaoMi_1_/i,
    /carXiaoMi_3_/i,
  ],
  sunroof: [/carRoof_yu7_/i],
  sunroofSlideFraction: 0.275,
  headLight: [
    /carLightGlass_Front/i,
    /carLight_bulb_1_/i,
    /carLightPlastic_BrilliantBlack_3_/i,
    /carLightPlastic_MatteBlack_carLightPlastic_MatteBlack/i,
  ],
  tailLight: [
    /carLightGlass_Back/i,
    /carLightPlastic_BrilliantBlack_2_carLightPlastic/i,
    /carLight_bulb_2_/i,
    /carLight_backbulb/i,
  ],
  hazardLight: [
    /carLightGlass_Back/i,
    /carLightPlastic_BrilliantBlack_2_carLightPlastic/i,
    /carLight_bulb_2_/i,
    /carLight_backbulb/i,
  ],
  paintMaterial: [/^CarPaint$/i],
};

/**
 * Mercedes-AMG G 63 (Forza-style export). Front doors, round-lamp bar, and
 * `3DWheel` corners are separate. The rear cabin and tailgate are fused into
 * `RearKit`, so there is no rear-door or barn-door swing. No sunroof.
 * Showroom left is +Z; `ANC_Door_L` is that side.
 */
const mercedesG63Profile: MarketRigProfile = {
  id: "mercedes-g63",
  urlPattern: /mercedes-benz_g-class_amg_g_63/i,
  doorHingeLead: 0,
  doorHingeOutset: 0.03,
  leftDoorHinge: [/ANC_Door_L_02_/i],
  rightDoorHinge: [/ANC_Door_R_03_/i],
  // Extra pieces are already separate meshes sitting in the front door.
  // They are not named ANC_Door, so the hinge never picked them up.
  leftDoor: [/ANC_Door_L_/i, /MD_Body_15_/i, /MD_Body_21_/i, /MD_Body_22_/i, /SM_Base_/i],
  rightDoor: [/ANC_Door_R_/i, /MD_Body_14_/i, /MD_Body_24_/i, /MD_Body_25_/i, /MD_Body_26_/i],
  headLight: [/SM_FrontKit_.*Lights/i],
  tailLight: [/SM_RearKit_.*Lights/i, /SM_Interior_.*Lights/i],
  hazardLight: [/SM_RearKit_.*Lights/i, /SM_Interior_.*Lights/i],
  paintMaterial: [/MMAT_CarPaint_010/i],
  wheel: [/3DWheel[\s_](Front|Rear)[\s_][LR]/i],
};

/**
 * Jeep Wrangler Rubicon 392. Four doors are separate groups. The tailgate
 * (spare included) swings sideways. Wheel groups are named with front/back
 * swapped relative to the showroom axis, so each corner is an exact group name
 * and front/rear is decided from position. The hardtop is not a sliding roof.
 * Showroom left is +Z.
 */
const jeepWranglerProfile: MarketRigProfile = {
  id: "jeep-wrangler",
  urlPattern: /jeep_wrangler_rubicon/i,
  doorHingeLead: 0,
  // Keep the axis on the door jamb, against the body.
  doorHingeOutset: 0,
  leftDoorHinge: [/Door_FL_101_MI_Glass_014/i],
  rightDoorHinge: [/Door_FR_101_MI_Glass_014/i],
  leftDoor: [/Door_FL_/i, /SideMirror_L_/i],
  rightDoor: [/Door_FR_/i, /SideMirror_R_/i],
  // `Jmalla` on Glass_In_021 is the diamond sill net. It is one node of
  // disconnected islands: one in each door opening, plus a center piece.
  doorIslandNodes: [/Glass_In_021/i],
  leftRearDoorHinge: [/Door_BL_101_MI_Glass_In11/i],
  rightRearDoorHinge: [/JAni_Door_BR11/i],
  leftRearDoor: [/Door_BL_/i],
  rightRearDoor: [/Door_BR_/i, /JAni_Door_BR/i],
  barnTailgate: true,
  // Hinge pin Ani_Trunk_Lifting_BR is on the right jamb, at the shut line.
  // The tailgate shell box also reaches the spare, so the rear face is too far out.
  barnTailgateSide: "right",
  barnTailgateFace: "body",
  // Outer skin sits 15cm right of the hinge pin `Ani_Trunk_Lifting_BR`.
  barnTailgateInset: 0.15,
  trunkHinge: [
    /SK_Trunk_101_MI_Light11/i,
    /SK_Trunk_101_MI_Light2_/i,
    /SK_Trunk_101_MI_Light4_/i,
    /SK_Trunk_101_MI_Light7_/i,
    /SK_Trunk_101_MI_Light8_/i,
  ],
  trunk: [/SK_Trunk_101/i],
  // Never matches, so the generic roof+glass guess does not slide the hardtop.
  sunroof: [/(?!)/],
  headLight: [/SM_Light_F_101(?!.*orange_glass)/i],
  tailLight: [/SM_Light_B_101/i, /Bumper_B_101.*red_glass/i],
  hazardLight: [/SM_Light_B_101.*red_glass/i, /Bumper_B_101.*red_glass/i, /orange_glass/i],
  paintMaterial: [/^JMI_1355060001_004$/i],
  steeringWheel: [/\/SW\//],
  wheel: [/^JAni_Wheel_BL69$/i, /^JAni_Disc_Scale_BR7$/i, /^JAni_Disc_Scale_FL7$/i, /^JAni_Wheel_FR69$/i],
};

export const MARKET_RIG_PROFILES: MarketRigProfile[] = [
  bmwM2Profile,
  suvQ3Profile,
  offroadBrabusProfile,
  xiaomiSu7MaxProfile,
  xiaomiSu7UltraProfile,
  xiaomiYu7Profile,
  mercedesG63Profile,
  jeepWranglerProfile,
];

/** Fingerprint of profile door/trunk lists — used to invalidate warm prepared GLB packages. */
export function marketRigProfilesFingerprint(): string {
  return MARKET_RIG_PROFILES.map((profile) => {
    const patterns = [
      ...(profile.leftDoor ?? []),
      ...(profile.rightDoor ?? []),
      ...(profile.leftDoorHinge ?? []),
      ...(profile.rightDoorHinge ?? []),
      ...(profile.leftRearDoor ?? []),
      ...(profile.rightRearDoor ?? []),
      ...(profile.leftRearDoorHinge ?? []),
      ...(profile.rightRearDoorHinge ?? []),
      ...(profile.trunk ?? []),
      ...(profile.trunkHinge ?? []),
      ...(profile.spanningDoorTrim ?? []),
      ...(profile.doorIslandNodes ?? []),
      ...(profile.sunroof ?? []),
      ...(profile.wheel ?? []),
      ...(profile.wheelPart ?? []),
      ...(profile.steeringWheel ?? []),
    ]
      .map((pattern) => pattern.source)
      .join("|");
    return `${profile.id}:${profile.bakedWheels ? 1 : 0}:${profile.barnTailgate ? 1 : 0}:${profile.barnTailgateSide ?? ""}:${profile.barnTailgateFace ?? ""}:${profile.barnTailgateInset ?? ""}:${profile.sunroofSlideFraction ?? ""}:${profile.doorHingeLead ?? ""}:${profile.doorHingeOutset ?? ""}:${patterns.length}:${patterns}`;
  }).join(";");
}

export function resolveMarketRigProfile(modelUrl?: string): MarketRigProfile | null {
  if (!modelUrl) {
    return null;
  }
  return MARKET_RIG_PROFILES.find((profile) => profile.urlPattern.test(modelUrl)) ?? null;
}
