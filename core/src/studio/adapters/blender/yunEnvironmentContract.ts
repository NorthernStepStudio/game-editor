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
    | "curb"
    | "sidewalk"
    | "sign"
    | "utility";
  /** World-space XYZ in Godot/Blender meters. */
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
    { id: "shop_left", kind: "storefront", position: [1.05, 0, 14.8], collision: "static" },
    { id: "house_left", kind: "house", position: [1.15, 0, 6.6], collision: "static" },
    { id: "shop_right", kind: "storefront", position: [27.7, 0, 15.2], collision: "static" },
    { id: "house_right", kind: "house", position: [27.65, 0, 8.0], collision: "static" },
    { id: "bench_left", kind: "bench", position: [3.4, 0, 8.6], collision: "static" },
    { id: "bench_right", kind: "bench", position: [25.4, 0, 6.8], collision: "static" },
    { id: "lamp_left_near", kind: "street_light", position: [3.7, 0, 4.4], collision: "static" },
    { id: "lamp_left_far", kind: "street_light", position: [3.7, 0, 12.6], collision: "static" },
    { id: "lamp_right_near", kind: "street_light", position: [25.1, 0, 4.8], collision: "static" },
    { id: "lamp_right_far", kind: "street_light", position: [25.1, 0, 12.0], collision: "static" },
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
  }
  return errors;
}
