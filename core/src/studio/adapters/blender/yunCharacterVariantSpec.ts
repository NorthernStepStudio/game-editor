/**
 * Reusable Yun character-variant specification.
 * All variants share skeleton/animation/team-color/wrapper contracts from yun_player_base_v2.
 */

export const YUN_ROSTER_REVISION = "1.0.0" as const;
export const YUN_ROSTER_TEAM_COLOR_MATERIAL = "MAT_TeamShirt" as const;

/** Soft geometry budget keyed to accepted yun_player_base_v2 (~6488 / ~6532). */
export const YUN_ROSTER_GEOMETRY_BUDGET = {
  maxVertices: 8000,
  maxPolygons: 8000,
  referenceVertices: 6488,
  referencePolygons: 6532,
  referenceGlbBytes: 1_526_344,
} as const;

export type YunHairStyle = "cap" | "ponytail" | "buzz" | "afro";
export type YunJerseyStyle = "sleeved" | "sleeveless" | "tank";
export type YunShoeStyle = "low" | "high";
export type Rgba = readonly [number, number, number, number];

export interface YunCharacterVariantSpec {
  readonly assetId: string;
  readonly displayName: string;
  /** Production MODELS index once installed (Kenney 0–11, Yun 12, …). */
  readonly modelIndex: number;
  readonly heightScale: number;
  readonly torsoWidth: number;
  readonly torsoDepth: number;
  readonly limbThickness: number;
  readonly headScale: number;
  readonly skinColor: Rgba;
  readonly hairColor: Rgba;
  readonly hairStyle: YunHairStyle;
  readonly shortsColor: Rgba;
  readonly shoeColor: Rgba;
  readonly accentColor: Rgba;
  /** Default albedo for MAT_TeamShirt before runtime tint. */
  readonly shirtPreviewColor: Rgba;
  readonly jerseyStyle: YunJerseyStyle;
  readonly shoeStyle: YunShoeStyle;
  readonly browIndication: boolean;
  readonly description: string;
}

export const YUN_ROSTER_VARIANTS: readonly YunCharacterVariantSpec[] = [
  {
    assetId: "yun_player_base",
    displayName: "Yun",
    modelIndex: 12,
    heightScale: 1.0,
    torsoWidth: 0.78,
    torsoDepth: 0.4,
    limbThickness: 1.0,
    headScale: 1.0,
    skinColor: [0.8, 0.58, 0.42, 1],
    hairColor: [0.12, 0.08, 0.06, 1],
    hairStyle: "cap",
    shortsColor: [0.1, 0.16, 0.3, 1],
    shoeColor: [0.94, 0.94, 0.96, 1],
    accentColor: [0.12, 0.82, 0.52, 1],
    shirtPreviewColor: [0.95, 0.72, 0.18, 1],
    jerseyStyle: "sleeved",
    shoeStyle: "low",
    browIndication: false,
    description: "Validated street-sports base (yun_player_base_v2).",
  },
  {
    assetId: "yun_player_02",
    displayName: "Raya",
    modelIndex: 13,
    heightScale: 1.06,
    torsoWidth: 0.68,
    torsoDepth: 0.36,
    limbThickness: 0.9,
    headScale: 0.96,
    skinColor: [0.72, 0.48, 0.34, 1],
    hairColor: [0.18, 0.08, 0.04, 1],
    hairStyle: "ponytail",
    shortsColor: [0.14, 0.12, 0.22, 1],
    shoeColor: [0.96, 0.92, 0.88, 1],
    accentColor: [0.2, 0.85, 0.7, 1],
    shirtPreviewColor: [0.95, 0.55, 0.2, 1],
    jerseyStyle: "sleeved",
    shoeStyle: "low",
    browIndication: true,
    description: "Taller lean athlete with ponytail and narrower jersey.",
  },
  {
    assetId: "yun_player_03",
    displayName: "Kade",
    modelIndex: 14,
    heightScale: 0.96,
    torsoWidth: 0.92,
    torsoDepth: 0.48,
    limbThickness: 1.18,
    headScale: 1.06,
    skinColor: [0.62, 0.5, 0.4, 1],
    hairColor: [0.08, 0.07, 0.06, 1],
    hairStyle: "buzz",
    shortsColor: [0.08, 0.1, 0.14, 1],
    shoeColor: [0.2, 0.2, 0.22, 1],
    accentColor: [0.95, 0.45, 0.12, 1],
    shirtPreviewColor: [0.25, 0.55, 0.95, 1],
    jerseyStyle: "sleeveless",
    shoeStyle: "high",
    browIndication: true,
    description: "Stocky sleeveless player with buzz cut and high-tops.",
  },
  {
    assetId: "yun_player_04",
    displayName: "Mira",
    modelIndex: 15,
    heightScale: 1.02,
    torsoWidth: 0.74,
    torsoDepth: 0.38,
    limbThickness: 0.95,
    headScale: 1.04,
    skinColor: [0.55, 0.38, 0.28, 1],
    hairColor: [0.06, 0.04, 0.03, 1],
    hairStyle: "afro",
    shortsColor: [0.18, 0.22, 0.35, 1],
    shoeColor: [0.9, 0.9, 0.2, 1],
    accentColor: [0.85, 0.25, 0.55, 1],
    shirtPreviewColor: [0.9, 0.9, 0.92, 1],
    jerseyStyle: "tank",
    shoeStyle: "high",
    browIndication: false,
    description: "Afro + tank silhouette with bright shoes and magenta accents.",
  },
] as const;

/** Variants that are generated via CharacterVariantSpec (excludes frozen production Yun base archive). */
export const YUN_ROSTER_GENERATED_VARIANTS = YUN_ROSTER_VARIANTS.filter(
  (v) => v.assetId !== "yun_player_base",
);

export function getYunRosterVariant(assetId: string): YunCharacterVariantSpec | undefined {
  return YUN_ROSTER_VARIANTS.find((v) => v.assetId === assetId);
}

export function validateYunCharacterVariantSpec(spec: YunCharacterVariantSpec): string[] {
  const errors: string[] = [];
  if (!/^yun_player_(base|0[2-9]|[1-9]\d)$/.test(spec.assetId) && spec.assetId !== "yun_player_base") {
    // Allow yun_player_base and yun_player_02+
  }
  if (!spec.assetId.startsWith("yun_player_")) {
    errors.push(`assetId must start with yun_player_: ${spec.assetId}`);
  }
  if (!spec.displayName.trim()) errors.push("displayName required");
  if (spec.heightScale < 0.9 || spec.heightScale > 1.12) {
    errors.push(`heightScale out of safe bounds: ${spec.heightScale}`);
  }
  if (spec.torsoWidth < 0.55 || spec.torsoWidth > 1.05) {
    errors.push(`torsoWidth out of safe bounds: ${spec.torsoWidth}`);
  }
  if (spec.limbThickness < 0.75 || spec.limbThickness > 1.35) {
    errors.push(`limbThickness out of safe bounds: ${spec.limbThickness}`);
  }
  if (spec.modelIndex < 12 || spec.modelIndex > 32) {
    errors.push(`modelIndex unexpected for Matterhorn roster: ${spec.modelIndex}`);
  }
  return errors;
}

export function assertYunRosterUnique(): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  const indexes = new Set<number>();
  for (const v of YUN_ROSTER_VARIANTS) {
    const errs = validateYunCharacterVariantSpec(v);
    if (errs.length) throw new Error(`${v.assetId}: ${errs.join("; ")}`);
    if (ids.has(v.assetId)) throw new Error(`duplicate assetId ${v.assetId}`);
    if (names.has(v.displayName)) throw new Error(`duplicate displayName ${v.displayName}`);
    if (indexes.has(v.modelIndex)) throw new Error(`duplicate modelIndex ${v.modelIndex}`);
    ids.add(v.assetId);
    names.add(v.displayName);
    indexes.add(v.modelIndex);
  }
}
