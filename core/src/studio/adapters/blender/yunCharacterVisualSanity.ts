/**
 * Structured visual sanity guardrails for Yun character Blender reports.
 * These do not replace human review from the gameplay camera.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL } from "./yunPlayerBaseFixture.js";

export interface YunCharacterVisualSanityInput {
  readonly workDir: string;
  readonly assetPrefix: string;
  readonly reportPath?: string;
  readonly requiredMaterials?: readonly string[];
  readonly expectedBoneCount?: number;
  /** Soft upper bound — growth is OK; explosion is not. */
  readonly maxVertices?: number;
  readonly maxPolygons?: number;
  readonly minVertices?: number;
  readonly minPolygons?: number;
}

export interface YunCharacterVisualSanityCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface YunCharacterVisualSanityReport {
  readonly ok: boolean;
  readonly checks: readonly YunCharacterVisualSanityCheck[];
  readonly geometry?: { vertices: number; polygons: number; meshObjects: number };
  readonly boneCount?: number;
  readonly materials?: readonly string[];
}

function check(id: string, ok: boolean, detail: string): YunCharacterVisualSanityCheck {
  return { id, ok, detail };
}

export function runYunCharacterVisualSanity(
  input: YunCharacterVisualSanityInput,
): YunCharacterVisualSanityReport {
  const checks: YunCharacterVisualSanityCheck[] = [];
  const reportPath = input.reportPath ?? join(input.workDir, `${input.assetPrefix}-report.json`);
  if (!existsSync(reportPath)) {
    return {
      ok: false,
      checks: [check("report_exists", false, `missing ${reportPath}`)],
    };
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    geometry?: { vertices?: number; polygons?: number; meshObjects?: number };
    skeleton?: { boneNames?: string[] };
    materials?: { names?: string[] };
    exportInfo?: { animations?: string[] };
    artifacts?: Record<string, string>;
  };

  const verts = report.geometry?.vertices ?? 0;
  const polys = report.geometry?.polygons ?? 0;
  const meshes = report.geometry?.meshObjects ?? 0;
  const bones = report.skeleton?.boneNames ?? [];
  const materials = report.materials?.names ?? [];
  const anims = report.exportInfo?.animations ?? [];

  checks.push(
    check(
      "character_bounds_nonzero",
      verts > 0 && polys > 0,
      `vertices=${verts} polygons=${polys}`,
    ),
  );
  checks.push(
    check(
      "no_zero_geometry_scene",
      meshes > 0,
      `meshObjects=${meshes}`,
    ),
  );
  checks.push(
    check(
      "min_geometry",
      verts >= (input.minVertices ?? 200) && polys >= (input.minPolygons ?? 100),
      `vertices=${verts} polygons=${polys}`,
    ),
  );
  if (input.maxVertices != null) {
    checks.push(
      check(
        "max_vertices",
        verts <= input.maxVertices,
        `vertices=${verts} max=${input.maxVertices}`,
      ),
    );
  }
  if (input.maxPolygons != null) {
    checks.push(
      check(
        "max_polygons",
        polys <= input.maxPolygons,
        `polygons=${polys} max=${input.maxPolygons}`,
      ),
    );
  }

  const expectedBones = input.expectedBoneCount ?? 18;
  checks.push(
    check(
      "skeleton_bone_count",
      bones.length >= expectedBones,
      `bones=${bones.length} expected>=${expectedBones}`,
    ),
  );
  checks.push(
    check(
      "head_bone_present",
      bones.includes("Head"),
      `bones=${bones.join(",")}`,
    ),
  );
  checks.push(
    check(
      "limb_symmetry_names",
      bones.includes("UpperArm_L") &&
        bones.includes("UpperArm_R") &&
        bones.includes("Thigh_L") &&
        bones.includes("Thigh_R") &&
        bones.includes("Foot_L") &&
        bones.includes("Foot_R"),
      "left/right limb bones present",
    ),
  );

  const requiredMats = input.requiredMaterials ?? [
    YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
    "MAT_Skin",
    "MAT_Shorts",
    "MAT_Shoes",
  ];
  for (const mat of requiredMats) {
    checks.push(
      check(`material_${mat}`, materials.includes(mat), `materials=${materials.join(",")}`),
    );
  }

  for (const clip of ["idle", "walk", "run"]) {
    checks.push(
      check(
        `anim_${clip}`,
        anims.some((a) => a.toLowerCase().includes(clip)),
        `animations=${anims.join(",")}`,
      ),
    );
  }

  const renderNames = [
    `${input.assetPrefix}-front.png`,
    `${input.assetPrefix}-side.png`,
    `${input.assetPrefix}-back.png`,
    `${input.assetPrefix}-three-quarter.png`,
    `${input.assetPrefix}-preview.png`,
  ];
  for (const name of renderNames) {
    const path = join(input.workDir, name);
    const ok = existsSync(path) && statSync(path).size > 256;
    checks.push(check(`render_${name}`, ok, ok ? `${statSync(path).size} bytes` : "missing/empty"));
  }

  // Foot/root heuristic from bone names (grounded Root + Foot pair).
  checks.push(
    check(
      "foot_ground_contract",
      bones.includes("Root") && bones.includes("Foot_L") && bones.includes("Foot_R"),
      "Root and Foot_* bones present for ground contact ownership",
    ),
  );

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    checks,
    geometry: { vertices: verts, polygons: polys, meshObjects: meshes },
    boneCount: bones.length,
    materials,
  };
}
