import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runYunCharacterVisualSanity,
  type YunCharacterVisualSanityCheck,
  type YunCharacterVisualSanityReport,
} from "./yunCharacterVisualSanity.js";
import {
  YUN_CHARACTER_ART_V3_QUALITY,
} from "./yunCharacterArtV3Fixture.js";

export interface YunCharacterArtV3SanityReport extends YunCharacterVisualSanityReport {
  readonly characterBounds?: { min: number[]; max: number[] };
}

function extraCheck(
  id: string,
  ok: boolean,
  detail: string,
): YunCharacterVisualSanityCheck {
  return { id, ok, detail };
}

export function runYunCharacterArtV3Sanity(input: {
  workDir: string;
  assetPrefix: string;
}): YunCharacterArtV3SanityReport {
  const base = runYunCharacterVisualSanity({
    workDir: input.workDir,
    assetPrefix: input.assetPrefix,
    expectedBoneCount: YUN_CHARACTER_ART_V3_QUALITY.expectedBoneCount,
    maxVertices: YUN_CHARACTER_ART_V3_QUALITY.maxVertices,
    maxPolygons: YUN_CHARACTER_ART_V3_QUALITY.maxPolygons,
    minVertices: 300,
    minPolygons: 250,
  });

  const reportPath = join(input.workDir, `${input.assetPrefix}-report.json`);
  if (!existsSync(reportPath)) return base;

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    geometry?: { meshObjects?: number };
    sceneObjects?: Array<{
      name?: string;
      type?: string;
      bounds?: { min?: number[]; max?: number[] } | null;
    }>;
  };
  const meshObjects = report.geometry?.meshObjects ?? Number.POSITIVE_INFINITY;
  const sceneObjects = report.sceneObjects ?? [];
  const character = sceneObjects.find((item) => item.name === "Mesh_Character" && item.type === "MESH");
  const forbidden = sceneObjects.filter((item) =>
    /Mesh_(Elbow|Knee|HipJoin|Shoulder)_[LR]/.test(item.name ?? ""),
  );

  const checks = [...base.checks];
  checks.push(
    extraCheck(
      "joined_character_mesh",
      Boolean(character),
      character ? "Mesh_Character present" : "joined Mesh_Character missing",
    ),
  );
  checks.push(
    extraCheck(
      "mesh_object_budget",
      meshObjects <= YUN_CHARACTER_ART_V3_QUALITY.maxMeshObjectsAfterJoin,
      `meshObjects=${meshObjects} max=${YUN_CHARACTER_ART_V3_QUALITY.maxMeshObjectsAfterJoin}`,
    ),
  );
  checks.push(
    extraCheck(
      "no_ball_joint_fillers",
      forbidden.length === 0,
      forbidden.length ? `forbidden=${forbidden.map((item) => item.name).join(",")}` : "no elbow/knee/hip/shoulder filler meshes",
    ),
  );

  let bounds: { min: number[]; max: number[] } | undefined;
  if (character?.bounds?.min && character.bounds.max) {
    bounds = { min: character.bounds.min, max: character.bounds.max };
    const width = bounds.max[0]! - bounds.min[0]!;
    const height = bounds.max[2]! - bounds.min[2]!;
    const ratio = height > 0 ? width / height : 0;
    checks.push(
      extraCheck(
        "game_character_height",
        height >= 1.35 && height <= 2.05,
        `height=${height.toFixed(3)}m`,
      ),
    );
    checks.push(
      extraCheck(
        "silhouette_width_ratio",
        ratio >= 0.22 && ratio <= 0.62,
        `width=${width.toFixed(3)}m height=${height.toFixed(3)}m ratio=${ratio.toFixed(3)}`,
      ),
    );
    checks.push(
      extraCheck(
        "ground_contact",
        bounds.min[2]! >= -0.04 && bounds.min[2]! <= 0.10,
        `minZ=${bounds.min[2]!.toFixed(3)}m`,
      ),
    );
  } else {
    checks.push(extraCheck("game_character_height", false, "Mesh_Character bounds missing"));
    checks.push(extraCheck("silhouette_width_ratio", false, "Mesh_Character bounds missing"));
    checks.push(extraCheck("ground_contact", false, "Mesh_Character bounds missing"));
  }

  return {
    ...base,
    ok: checks.every((item) => item.ok),
    checks,
    characterBounds: bounds,
  };
}
