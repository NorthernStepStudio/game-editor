/**
 * Yun environment contract derived from the production court.gd gameplay geometry.
 *
 * Important: Blender environment work is visual dressing. The Godot YunCourt
 * remains authoritative for playable bounds, chalk tubes, YUN/TURN rings,
 * spawn math, tagging lanes, and movement rules.
 */

export const YUN_ENVIRONMENT_REVISION = "1.0.0" as const;

export const YUN_COURT_CONTRACT = {
  planarToWorld: 0.025,
  courtLeft: 160,
  courtRight: 992,
  courtCenterX: 576,
  headY: 70,
  farY: 560,
  tubeHalf: 34,
  spineHalf: 32,
  tubeY: [190, 320, 450] as const,
  gameplay: {
    preserveGodotCourtGeometry: true,
    preserveGodotCollisionOwnership: true,
    preserveSpawnMath: true,
    preserveTagLaneMath: true,
    preserveYunAndTurnMarkers: true,
  },
} as const;

export const YUN_COURT_WORLD_METRICS = {
  playableWidth: (YUN_COURT_CONTRACT.courtRight - YUN_COURT_CONTRACT.courtLeft) *
    YUN_COURT_CONTRACT.planarToWorld,
  headToTurnLength: (YUN_COURT_CONTRACT.farY - YUN_COURT_CONTRACT.headY) *
    YUN_COURT_CONTRACT.planarToWorld,
  courtCenterX: YUN_COURT_CONTRACT.courtCenterX * YUN_COURT_CONTRACT.planarToWorld,
  headZ: YUN_COURT_CONTRACT.headY * YUN_COURT_CONTRACT.planarToWorld,
  farZ: YUN_COURT_CONTRACT.farY * YUN_COURT_CONTRACT.planarToWorld,
  tubeZ: YUN_COURT_CONTRACT.tubeY.map(
    (value) => value * YUN_COURT_CONTRACT.planarToWorld,
  ) as readonly number[],
} as const;

/** Conservative per-kind visual/collision footprint in world meters [X, depth]. */
export const YUN_ENVIRONMENT_PROP_FOOTPRINTS = {
  building: [2.45, 1.4], storefront: [2.45, 1.8], house: [2.45, 1.4],
  car: [1.0, 1.7], bench: [0.75, 0.25], trash_bin: [0.32, 0.34],
  street_light: [0.95, 0.15], tree: [0.82, 0.78], fence: [1.28, 0.12],
  planter: [0.4, 0.36], curb: [1.0, 0.6], sidewalk: [0.8, 9.5],
  sign: [0.48, 0.18], utility: [0.34, 0.28],
} as const;

export type YunEnvironmentTheme = "calle" | "malecon" | "parque" | "noche";

export interface YunEnvironmentPropSpec {
  readonly id: string;
  readonly kind:
    | "building"
    | "storefront"
    | "house"
    | "car"
    | "bench"
    | "trash_bin"
    | "street_light"
    | "tree"
    | "fence"
    | "planter"
    | "curb"
    | "sidewalk"
    | "sign"
    | "utility";
  /** Godot world-space [X, Y-up, Z] in meters. Blender fixtures must convert to [X, Y, Z-up]. */
  readonly position: readonly [number, number, number];
  readonly rotationYDeg?: number;
  readonly scale?: readonly [number, number, number];
  readonly collision?: "none" | "static";
}

export interface YunEnvironmentAssetSpec {
  readonly schemaVersion: typeof YUN_ENVIRONMENT_REVISION | string;
  readonly assetId: string;
  readonly displayName: string;
  readonly theme: YunEnvironmentTheme;
  readonly props: readonly YunEnvironmentPropSpec[];
  /** The production YunCourt remains authoritative for game markings/rules. */
  readonly includesGameplayCourtGeometry: false;
  readonly requiredEvidence: readonly (
    | "blend"
    | "glb"
    | "front"
    | "three_quarter"
    | "gameplay_camera"
    | "godot_import"
    | "six_player_runtime"
  )[];
}

export const YUN_FIRST_ENVIRONMENT_SPEC: YunEnvironmentAssetSpec = {
  schemaVersion: YUN_ENVIRONMENT_REVISION,
  assetId: "yun_street_block_calle_v1",
  displayName: "Calle — Matterhorn Street Block",
  theme: "calle",
  includesGameplayCourtGeometry: false,
  requiredEvidence: [
    "blend",
    "glb",
    "front",
    "three_quarter",
    "gameplay_camera",
    "godot_import",
    "six_player_runtime",
  ],
  props: [
    { id: "shop_left", kind: "storefront", position: [0.7, 0, 14.8], collision: "static" },
    { id: "house_left", kind: "house", position: [0.8, 0, 6.6], collision: "static" },
    { id: "shop_right", kind: "storefront", position: [28.0, 0, 15.2], collision: "static" },
    { id: "house_right", kind: "house", position: [28.1, 0, 8.0], collision: "static" },
    { id: "bench_left", kind: "bench", position: [2.45, 0, 8.6], collision: "static" },
    { id: "bench_right", kind: "bench", position: [26.2, 0, 6.8], collision: "static" },
    { id: "lamp_left_near", kind: "street_light", position: [2.95, 0, 4.4], collision: "static" },
    { id: "lamp_left_far", kind: "street_light", position: [2.95, 0, 12.6], collision: "static" },
    { id: "lamp_right_near", kind: "street_light", position: [25.9, 0, 4.8], collision: "static" },
    { id: "lamp_right_far", kind: "street_light", position: [25.9, 0, 12.0], collision: "static" },
    { id: "car_left_blue", kind: "car", position: [2.0, 0, 3.0], rotationYDeg: 4, collision: "static" },
    { id: "car_right_coral", kind: "car", position: [26.8, 0, 10.3], rotationYDeg: 178, collision: "static" },
    { id: "palm_left", kind: "tree", position: [2.6, 0, 17.3], collision: "static" },
    { id: "palm_right", kind: "tree", position: [26.2, 0, 17.0], collision: "static" },
    { id: "planter_left", kind: "planter", position: [2.4, 0, 11.0], collision: "static" },
    { id: "bin_right", kind: "trash_bin", position: [25.8, 0, 8.1], collision: "static" },
    { id: "fence_left", kind: "fence", position: [0.4, 0, 1.7], rotationYDeg: 90, collision: "static" },
    { id: "street_sign_right", kind: "sign", position: [25.5, 0, 15.7], collision: "static" },
    { id: "sidewalk_left", kind: "sidewalk", position: [2.4, 0, 10.0] },
    { id: "sidewalk_right", kind: "sidewalk", position: [26.4, 0, 10.0] },
  ],
};

export function validateYunEnvironmentSpec(spec: YunEnvironmentAssetSpec): string[] {
  const errors: string[] = [];
  if (!/^yun_[a-z0-9_\-]+$/i.test(spec.assetId)) errors.push("assetId must be a safe Yun identifier");
  if (!spec.displayName.trim()) errors.push("displayName required");
  if (spec.includesGameplayCourtGeometry !== false) {
    errors.push("Blender environment must not replace authoritative YunCourt gameplay geometry");
  }

  const ids = new Set<string>();
  for (const prop of spec.props) {
    if (!prop.id.trim()) errors.push("prop id required");
    if (ids.has(prop.id)) errors.push(`duplicate prop id: ${prop.id}`);
    ids.add(prop.id);
    if (
      prop.position.length !== 3 ||
      prop.position.some((value) => !Number.isFinite(value))
    ) {
      errors.push(`invalid position for ${prop.id}`);
    }
    const [halfX, halfDepth] = YUN_ENVIRONMENT_PROP_FOOTPRINTS[prop.kind];
    const yaw = (prop.rotationYDeg ?? 0) * Math.PI / 180;
    const sx = Math.abs(prop.scale?.[0] ?? 1);
    const sz = Math.abs(prop.scale?.[2] ?? 1);
    const extentX = Math.abs(Math.cos(yaw)) * halfX * sx + Math.abs(Math.sin(yaw)) * halfDepth * sz;
    const minX = prop.position[0] - extentX;
    const maxX = prop.position[0] + extentX;
    const playLeft = YUN_COURT_CONTRACT.courtLeft * YUN_COURT_CONTRACT.planarToWorld;
    const playRight = YUN_COURT_CONTRACT.courtRight * YUN_COURT_CONTRACT.planarToWorld;
    if (maxX > playLeft && minX < playRight) {
      errors.push(`prop ${prop.id} intrudes into authoritative playable X region`);
    }
  }
  return errors;
}
