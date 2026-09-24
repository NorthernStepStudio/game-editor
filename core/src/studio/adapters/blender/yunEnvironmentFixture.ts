/** Reusable, structured Blender fixture for Yun environment asset specs. */
import type { BlenderOperation } from "./blenderOperations.js";
import type { BlenderTaskSpec } from "./blenderTaskSpec.js";
import {
  YUN_COURT_WORLD_METRICS,
  YUN_FIRST_ENVIRONMENT_SPEC,
  validateYunEnvironmentSpec,
  type YunEnvironmentAssetSpec,
  type YunEnvironmentPropSpec,
} from "./yunEnvironmentContract.js";
import {
  YUN_ENVIRONMENT_MATERIAL_PALETTES,
  YUN_ENVIRONMENT_WORLD_PREVIEWS,
  type YunEnvironmentMaterialName,
} from "./yunEnvironmentVariantSpec.js";

export const YUN_CALLE_MATERIALS = YUN_ENVIRONMENT_MATERIAL_PALETTES.calle;

type Part = {
  suffix: string;
  primitive: "cube" | "uv_sphere" | "cylinder" | "cone";
  size: readonly [number, number, number];
  offset: readonly [number, number, number];
  material: YunEnvironmentMaterialName;
  rotation?: number;
};

const box = (suffix: string, size: Part["size"], offset: Part["offset"], material: Part["material"]): Part =>
  ({ suffix, primitive: "cube", size, offset, material });
const cylinder = (suffix: string, radius: number, height: number, offset: Part["offset"], material: Part["material"], rotation = 0): Part =>
  ({ suffix, primitive: "cylinder", size: [radius, radius, height], offset, material, rotation });

function propParts(prop: YunEnvironmentPropSpec, index: number): Part[] {
  const warm = index % 2 ? "MAT_BuildingCoral" : "MAT_BuildingWarm";
  switch (prop.kind) {
    case "building":
    case "house":
    case "storefront": {
      const store = prop.kind === "storefront";
      return [
        box("body", [4.6, 2.5, 3.0], [0, 0, 1.55], store ? "MAT_BuildingTeal" : warm),
        box("roof", [4.9, 2.75, 0.24], [0, 0, 3.2], "MAT_Concrete"),
        box("door", [0.62, 0.08, 1.65], [0, -1.29, 0.84], "MAT_Wood"),
        box("window_l", [0.82, 0.09, 0.7], [-1.2, -1.30, 2.0], "MAT_Glass"),
        box("window_r", [0.82, 0.09, 0.7], [1.2, -1.30, 2.0], "MAT_Glass"),
        ...(store ? [
          box("awning", [2.9, 0.72, 0.18], [0, -1.62, 2.75], "MAT_BuildingCoral"),
          box("sign", [2.0, 0.12, 0.48], [0, -1.34, 3.45], "MAT_Light"),
        ] : []),
      ];
    }
    case "car":
      return [
        box("chassis", [1.72, 3.1, 0.48], [0, 0, 0.52], index % 2 ? "MAT_BuildingCoral" : "MAT_BuildingTeal"),
        box("cabin", [1.35, 1.6, 0.62], [0, 0.08, 1.02], "MAT_Glass"),
        ...[-0.98, 0.98].flatMap((y, i) => [
          cylinder(`wheel_${i}_l`, 0.25, 0.16, [-0.82, y, 0.3], "MAT_Metal", Math.PI / 2),
          cylinder(`wheel_${i}_r`, 0.25, 0.16, [0.82, y, 0.3], "MAT_Metal", Math.PI / 2),
        ]),
      ];
    case "tree":
      return [
        cylinder("trunk", 0.19, 2.8, [0, 0, 1.4], "MAT_Wood"),
        { suffix: "crown_a", primitive: "uv_sphere", size: [1.55, 1.45, 1.1], offset: [0, 0, 3.0], material: "MAT_Foliage" },
        { suffix: "crown_b", primitive: "uv_sphere", size: [1.05, 1.0, 0.8], offset: [-0.62, 0.03, 3.52], material: "MAT_Foliage" },
      ];
    case "bench":
      return [
        box("seat", [1.4, 0.42, 0.12], [0, 0, 0.5], "MAT_Wood"),
        box("back", [1.4, 0.12, 0.52], [0, 0.15, 0.82], "MAT_Wood"),
        cylinder("leg_l", 0.045, 0.48, [-0.54, 0, 0.25], "MAT_Metal"),
        cylinder("leg_r", 0.045, 0.48, [0.54, 0, 0.25], "MAT_Metal"),
      ];
    case "trash_bin":
      return [box("body", [0.52, 0.55, 0.85], [0, 0, 0.45], "MAT_Metal"), box("lid", [0.62, 0.64, 0.12], [0, 0, 0.92], "MAT_Concrete")];
    case "street_light":
      return [
        cylinder("pole", 0.07, 4.3, [0, 0, 2.15], "MAT_Metal"),
        box("arm", [0.85, 0.08, 0.08], [0.35, 0, 4.15], "MAT_Metal"),
        box("lamp", [0.42, 0.3, 0.16], [0.68, 0, 4.08], "MAT_Light"),
      ];
    case "fence":
      return [
        ...[-1.2, -0.6, 0, 0.6, 1.2].map((x, i) => box(`post_${i}`, [0.08, 0.08, 0.85], [x, 0, 0.43], "MAT_Wood")),
        box("rail_low", [2.5, 0.08, 0.09], [0, 0, 0.26], "MAT_Wood"),
        box("rail_high", [2.5, 0.08, 0.09], [0, 0, 0.68], "MAT_Wood"),
      ];
    case "planter":
      return [box("pot", [0.78, 0.68, 0.5], [0, 0, 0.26], "MAT_Concrete"), { suffix: "plant", primitive: "uv_sphere", size: [0.7, 0.62, 0.65], offset: [0, 0, 0.78], material: "MAT_Foliage" }];
    case "curb":
      return [box("slab", [2.0, 1.2, 0.16], [0, 0, 0.08], "MAT_Concrete")];
    case "sidewalk":
      return [box("strip", [1.6, 19.0, 0.14], [0, 0, 0.07], "MAT_Concrete")];
    case "sign":
      return [cylinder("post", 0.045, 2.4, [0, 0, 1.2], "MAT_Metal"), box("board", [0.82, 0.14, 0.66], [0, 0, 2.08], "MAT_BuildingCoral")];
    case "utility":
      return [box("cabinet", [0.58, 0.42, 1.05], [0, 0, 0.54], "MAT_Metal"), box("label", [0.32, 0.03, 0.16], [0, -0.22, 0.62], "MAT_Light")];
  }
}

function addProp(ops: BlenderOperation[], prop: YunEnvironmentPropSpec, index: number): void {
  const [x, vertical, depth] = prop.position;
  const yaw = (prop.rotationYDeg ?? 0) * Math.PI / 180;
  for (const part of propParts(prop, index)) {
    const [lx, ly, lz] = part.offset;
    const wx = x + Math.cos(yaw) * lx - Math.sin(yaw) * ly;
    // Blender's Y axis maps to negative Godot Z in GLB export (Z-up → Y-up).
    // Invert court depth here so positive Yun z remains positive in Godot.
    const wy = -(depth + Math.sin(yaw) * lx + Math.cos(yaw) * ly);
    const name = `${prop.id}__${part.suffix}`;
    ops.push({
      op: "mesh.create_primitive",
      name,
      primitive: part.primitive,
      size: 1,
      ...(part.primitive === "cylinder" ? { radius: part.size[0], depth: part.size[2] } : {}),
      ...(part.primitive === "uv_sphere" ? { radius: 0.5, scale: [...part.size] as [number, number, number] } :
        part.primitive === "cube" ? { scale: [...part.size] as [number, number, number] } : { scale: [...part.size] as [number, number, number] }),
      location: [wx, wy, vertical + lz],
    } as BlenderOperation);
    const partRotation = part.primitive === "cylinder"
      ? [0, (part.rotation ?? 0) * 180 / Math.PI, yaw * 180 / Math.PI] as [number, number, number]
      : [0, 0, yaw * 180 / Math.PI] as [number, number, number];
    if (partRotation.some((value) => value !== 0)) {
      ops.push({ op: "mesh.transform", target: name, rotationEulerDeg: partRotation, apply: true });
    }
    ops.push({ op: "material.assign", target: name, material: part.material });
  }
}

export function buildYunEnvironmentOperations(spec: YunEnvironmentAssetSpec): BlenderOperation[] {
  const invalid = validateYunEnvironmentSpec(spec);
  if (invalid.length) throw new Error(`Invalid Yun environment spec: ${invalid.join("; ")}`);
  const ops: BlenderOperation[] = [{ op: "scene.new", sceneName: spec.assetId }];
  const preview = YUN_ENVIRONMENT_WORLD_PREVIEWS[spec.theme];
  ops.push({ op: "world.set_background", color: [...preview.color] as [number, number, number, number], strength: preview.strength });
  const palette = YUN_ENVIRONMENT_MATERIAL_PALETTES[spec.theme];
  for (const [name, color] of Object.entries(palette)) {
    ops.push({ op: "material.create", name, baseColor: [...color] as [number, number, number, number], roughness: name === "MAT_Metal" ? 0.34 : 0.72, metallic: name === "MAT_Metal" ? 0.55 : 0 });
  }
  spec.props.forEach((prop, i) => addProp(ops, prop, i));
  // A sun and camera serve Blender previews only. Godot keeps match world lighting.
  ops.push({ op: "light.create", name: "Preview_Sun", type: "SUN", energy: 2.0, rotationEulerDeg: [28, 0, 24] });
  ops.push({ op: "render.multi_view", outputPrefix: spec.assetId, target: [14.4, -10, 1.8], views: ["overview", "left", "right", "yun_side", "turn_side", "gameplay"], width: 960, height: 640 });
  ops.push({ op: "file.save_blend", outputName: `${spec.assetId}.blend` });
  ops.push({ op: "export.glb", outputName: `${spec.assetId}.glb`, applyModifiers: true });
  return ops;
}

export function buildYunEnvironmentTaskSpec(
  workingDirectory: string,
  spec: YunEnvironmentAssetSpec = YUN_FIRST_ENVIRONMENT_SPEC,
): BlenderTaskSpec {
  const prefix = spec.assetId;
  return {
    schemaVersion: "1.0.0",
    assetName: prefix,
    operations: buildYunEnvironmentOperations(spec),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: `${prefix}.blend`, required: true, minBytes: 1 },
      { kind: "glb", name: `${prefix}.glb`, required: true, minBytes: 1 },
      { kind: "json", name: `${prefix}-report.json`, required: true, minBytes: 1 },
      ...["overview", "left", "right", "yun_side", "turn_side", "gameplay"].map((view) => ({
        kind: "png" as const, name: `${prefix}-${view}.png`, required: true, minBytes: 256,
      })),
    ],
    acceptanceCriteria: [
      `${prefix}.blend and ${prefix}.glb are nonempty and confined to task output`,
      "Yun gameplay geometry remains absent from this environment asset",
      "All prop IDs are unique and all solid prop footprints remain outside the playable court",
      "Required six-view environment evidence and structured scene report are present",
    ],
    renderSettings: { width: 960, height: 640 },
    exportSettings: { format: "GLB", applyModifiers: true },
    timeoutMs: 420_000,
  };
}

export const YUN_ENVIRONMENT_PLAY_X = [
  YUN_COURT_WORLD_METRICS.playableWidth ? 160 * 0.025 : 0,
  992 * 0.025,
] as const;
