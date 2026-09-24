/**
 * Reusable Yun environment fixture builder.
 *
 * Gameplay geometry stays in Godot YunCourt. This file only builds visual
 * street dressing from YunEnvironmentAssetSpec using bounded Blender ops.
 */

import type { BlenderOperation, BlenderVec3 } from "./blenderOperations.js";
import {
  BLENDER_TASK_SCHEMA_VERSION,
  type BlenderTaskSpec,
} from "./blenderTaskSpec.js";
import {
  YUN_COURT_CONTRACT,
  YUN_COURT_WORLD_METRICS,
  type YunEnvironmentAssetSpec,
  type YunEnvironmentPropSpec,
} from "./yunEnvironmentContract.js";

type PropShape = {
  readonly primitive: "cube" | "cylinder" | "uv_sphere";
  readonly size?: number;
  readonly radius?: number;
  readonly depth?: number;
  /** Blender XYZ scale, after Godot->Blender axis conversion. */
  readonly scale?: readonly [number, number, number];
  readonly material: string;
};

const PROP_SHAPES: Record<YunEnvironmentPropSpec["kind"], PropShape> = {
  building: { primitive: "cube", size: 1, scale: [3.2, 2.8, 4.2], material: "MAT_BuildingWarm" },
  storefront: { primitive: "cube", size: 1, scale: [3.2, 2.4, 3.2], material: "MAT_BuildingCoral" },
  house: { primitive: "cube", size: 1, scale: [2.8, 2.5, 2.8], material: "MAT_BuildingTeal" },
  car: { primitive: "cube", size: 1, scale: [1.8, 0.9, 0.55], material: "MAT_Accent" },
  bench: { primitive: "cube", size: 1, scale: [1.0, 0.45, 0.3], material: "MAT_Wood" },
  trash_bin: { primitive: "cube", size: 1, scale: [0.45, 0.45, 0.8], material: "MAT_Metal" },
  street_light: { primitive: "cylinder", radius: 0.07, depth: 3.2, material: "MAT_Metal" },
  tree: { primitive: "cylinder", radius: 0.18, depth: 2.2, material: "MAT_Foliage" },
  fence: { primitive: "cube", size: 1, scale: [2.0, 0.12, 1.2], material: "MAT_Metal" },
  curb: { primitive: "cube", size: 1, scale: [2.0, 0.3, 0.18], material: "MAT_Concrete" },
  sidewalk: { primitive: "cube", size: 1, scale: [2.0, 3.0, 0.12], material: "MAT_Concrete" },
  sign: { primitive: "cube", size: 1, scale: [1.2, 0.18, 0.8], material: "MAT_Accent" },
  utility: { primitive: "cube", size: 1, scale: [0.8, 0.8, 1.5], material: "MAT_Metal" },
};

const MATERIALS: readonly BlenderOperation[] = [
  { op: "material.create", name: "MAT_BuildingWarm", baseColor: [0.92, 0.62, 0.26, 1], roughness: 0.78 },
  { op: "material.create", name: "MAT_BuildingCoral", baseColor: [0.9, 0.38, 0.3, 1], roughness: 0.76 },
  { op: "material.create", name: "MAT_BuildingTeal", baseColor: [0.25, 0.62, 0.66, 1], roughness: 0.76 },
  { op: "material.create", name: "MAT_Concrete", baseColor: [0.46, 0.43, 0.39, 1], roughness: 0.9 },
  { op: "material.create", name: "MAT_Metal", baseColor: [0.22, 0.24, 0.27, 1], metallic: 0.45, roughness: 0.48 },
  { op: "material.create", name: "MAT_Wood", baseColor: [0.42, 0.24, 0.12, 1], roughness: 0.82 },
  { op: "material.create", name: "MAT_Foliage", baseColor: [0.22, 0.5, 0.22, 1], roughness: 0.86 },
  { op: "material.create", name: "MAT_Accent", baseColor: [0.98, 0.76, 0.18, 1], roughness: 0.62 },
];

/** Convert Godot [X, Y-up, Z] to Blender [X, Y, Z-up]. */
export function godotToBlenderPosition(
  position: readonly [number, number, number],
): BlenderVec3 {
  return [position[0], position[2], position[1]];
}

function propObjectName(prop: YunEnvironmentPropSpec): string {
  return `ENV_${prop.id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function propBaseHeight(prop: YunEnvironmentPropSpec): number {
  const shape = PROP_SHAPES[prop.kind];
  if (shape.primitive === "cylinder") return (shape.depth ?? 1) * 0.5;
  return (shape.scale?.[2] ?? 1) * 0.5;
}

function propHalfWidthX(prop: YunEnvironmentPropSpec): number {
  const shape = PROP_SHAPES[prop.kind];
  if (shape.primitive === "cylinder") return shape.radius ?? 0.5;
  return (shape.scale?.[0] ?? 1) * 0.5;
}

export function findYunEnvironmentPlayAreaIntrusions(
  spec: YunEnvironmentAssetSpec,
): readonly string[] {
  const playLeft = YUN_COURT_CONTRACT.courtLeft * YUN_COURT_CONTRACT.planarToWorld;
  const playRight = YUN_COURT_CONTRACT.courtRight * YUN_COURT_CONTRACT.planarToWorld;
  const intrusions: string[] = [];
  for (const prop of spec.props) {
    if (prop.collision !== "static") continue;
    const half = propHalfWidthX(prop) * (prop.scale?.[0] ?? 1);
    const x0 = prop.position[0] - half;
    const x1 = prop.position[0] + half;
    if (x1 > playLeft && x0 < playRight) {
      intrusions.push(prop.id);
    }
  }
  return intrusions;
}

export function buildYunEnvironmentOperations(
  spec: YunEnvironmentAssetSpec,
): BlenderOperation[] {
  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: spec.assetId },
    ...MATERIALS,
  ];

  for (const prop of spec.props) {
    const shape = PROP_SHAPES[prop.kind];
    const name = propObjectName(prop);
    const base = godotToBlenderPosition(prop.position);
    const location: BlenderVec3 = [base[0], base[1], base[2] + propBaseHeight(prop)];

    ops.push({
      op: "mesh.create_primitive",
      name,
      primitive: shape.primitive,
      ...(shape.size !== undefined ? { size: shape.size } : {}),
      ...(shape.radius !== undefined ? { radius: shape.radius } : {}),
      ...(shape.depth !== undefined ? { depth: shape.depth } : {}),
      location,
      ...(shape.scale ? { scale: shape.scale } : {}),
    });
    if (prop.rotationYDeg !== undefined) {
      // Godot Y-up yaw becomes Blender Z-up yaw.
      ops.push({
        op: "mesh.transform",
        target: name,
        rotationEulerDeg: [0, 0, prop.rotationYDeg],
      });
    }
    ops.push({ op: "material.assign", target: name, material: shape.material });
    if (shape.primitive === "cube" && prop.kind !== "sidewalk" && prop.kind !== "curb") {
      ops.push({ op: "mesh.bevel", target: name, width: 0.06, segments: 2 });
    }
  }

  const renderTarget: BlenderVec3 = [
    YUN_COURT_WORLD_METRICS.courtCenterX,
    (YUN_COURT_WORLD_METRICS.headZ + YUN_COURT_WORLD_METRICS.farZ) * 0.5,
    1.8,
  ];

  ops.push(
    {
      op: "light.create",
      name: "ENV_Sun",
      type: "SUN",
      location: [10, 4, 18],
      energy: 2.2,
      rotationEulerDeg: [42, 12, 32],
    },
    {
      op: "camera.create",
      name: "ENV_Camera",
      location: [14.4, -18, 14],
      setActive: true,
    },
    {
      op: "render.multi_view",
      outputPrefix: spec.assetId,
      views: ["front", "side", "back", "three_quarter", "top"],
      width: 960,
      height: 540,
      target: renderTarget,
      distance: 28,
      heightOffset: 11,
    },
    { op: "file.save_blend", outputName: `${spec.assetId}.blend` },
    { op: "export.glb", outputName: `${spec.assetId}.glb`, applyModifiers: true },
    { op: "scene.inspect" },
  );

  return ops;
}

export function buildYunEnvironmentTaskSpec(
  spec: YunEnvironmentAssetSpec,
  workingDirectory: string,
): BlenderTaskSpec {
  const intrusions = findYunEnvironmentPlayAreaIntrusions(spec);
  if (intrusions.length > 0) {
    throw new Error(`Environment solid props intrude into Yun play area: ${intrusions.join(", ")}`);
  }

  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: spec.assetId,
    operations: buildYunEnvironmentOperations(spec),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: `${spec.assetId}.blend`, required: true, minBytes: 1 },
      { kind: "glb", name: `${spec.assetId}.glb`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-front.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-side.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-back.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-three-quarter.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-top.png`, required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      "environment scene generated",
      "no solid prop intrudes into authoritative Yun play area",
      "gameplay court geometry remains Godot-owned",
      "multi-view environment evidence rendered",
      "environment GLB exported",
    ],
    renderSettings: { width: 960, height: 540 },
    exportSettings: { format: "GLB", applyModifiers: true },
    timeoutMs: 300_000,
  };
}
