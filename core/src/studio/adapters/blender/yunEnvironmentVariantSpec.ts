import {
  YUN_ENVIRONMENT_REVISION,
  YUN_FIRST_ENVIRONMENT_SPEC,
  type YunEnvironmentAssetSpec,
  type YunEnvironmentTheme,
} from "./yunEnvironmentContract.js";

export type YunEnvironmentMaterialName =
  | "MAT_BuildingWarm"
  | "MAT_BuildingCoral"
  | "MAT_BuildingTeal"
  | "MAT_Concrete"
  | "MAT_Metal"
  | "MAT_Wood"
  | "MAT_Foliage"
  | "MAT_AsphaltProp"
  | "MAT_Light"
  | "MAT_Glass";

export type YunEnvironmentMaterialPalette = Readonly<
  Record<YunEnvironmentMaterialName, readonly [number, number, number, number]>
>;

export const YUN_ENVIRONMENT_MATERIAL_PALETTES: Readonly<
  Record<YunEnvironmentTheme, YunEnvironmentMaterialPalette>
> = {
  calle: {
    MAT_BuildingWarm: [0.92, 0.57, 0.32, 1],
    MAT_BuildingCoral: [0.84, 0.31, 0.25, 1],
    MAT_BuildingTeal: [0.18, 0.56, 0.55, 1],
    MAT_Concrete: [0.52, 0.49, 0.43, 1],
    MAT_Metal: [0.16, 0.19, 0.22, 1],
    MAT_Wood: [0.44, 0.25, 0.13, 1],
    MAT_Foliage: [0.22, 0.46, 0.20, 1],
    MAT_AsphaltProp: [0.10, 0.13, 0.18, 1],
    MAT_Light: [1.0, 0.77, 0.32, 1],
    MAT_Glass: [0.25, 0.62, 0.72, 1],
  },
  malecon: {
    MAT_BuildingWarm: [0.93, 0.86, 0.63, 1],
    MAT_BuildingCoral: [0.96, 0.60, 0.42, 1],
    MAT_BuildingTeal: [0.24, 0.70, 0.72, 1],
    MAT_Concrete: [0.72, 0.68, 0.58, 1],
    MAT_Metal: [0.24, 0.32, 0.36, 1],
    MAT_Wood: [0.50, 0.34, 0.18, 1],
    MAT_Foliage: [0.30, 0.58, 0.26, 1],
    MAT_AsphaltProp: [0.24, 0.30, 0.32, 1],
    MAT_Light: [1.0, 0.88, 0.52, 1],
    MAT_Glass: [0.32, 0.74, 0.82, 1],
  },
  parque: {
    MAT_BuildingWarm: [0.78, 0.72, 0.56, 1],
    MAT_BuildingCoral: [0.72, 0.47, 0.31, 1],
    MAT_BuildingTeal: [0.35, 0.58, 0.48, 1],
    MAT_Concrete: [0.46, 0.50, 0.38, 1],
    MAT_Metal: [0.18, 0.24, 0.20, 1],
    MAT_Wood: [0.36, 0.24, 0.13, 1],
    MAT_Foliage: [0.20, 0.50, 0.20, 1],
    MAT_AsphaltProp: [0.14, 0.22, 0.16, 1],
    MAT_Light: [0.92, 0.84, 0.48, 1],
    MAT_Glass: [0.28, 0.54, 0.48, 1],
  },
  noche: {
    MAT_BuildingWarm: [0.30, 0.20, 0.34, 1],
    MAT_BuildingCoral: [0.42, 0.16, 0.28, 1],
    MAT_BuildingTeal: [0.10, 0.30, 0.40, 1],
    MAT_Concrete: [0.22, 0.22, 0.28, 1],
    MAT_Metal: [0.08, 0.10, 0.14, 1],
    MAT_Wood: [0.20, 0.13, 0.10, 1],
    MAT_Foliage: [0.10, 0.26, 0.16, 1],
    MAT_AsphaltProp: [0.05, 0.07, 0.12, 1],
    MAT_Light: [0.95, 0.72, 0.25, 1],
    MAT_Glass: [0.12, 0.42, 0.62, 1],
  },
};

export const YUN_ENVIRONMENT_WORLD_PREVIEWS: Readonly<
  Record<YunEnvironmentTheme, { color: readonly [number, number, number, number]; strength: number }>
> = {
  calle: { color: [0.52, 0.67, 0.76, 1], strength: 0.7 },
  malecon: { color: [0.48, 0.72, 0.82, 1], strength: 0.82 },
  parque: { color: [0.46, 0.62, 0.48, 1], strength: 0.65 },
  noche: { color: [0.035, 0.05, 0.11, 1], strength: 0.26 },
};

const evidence = YUN_FIRST_ENVIRONMENT_SPEC.requiredEvidence;

export const YUN_MALECON_ENVIRONMENT_SPEC: YunEnvironmentAssetSpec = {
  schemaVersion: YUN_ENVIRONMENT_REVISION,
  assetId: "yun_street_block_malecon_v1",
  displayName: "Malecón — Matterhorn Waterfront Block",
  theme: "malecon",
  includesGameplayCourtGeometry: false,
  requiredEvidence: evidence,
  props: [
    { id: "malecon_build_left_a", kind: "house", position: [0.7, 0, 4.2], collision: "static" },
    { id: "malecon_shop_left", kind: "storefront", position: [0.65, 0, 11.0], collision: "static" },
    { id: "malecon_build_right_a", kind: "house", position: [28.1, 0, 5.0], collision: "static" },
    { id: "malecon_shop_right", kind: "storefront", position: [28.15, 0, 13.8], collision: "static" },
    { id: "malecon_palm_left_near", kind: "tree", position: [2.55, 0, 2.0], collision: "static" },
    { id: "malecon_palm_left_far", kind: "tree", position: [2.45, 0, 16.7], collision: "static" },
    { id: "malecon_palm_right_near", kind: "tree", position: [26.3, 0, 3.3], collision: "static" },
    { id: "malecon_palm_right_far", kind: "tree", position: [26.25, 0, 17.2], collision: "static" },
    { id: "malecon_bench_left", kind: "bench", position: [2.5, 0, 7.6], collision: "static" },
    { id: "malecon_bench_right", kind: "bench", position: [26.15, 0, 9.2], collision: "static" },
    { id: "malecon_lamp_left", kind: "street_light", position: [2.95, 0, 12.9], collision: "static" },
    { id: "malecon_lamp_right", kind: "street_light", position: [25.85, 0, 6.2], collision: "static" },
    { id: "malecon_car_left", kind: "car", position: [1.9, 0, 14.6], collision: "static" },
    { id: "malecon_car_right", kind: "car", position: [26.9, 0, 11.7], collision: "static" },
    { id: "malecon_planter_left", kind: "planter", position: [2.45, 0, 10.4], collision: "static" },
    { id: "malecon_planter_right", kind: "planter", position: [26.2, 0, 14.8], collision: "static" },
  ],
};

export const YUN_PARQUE_ENVIRONMENT_SPEC: YunEnvironmentAssetSpec = {
  schemaVersion: YUN_ENVIRONMENT_REVISION,
  assetId: "yun_street_block_parque_v1",
  displayName: "Parque — Matterhorn Neighborhood Park",
  theme: "parque",
  includesGameplayCourtGeometry: false,
  requiredEvidence: evidence,
  props: [
    { id: "parque_house_left_a", kind: "house", position: [0.7, 0, 4.8], collision: "static" },
    { id: "parque_house_left_b", kind: "house", position: [0.65, 0, 14.8], collision: "static" },
    { id: "parque_house_right_a", kind: "house", position: [28.1, 0, 5.8], collision: "static" },
    { id: "parque_house_right_b", kind: "house", position: [28.15, 0, 15.2], collision: "static" },
    { id: "parque_tree_left_a", kind: "tree", position: [2.5, 0, 2.0], collision: "static" },
    { id: "parque_tree_left_b", kind: "tree", position: [2.45, 0, 8.8], collision: "static" },
    { id: "parque_tree_left_c", kind: "tree", position: [2.55, 0, 17.2], collision: "static" },
    { id: "parque_tree_right_a", kind: "tree", position: [26.3, 0, 2.6], collision: "static" },
    { id: "parque_tree_right_b", kind: "tree", position: [26.25, 0, 10.2], collision: "static" },
    { id: "parque_tree_right_c", kind: "tree", position: [26.2, 0, 17.4], collision: "static" },
    { id: "parque_bench_left", kind: "bench", position: [2.45, 0, 12.4], collision: "static" },
    { id: "parque_bench_right", kind: "bench", position: [26.2, 0, 6.8], collision: "static" },
    { id: "parque_fence_left", kind: "fence", position: [0.4, 0, 1.7], rotationYDeg: 90, collision: "static" },
    { id: "parque_fence_right", kind: "fence", position: [28.4, 0, 1.7], rotationYDeg: 90, collision: "static" },
    { id: "parque_lamp_left", kind: "street_light", position: [2.95, 0, 15.0], collision: "static" },
    { id: "parque_lamp_right", kind: "street_light", position: [25.85, 0, 4.3], collision: "static" },
  ],
};

export const YUN_NOCHE_ENVIRONMENT_SPEC: YunEnvironmentAssetSpec = {
  schemaVersion: YUN_ENVIRONMENT_REVISION,
  assetId: "yun_street_block_noche_v1",
  displayName: "Noche — Matterhorn Night Block",
  theme: "noche",
  includesGameplayCourtGeometry: false,
  requiredEvidence: evidence,
  props: [
    { id: "noche_shop_left", kind: "storefront", position: [0.7, 0, 5.2], collision: "static" },
    { id: "noche_build_left", kind: "building", position: [0.65, 0, 14.8], collision: "static" },
    { id: "noche_shop_right", kind: "storefront", position: [28.1, 0, 6.0], collision: "static" },
    { id: "noche_build_right", kind: "building", position: [28.15, 0, 15.0], collision: "static" },
    { id: "noche_lamp_left_a", kind: "street_light", position: [2.95, 0, 3.2], collision: "static" },
    { id: "noche_lamp_left_b", kind: "street_light", position: [2.95, 0, 9.8], collision: "static" },
    { id: "noche_lamp_left_c", kind: "street_light", position: [2.95, 0, 16.0], collision: "static" },
    { id: "noche_lamp_right_a", kind: "street_light", position: [25.85, 0, 4.2], collision: "static" },
    { id: "noche_lamp_right_b", kind: "street_light", position: [25.85, 0, 10.5], collision: "static" },
    { id: "noche_lamp_right_c", kind: "street_light", position: [25.85, 0, 15.5], collision: "static" },
    { id: "noche_car_left", kind: "car", position: [1.9, 0, 12.0], collision: "static" },
    { id: "noche_car_right", kind: "car", position: [26.9, 0, 8.4], collision: "static" },
    { id: "noche_tree_left", kind: "tree", position: [2.45, 0, 17.5], collision: "static" },
    { id: "noche_tree_right", kind: "tree", position: [26.25, 0, 17.2], collision: "static" },
    { id: "noche_sign_left", kind: "sign", position: [2.65, 0, 6.9], collision: "static" },
    { id: "noche_utility_right", kind: "utility", position: [26.1, 0, 13.1], collision: "static" },
  ],
};

export const YUN_ENVIRONMENT_SPECS: readonly YunEnvironmentAssetSpec[] = [
  YUN_FIRST_ENVIRONMENT_SPEC,
  YUN_MALECON_ENVIRONMENT_SPEC,
  YUN_PARQUE_ENVIRONMENT_SPEC,
  YUN_NOCHE_ENVIRONMENT_SPEC,
] as const;

export function getYunEnvironmentSpec(theme: YunEnvironmentTheme): YunEnvironmentAssetSpec {
  return YUN_ENVIRONMENT_SPECS.find((spec) => spec.theme === theme) ?? YUN_FIRST_ENVIRONMENT_SPEC;
}

export function resolveYunEnvironmentSpecFromGoal(goal: string): YunEnvironmentAssetSpec | undefined {
  const normalized = goal.toLowerCase();
  const isYunEnvironmentRequest =
    normalized.includes("yun environment") ||
    normalized.includes("yun map") ||
    normalized.includes("yun street") ||
    normalized.includes("yun court environment") ||
    normalized.includes("yun_street_block_");
  if (!isYunEnvironmentRequest) return undefined;
  if (normalized.includes("malecon") || normalized.includes("malecón")) return YUN_MALECON_ENVIRONMENT_SPEC;
  if (normalized.includes("parque") || normalized.includes("park")) return YUN_PARQUE_ENVIRONMENT_SPEC;
  if (normalized.includes("noche") || normalized.includes("night")) return YUN_NOCHE_ENVIRONMENT_SPEC;
  return YUN_FIRST_ENVIRONMENT_SPEC;
}
