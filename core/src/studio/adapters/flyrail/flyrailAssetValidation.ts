/**
 * Flyrail-owned Godot stage for Blender-produced GLB assets.
 *
 * Does NOT use loop.run (benchmark-only / can rewrite projects).
 * Uses real Flyrail protocol: project.open → list_files → test.validate_static
 * → runtime.launch of a disposable probe scene → evidence JSON → runtime.stop.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  NssStudioCriterionResult,
  NssStudioEvidence,
  NssStudioExecutionResult,
} from "../../types.js";
import { SpecialistError } from "../types.js";
import { matchYunAnimationClips } from "../blender/yunCharacterContract.js";
import { FlyrailClient, type FlyrailClientOptions } from "./flyrailClient.js";

export const DEFAULT_GODOT_BIN =
  process.env.FLYRAIL_GODOT_BIN ||
  process.env.MATTERHORN_GODOT_BIN ||
  "D:\\dev\\Northern Step Studio\\apps\\flyrail\\tools\\godot\\bin\\Godot_v4.7.2-stable_win64.exe";

/** Godot editor import pass — Flyrail has no asset-import RPC today. */
export function runGodotEditorImport(projectDir: string, godotBin = DEFAULT_GODOT_BIN): void {
  if (!existsSync(godotBin)) {
    throw new SpecialistError("GODOT_UNAVAILABLE", `Godot binary not found: ${godotBin}`);
  }
  const res = spawnSync(godotBin, ["--path", projectDir, "--headless", "--editor", "--quit"], {
    encoding: "utf8",
    timeout: 180_000,
    windowsHide: true,
  });
  if (res.status !== 0) {
    throw new SpecialistError(
      "EXECUTION_FAILED",
      `Godot editor import failed: ${res.stderr || res.stdout || `exit ${res.status}`}`,
    );
  }
}

/** SceneTree probe used when runtime.launch cannot execute the verify scene alone. */
export function runGodotCharacterTreeProbe(projectDir: string, godotBin = DEFAULT_GODOT_BIN): void {
  if (!existsSync(godotBin)) {
    throw new SpecialistError("GODOT_UNAVAILABLE", `Godot binary not found: ${godotBin}`);
  }
  const res = spawnSync(
    godotBin,
    ["--path", projectDir, "--headless", "-s", "verify_character_asset_tree.gd"],
    { encoding: "utf8", timeout: 120_000, windowsHide: true },
  );
  if (res.status !== 0) {
    throw new SpecialistError(
      "TEST_FAILED",
      `Godot character probe failed: ${res.stderr || res.stdout || `exit ${res.status}`}`,
    );
  }
}
export interface FlyrailGlbValidationOptions extends FlyrailClientOptions {
  readonly glbSourcePath: string;
  readonly disposableProjectDir: string;
  readonly fixtureSourceDir: string;
  readonly assetFileName?: string;
  readonly requireSkeleton?: boolean;
  readonly requireAnimations?: readonly ("idle" | "walk" | "run_or_sprint")[];
  readonly godotImportFn?: (projectDir: string) => Promise<void> | void;
}

export interface FlyrailGlbValidationReport {
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly runtimeSessionId?: string;
  readonly listedFiles: readonly string[];
  readonly staticValidationOk?: boolean;
  readonly probe?: CharacterProbeResult;
  readonly evidencePath?: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface CharacterProbeResult {
  readonly ok: boolean;
  readonly rootName?: string;
  readonly childCount?: number;
  readonly hasSkeleton3D?: boolean;
  readonly hasAnimationPlayer?: boolean;
  readonly animationNames?: readonly string[];
  readonly matched?: { idle?: string; walk?: string; sprint?: string };
  readonly missing?: readonly string[];
  readonly error?: string;
}

function writeCharacterProbeScene(projectDir: string, assetFileName: string): { scenePath: string; scriptPath: string; evidencePath: string; treeScriptPath: string } {
  const scriptPath = join(projectDir, "verify_character_asset.gd");
  const treeScriptPath = join(projectDir, "verify_character_asset_tree.gd");
  const scenePath = join(projectDir, "verify_character_asset.tscn");
  const evidencePath = join(projectDir, "flyrail-character-probe.json");

  const sharedBody = `
	var report = {
		"ok": false,
		"animationNames": [],
		"hasSkeleton3D": false,
		"hasAnimationPlayer": false,
		"missing": [],
	}
	var glb_path = "res://${assetFileName}"
	if not FileAccess.file_exists(glb_path):
		report["error"] = "GLB missing: " + glb_path
		_write(report)
		return false
	var packed = ResourceLoader.load(glb_path)
	if packed == null:
		report["error"] = "ResourceLoader failed"
		_write(report)
		return false
	var inst = packed.instantiate()
	if inst == null:
		report["error"] = "instantiate failed"
		_write(report)
		return false
	report["rootName"] = str(inst.name)
	report["childCount"] = inst.get_child_count()
	var skeleton = inst.find_child("Skeleton3D", true, false)
	report["hasSkeleton3D"] = skeleton != null
	var anim = inst.find_child("AnimationPlayer", true, false)
	report["hasAnimationPlayer"] = anim != null
	var names: Array = []
	if anim != null:
		for clip in anim.get_animation_list():
			names.append(str(clip))
	report["animationNames"] = names
	report["ok"] = true
	_write(report)
	print("FLYRAIL_CHARACTER_PROBE_OK animations=", ",".join(names))
	return true
`;

  const nodeScript = `extends Node
## Disposable Flyrail character GLB probe (Node scene for runtime.launch).

func _ready() -> void:
	var ok = _probe()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit(0 if ok else 1)

func _probe() -> bool:
${sharedBody}

func _write(report: Dictionary) -> void:
	var f = FileAccess.open("res://flyrail-character-probe.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
`;

  const treeScript = `extends SceneTree
## Disposable Flyrail character GLB probe (SceneTree -s entry).

func _init():
	var ok = _probe()
	quit(0 if ok else 1)

func _probe() -> bool:
${sharedBody}

func _write(report: Dictionary) -> void:
	var f = FileAccess.open("res://flyrail-character-probe.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
`;

  const scene = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://verify_character_asset.gd" id="1"]

[node name="VerifyCharacter" type="Node"]
script = ExtResource("1")
`;

  writeFileSync(scriptPath, nodeScript, "utf8");
  writeFileSync(treeScriptPath, treeScript, "utf8");
  writeFileSync(scenePath, scene, "utf8");
  return { scenePath, scriptPath, treeScriptPath, evidencePath };
}

/**
 * Prepare disposable Godot project with the Blender GLB and probe script.
 * Filesystem placement is Matterhorn's; Flyrail owns subsequent Godot session work.
 */
export function prepareDisposableGlbProject(input: {
  fixtureSourceDir: string;
  disposableProjectDir: string;
  glbSourcePath: string;
  assetFileName?: string;
}): { assetPath: string; evidencePath: string } {
  const assetFileName = input.assetFileName ?? "character.glb";
  mkdirSync(dirname(input.disposableProjectDir), { recursive: true });
  cpSync(input.fixtureSourceDir, input.disposableProjectDir, { recursive: true });
  const assetPath = join(input.disposableProjectDir, assetFileName);
  cpSync(input.glbSourcePath, assetPath);
  const { evidencePath } = writeCharacterProbeScene(input.disposableProjectDir, assetFileName);
  return { assetPath, evidencePath };
}

export async function validateGlbThroughFlyrail(
  options: FlyrailGlbValidationOptions,
): Promise<{ report: FlyrailGlbValidationReport; result: NssStudioExecutionResult }> {
  const assetFileName = options.assetFileName ?? "character.glb";
  const requireAnims = options.requireAnimations ?? ["idle", "walk", "run_or_sprint"];
  const errors: string[] = [];

  if (!existsSync(options.glbSourcePath)) {
    throw new SpecialistError("INVALID_TASK", `GLB source missing: ${options.glbSourcePath}`);
  }

  const prepared = prepareDisposableGlbProject({
    fixtureSourceDir: options.fixtureSourceDir,
    disposableProjectDir: options.disposableProjectDir,
    glbSourcePath: options.glbSourcePath,
    assetFileName,
  });

  // Editor import pass — required before ResourceLoader can instantiate GLB.
  // Prefer caller-provided import (Flyrail may not expose --editor import RPC).
  if (options.godotImportFn) {
    await options.godotImportFn(options.disposableProjectDir);
  } else {
    runGodotEditorImport(options.disposableProjectDir);
  }

  const client = new FlyrailClient(options);
  let sessionId: string | undefined;
  let runtimeSessionId: string | undefined;
  let listedFiles: string[] = [];
  let staticValidationOk: boolean | undefined;
  let probe: CharacterProbeResult | undefined;
  const warnings: string[] = [];

  try {
    const health = await client.health();
    if (!health.ok || health.product !== "flyrail") {
      throw new SpecialistError("SPECIALIST_UNAVAILABLE", "Flyrail daemon health failed");
    }

    await client.connect();
    const openRes = (await client.call("project.open", {
      path: options.disposableProjectDir,
      installAddons: true,
    })) as { sessionId?: string };
    sessionId = openRes.sessionId;
    if (!sessionId) {
      throw new SpecialistError("PROJECT_UNAVAILABLE", "project.open did not return sessionId");
    }

    const listRes = (await client.call("project.list_files", { sessionId })) as {
      files?: string[] | Array<{ path?: string }>;
    };
    listedFiles = Array.isArray(listRes.files)
      ? listRes.files.map((f) => (typeof f === "string" ? f : String(f.path ?? "")))
      : [];
    const hasGlb = listedFiles.some((f) => f.replace(/\\/g, "/").endsWith(assetFileName));
    if (!hasGlb && !existsSync(prepared.assetPath)) {
      errors.push(`Flyrail project.list_files did not include ${assetFileName}`);
    }

    try {
      const staticRes = (await client.call("test.validate_static", { sessionId })) as { ok?: boolean };
      staticValidationOk = staticRes.ok === true;
      if (!staticValidationOk) {
        warnings.push("Flyrail test.validate_static reported not ok");
      }
    } catch (error) {
      warnings.push(
        `test.validate_static: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Launch disposable character probe scene through Flyrail runtime.
    try {
      const launch = (await client.call("runtime.launch", {
        sessionId,
        scene: "res://verify_character_asset.tscn",
        headless: true,
        quitAfter: 5,
      })) as { runtimeSessionId?: string };
      runtimeSessionId = launch.runtimeSessionId;
      if (runtimeSessionId) {
        await client.call("runtime.probe_ready", { runtimeSessionId }).catch(() => undefined);
        // Allow probe scene to write evidence before stop.
        await new Promise((r) => setTimeout(r, 1500));
        await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
      }
    } catch (error) {
      // runtime.launch may fail if the live probe port is unavailable; Fall back to
      // SceneTree -s against the same disposable project Flyrail opened.
      warnings.push(`runtime.launch: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Prefer evidence from runtime scene; otherwise run SceneTree probe on the
    // Flyrail-opened disposable project (still fail-closed on missing anims).
    if (!existsSync(prepared.evidencePath)) {
      try {
        runGodotCharacterTreeProbe(options.disposableProjectDir);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (existsSync(prepared.evidencePath)) {
      probe = JSON.parse(readFileSync(prepared.evidencePath, "utf8")) as CharacterProbeResult;
    } else {
      errors.push("Character probe evidence JSON missing after Flyrail Godot stage");
    }
  } finally {
    try {
      if (runtimeSessionId) {
        await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
      }
    } catch {
      // ignore
    }
    client.disconnect();
  }

  // Fail-closed animation requirements (Matterhorn-owned measurement from probe evidence).
  const criterionResults: NssStudioCriterionResult[] = [];
  const animNames = probe?.animationNames ?? [];
  const matched = matchYunAnimationClips(animNames);
  if (probe) {
    probe = { ...probe, matched, missing: matched.missing };
  }

  if (options.requireSkeleton !== false) {
    const skelOk = probe?.hasSkeleton3D === true;
    criterionResults.push({
      criterionId: "skeleton",
      description: "Skeleton3D present",
      checkType: "node_exists",
      target: "Skeleton3D",
      expected: true,
      actual: skelOk,
      outcome: skelOk ? "passed" : "failed",
      evidenceUri: prepared.evidencePath,
    });
    if (!skelOk) errors.push("Skeleton missing");
  }

  for (const req of requireAnims) {
    const ok =
      req === "idle"
        ? Boolean(matched.idle)
        : req === "walk"
          ? Boolean(matched.walk)
          : Boolean(matched.sprint);
    criterionResults.push({
      criterionId: `anim-${req}`,
      description: `Required animation ${req}`,
      checkType: "node_exists",
      target: `AnimationPlayer.${req}`,
      expected: true,
      actual: ok,
      outcome: ok ? "passed" : "failed",
      evidenceUri: prepared.evidencePath,
    });
    if (!ok) errors.push(`Required animation missing: ${req}`);
  }

  if (!probe?.ok) {
    errors.push(probe?.error ?? "Character probe did not succeed");
  }

  const ok = errors.length === 0 && criterionResults.every((c) => c.outcome === "passed");
  const evidence: NssStudioEvidence[] = [
    {
      kind: "test",
      summary: ok
        ? `Flyrail validated GLB animations (${animNames.join(", ")})`
        : `Flyrail GLB validation failed: ${errors.join("; ")}`,
      outcome: ok ? "passed" : "failed",
      uri: prepared.evidencePath,
    },
  ];

  const report: FlyrailGlbValidationReport = {
    ok,
    sessionId,
    runtimeSessionId,
    listedFiles,
    staticValidationOk,
    probe,
    evidencePath: prepared.evidencePath,
    errors,
    warnings,
  };

  const result: NssStudioExecutionResult = {
    taskId: `flyrail-glb-${Date.now()}`,
    specialistId: "flyrail",
    status: ok ? "completed" : "failed",
    summary: ok
      ? "Flyrail Godot stage validated Blender GLB"
      : `Flyrail Godot stage failed: ${errors.join("; ")}`,
    evidence,
    criterionResults,
    artifacts: [
      {
        kind: "glb",
        uri: prepared.assetPath,
        label: assetFileName,
        producedBy: "flyrail",
      },
      {
        kind: "report",
        uri: prepared.evidencePath,
        label: "flyrail-character-probe.json",
        producedBy: "flyrail",
      },
    ],
  };

  return { report, result };
}

export function resolveDisposableGodotFixture(): string {
  const candidates = [
    resolve(__dirname, "../../../../src/test/fixtures/disposable-godot-project"),
    resolve(__dirname, "../../../test/fixtures/disposable-godot-project"),
    resolve(process.cwd(), "core/src/test/fixtures/disposable-godot-project"),
    resolve(process.cwd(), "src/test/fixtures/disposable-godot-project"),
  ];
  const found = candidates.find((p) => existsSync(join(p, "project.godot")));
  if (!found) {
    throw new SpecialistError("PROJECT_UNAVAILABLE", "disposable-godot-project fixture not found");
  }
  return found;
}
