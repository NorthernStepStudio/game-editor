/** Fail-closed evidence, geometry, material, prop-group and court-clearance checks. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  YUN_COURT_CONTRACT,
  YUN_COURT_WORLD_METRICS,
  YUN_ENVIRONMENT_PROP_FOOTPRINTS,
  validateYunEnvironmentSpec,
  type YunEnvironmentAssetSpec,
} from "./yunEnvironmentContract.js";
import { resolveConfinedPath } from "./blenderArtifacts.js";

export interface YunEnvironmentVisualSanityCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
}
export interface YunEnvironmentVisualSanityReport {
  readonly ok: boolean;
  readonly checks: readonly YunEnvironmentVisualSanityCheck[];
  readonly geometry?: { vertices: number; polygons: number; meshObjects: number };
  readonly objectCount?: number;
  readonly materials?: readonly string[];
  readonly bounds?: { min: number[]; max: number[] };
}

const req = (id: string, ok: boolean, detail: string): YunEnvironmentVisualSanityCheck => ({ id, ok, detail });

export function runYunEnvironmentVisualSanity(input: {
  workDir: string;
  spec: YunEnvironmentAssetSpec;
  maxObjects?: number;
  maxMaterials?: number;
  maxVertices?: number;
  maxPolygons?: number;
}): YunEnvironmentVisualSanityReport {
  const checks: YunEnvironmentVisualSanityCheck[] = [];
  const prefix = input.spec.assetId;
  const artifacts = [
    `${prefix}.blend`, `${prefix}.glb`, `${prefix}-report.json`,
    ...["overview", "left", "right", "yun_side", "turn_side", "gameplay"].map((v) => `${prefix}-${v}.png`),
  ];
  for (const name of artifacts) {
    try {
      const path = resolveConfinedPath(input.workDir, name);
      const bytes = statSync(path).size;
      checks.push(req(`artifact_${name}`, bytes > (name.endsWith(".png") ? 256 : 0), `${bytes} bytes; confined`));
    } catch (error) {
      checks.push(req(`artifact_${name}`, false, error instanceof Error ? error.message : String(error)));
    }
  }
  const errors = validateYunEnvironmentSpec(input.spec);
  checks.push(req("valid_spec", errors.length === 0, errors.join("; ") || "schema, unique IDs and court clearance valid"));

  const reportPath = join(input.workDir, `${prefix}-report.json`);
  if (!existsSync(reportPath)) {
    checks.push(req("report_parse", false, "structured Blender report missing"));
    return { ok: false, checks };
  }
  let report: {
    geometry?: { vertices?: number; polygons?: number; meshObjects?: number };
    materials?: { names?: string[]; count?: number };
    objectCount?: number;
    sceneObjects?: Array<{ name: string; type: string; bounds: { min: number[]; max: number[] } | null }>;
    artifacts?: Record<string, string>;
  };
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    checks.push(req("report_parse", false, error instanceof Error ? error.message : String(error)));
    return { ok: false, checks };
  }
  const vertices = report.geometry?.vertices ?? 0;
  const polygons = report.geometry?.polygons ?? 0;
  const meshObjects = report.geometry?.meshObjects ?? 0;
  const objectCount = report.objectCount ?? report.sceneObjects?.length ?? 0;
  const materials = report.materials?.names ?? [];
  checks.push(req("geometry_nonzero", vertices > 0 && polygons > 0 && meshObjects > 0, `vertices=${vertices} polygons=${polygons} meshes=${meshObjects}`));
  checks.push(req("geometry_budget", vertices <= (input.maxVertices ?? 60_000) && polygons <= (input.maxPolygons ?? 30_000), `vertices=${vertices}/60000 polygons=${polygons}/30000`));
  checks.push(req("object_budget", objectCount <= (input.maxObjects ?? 220), `objects=${objectCount}/220`));
  checks.push(req("material_budget", materials.length > 0 && materials.length <= (input.maxMaterials ?? 12), `materials=${materials.length}: ${materials.join(", ")}`));

  const names = (report.sceneObjects ?? []).map((o) => o.name);
  for (const prop of input.spec.props) {
    const present = names.some((name) => name.startsWith(`${prop.id}__`));
    checks.push(req(`prop_${prop.id}`, present, present ? `mesh group present (${prop.kind})` : `missing mesh group (${prop.kind})`));
  }
  const forbiddenCourtGeometry = names.filter((name) => /(^|[_-])(yun_ring|turn_ring|tube_[0-9]+|center_spine|gameplay_collision|court_marking)([_-]|$)/i.test(name));
  checks.push(req("no_gameplay_geometry", input.spec.includesGameplayCourtGeometry === false && forbiddenCourtGeometry.length === 0,
    forbiddenCourtGeometry.length ? `forbidden names=${forbiddenCourtGeometry.join(",")}` : "no authoritative court geometry exported"));

  const left = YUN_COURT_CONTRACT.courtLeft * YUN_COURT_CONTRACT.planarToWorld;
  const right = YUN_COURT_CONTRACT.courtRight * YUN_COURT_CONTRACT.planarToWorld;
  const intrusions = input.spec.props.flatMap((prop) => {
    const [hx, hz] = YUN_ENVIRONMENT_PROP_FOOTPRINTS[prop.kind];
    const yaw = (prop.rotationYDeg ?? 0) * Math.PI / 180;
    const ex = Math.abs(Math.cos(yaw)) * hx * Math.abs(prop.scale?.[0] ?? 1) + Math.abs(Math.sin(yaw)) * hz * Math.abs(prop.scale?.[2] ?? 1);
    return prop.position[0] + ex > left && prop.position[0] - ex < right ? [prop.id] : [];
  });
  checks.push(req("play_area_clear", intrusions.length === 0, intrusions.length ? `intruding props=${intrusions.join(",")}` : `solid prop footprints outside X=${left}..${right}m`));

  const unique = new Set(names);
  checks.push(req("unique_scene_object_names", unique.size === names.length, `reported=${names.length} unique=${unique.size}`));
  const box = report.sceneObjects?.filter((o) => o.type === "MESH" && o.bounds).flatMap((o) => [o.bounds!]);
  const bounds = box?.length ? {
    min: [0, 1, 2].map((i) => Math.min(...box.map((b) => b.min[i] ?? 0))),
    max: [0, 1, 2].map((i) => Math.max(...box.map((b) => b.max[i] ?? 0))),
  } : undefined;
  checks.push(req("object_bounds", !!bounds, bounds ? `scene bounds ${JSON.stringify(bounds)}` : "scene object bounds unavailable"));
  void YUN_COURT_WORLD_METRICS;
  return { ok: checks.every((c) => c.ok), checks, geometry: { vertices, polygons, meshObjects }, objectCount, materials, bounds };
}
