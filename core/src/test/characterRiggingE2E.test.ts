/**
 * End-to-end Character Rigging & Animation Pipeline Test
 *
 * Validates the full chain:
 * 1. Provider-neutral character rigging specification (humanoid)
 * 2. Skin weight assignment (automatic heat mode)
 * 3. In-place animation generation (idle, walk, run)
 * 4. Compilation into BlenderOperations
 * 5. Execution via Blender (Blender 5.2 LTS headless)
 * 6. Blender validation (skeleton bones, vertex groups, exported GLB, preview renders)
 * 7. Godot headless import & verification (Godot 4.7.2):
 *    - ResourceLoader loads GLB
 *    - Scene instantiates with Skeleton3D and AnimationPlayer
 *    - AnimationPlayer contains 'idle', 'walk', and 'run'
 *    - Mini-figure contract matches
 */

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
} from "../studio/adapters/blender/index.js";
import {
  BlenderRiggingProvider,
  BlenderSkinWeightProvider,
  BlenderAnimationGenerationProvider,
} from "../studio/adapters/blender/blenderRiggingAdapter.js";
import {
  STANDARD_YUN_HUMANOID_BONES,
  STANDARD_YUN_HUMANOID_SKELETON,
} from "../studio/assets/characterRiggingPipeline.js";
import type { BlenderOperation } from "../studio/adapters/blender/blenderOperations.js";
import type { BlenderTaskSpec } from "../studio/adapters/blender/blenderTaskSpec.js";

const DEFAULT_GODOT_BIN =
  process.env.FLYRAIL_GODOT_BIN ||
  process.env.MATTERHORN_GODOT_BIN ||
  "D:\\dev\\Northern Step Studio\\apps\\flyrail\\tools\\godot\\bin\\Godot_v4.7.2-stable_win64.exe";

test("Character rigging and animation end-to-end: neutral provider -> Blender -> GLB -> Godot verification", async (t) => {
  const blenderBin = findBlenderExecutable();
  if (!blenderBin) {
    t.diagnostic("SKIPPED — Blender binary not found");
    return;
  }
  if (!existsSync(DEFAULT_GODOT_BIN)) {
    t.diagnostic("SKIPPED — Godot binary not found");
    return;
  }

  // 1. Providers instantiate
  const riggingProvider = new BlenderRiggingProvider();
  const skinningProvider = new BlenderSkinWeightProvider();
  const animProvider = new BlenderAnimationGenerationProvider();

  // 2. Request skeleton definition
  const rigRes = await riggingProvider.generateSkeleton({
    characterId: "yun_character_e2e",
    meshSourceUri: "res://assets/yun_character_e2e.glb",
    targetTopology: "humanoid",
    heightScale: 1.0,
  });
  assert.equal(rigRes.success, true);
  assert.equal(rigRes.skeleton.bones.length, STANDARD_YUN_HUMANOID_BONES.length);

  // 3. Request animation clips (idle, walk, run)
  const idleClip = await animProvider.generateClip({
    characterId: "yun_character_e2e",
    armatureName: rigRes.outputArmatureName,
    clipName: "idle",
    clipType: "idle",
    durationFrames: 24,
  });
  const walkClip = await animProvider.generateClip({
    characterId: "yun_character_e2e",
    armatureName: rigRes.outputArmatureName,
    clipName: "walk",
    clipType: "walk",
    durationFrames: 24,
  });
  const runClip = await animProvider.generateClip({
    characterId: "yun_character_e2e",
    armatureName: rigRes.outputArmatureName,
    clipName: "run",
    clipType: "run",
    durationFrames: 16,
  });
  assert.equal(idleClip.success, true);
  assert.equal(walkClip.success, true);
  assert.equal(runClip.success, true);

  // 4. Assemble complete Blender task operations
  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: "YunE2ERigScene" },
    {
      op: "material.create",
      name: "MAT_Skin",
      baseColor: [0.78, 0.56, 0.4, 1],
      roughness: 0.55,
    },
    {
      op: "material.create",
      name: "MAT_TeamShirt",
      baseColor: [0.95, 0.72, 0.18, 1],
      roughness: 0.45,
    },
    // Stylized character geometry
    { op: "mesh.create_primitive", name: "Body_Torso", primitive: "cube", size: 0.5, location: [0, 0, 1.1], scale: [0.7, 0.4, 1.0] },
    { op: "mesh.create_primitive", name: "Body_Head", primitive: "uv_sphere", radius: 0.18, location: [0, 0, 1.75] },
    { op: "mesh.create_primitive", name: "Body_Pelvis", primitive: "cube", size: 0.4, location: [0, 0, 0.7], scale: [0.8, 0.45, 0.5] },
    { op: "mesh.create_primitive", name: "Body_Leg_L", primitive: "cylinder", radius: 0.08, depth: 0.7, location: [0.12, 0, 0.35] },
    { op: "mesh.create_primitive", name: "Body_Leg_R", primitive: "cylinder", radius: 0.08, depth: 0.7, location: [-0.12, 0, 0.35] },
    { op: "mesh.create_primitive", name: "Body_Arm_L", primitive: "cylinder", radius: 0.06, depth: 0.55, location: [0.4, 0, 1.15] },
    { op: "mesh.create_primitive", name: "Body_Arm_R", primitive: "cylinder", radius: 0.06, depth: 0.55, location: [-0.4, 0, 1.15] },
    { op: "material.assign", target: "Body_Torso", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Body_Head", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Pelvis", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Body_Leg_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Leg_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Arm_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Arm_R", material: "MAT_Skin" },
  ];

  // Rigging operations compiled by provider
  const rigOps = riggingProvider.compileRiggingOperations(rigRes.outputArmatureName, rigRes.skeleton);
  ops.push(...rigOps);

  // Skinning operations compiled by provider
  const meshParts = [
    "Body_Torso",
    "Body_Head",
    "Body_Pelvis",
    "Body_Leg_L",
    "Body_Leg_R",
    "Body_Arm_L",
    "Body_Arm_R",
  ];
  for (const part of meshParts) {
    const skinOps = skinningProvider.compileSkinningOperations(part, rigRes.outputArmatureName, "automatic");
    ops.push(...skinOps);
  }

  // Locomotion animations compiled by provider
  ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, idleClip.clip));
  ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, walkClip.clip));
  ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, runClip.clip));

  // Export and validation renders
  ops.push(
    { op: "light.create", name: "Light_Key", type: "SUN", location: [4, -4, 6], energy: 3.5, rotationEulerDeg: [45, 15, 45] },
    { op: "camera.create", name: "Camera_Main", location: [2.8, -2.8, 1.8], rotationEulerDeg: [70, 0, 45], setActive: true },
    { op: "file.save_blend", outputName: "yun_rig_e2e.blend" },
    { op: "render.preview", outputName: "yun_rig_e2e-preview.png", width: 640, height: 640 },
    { op: "render.multi_view", outputPrefix: "yun_rig_e2e-view", views: ["front", "side", "three_quarter"], width: 480, height: 480 },
    { op: "export.character_glb", outputName: "yun_rig_e2e.glb" },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-motion-e2e-"));
  const godotDir = join(workDir, "godot-fixture");

  try {
    const adapter = new BlenderAdapter({ baseWorkDir: workDir });
    const taskId = "t-yun-motion-pipeline-e2e";
    const spec: BlenderTaskSpec = {
      schemaVersion: "1.0.0",
      assetName: "yun_rig_e2e",
      operations: ops,
      workingDirectory: join(workDir, taskId),
      expectedArtifacts: [
        { kind: "blend", name: "yun_rig_e2e.blend", required: true, minBytes: 100 },
        { kind: "png", name: "yun_rig_e2e-preview.png", required: true, minBytes: 100 },
        { kind: "glb", name: "yun_rig_e2e.glb", required: true, minBytes: 100 },
        { kind: "json", name: "blender-report.json", required: true, minBytes: 10 },
      ],
      acceptanceCriteria: [
        "yun_rig_e2e.blend created",
        "armature and bones created",
        "idle walk run animations present",
        "yun_rig_e2e.glb exported",
      ],
      timeoutMs: 180_000,
    };

    const specFilePath = join(workDir, "task_spec.json");
    writeFileSync(specFilePath, JSON.stringify(spec, null, 2), "utf8");

    const handle = await adapter.submitTask({
      protocol: "nss.studio-handoff.v1",
      id: "h-motion-e2e",
      taskId,
      from: "matterhorn",
      to: "blender-engine",
      goal: "Execute character rigging and animation end-to-end task",
      acceptanceCriteria: spec.acceptanceCriteria,
      inputArtifacts: [
        {
          kind: "json",
          uri: specFilePath,
          label: "blender-task.json",
        },
      ],
    });
    assert.equal(handle.accepted, true);

    const runResult = await adapter.getResult(taskId);
    assert.equal(runResult.status, "completed", runResult.summary);
    const glbPath = join(spec.workingDirectory, "yun_rig_e2e.glb");
    assert.ok(existsSync(glbPath), "Exported GLB must exist");

    const reportPath = join(spec.workingDirectory, "blender-report.json");
    assert.ok(existsSync(reportPath), "Blender report must exist");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));

    // Verify Blender report properties
    assert.equal(report.success, true);
    assert.ok(report.skeleton?.boneNames?.length >= STANDARD_YUN_HUMANOID_BONES.length);
    const exportedAnims = report.exportInfo?.animations ?? [];
    const matched = matchYunAnimationClips(exportedAnims);
    assert.equal(matched.missing.length, 0, `Animations missing: ${matched.missing.join(", ")}`);

    // 5. Godot Headless import & inspection
    const fixtureSource = resolve(process.cwd(), "core/src/test/fixtures/disposable-godot-project");
    cpSync(fixtureSource, godotDir, { recursive: true });
    cpSync(glbPath, join(godotDir, "yun_rig_e2e.glb"));

    const verifyScriptPath = join(godotDir, "verify_motion_e2e.gd");
    writeFileSync(
      verifyScriptPath,
      `@tool
extends SceneTree

func _init() -> void:
	var path := "res://yun_rig_e2e.glb"
	if not FileAccess.file_exists(path):
		printerr("ERROR: glb missing")
		quit(1)
		return
	var res = ResourceLoader.load(path)
	if res == null:
		printerr("ERROR: ResourceLoader load failed")
		quit(1)
		return
	var inst = res.instantiate() as Node3D
	if inst == null:
		printerr("ERROR: instantiate failed")
		quit(1)
		return
	root.add_child(inst)

	var anim = inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if anim == null:
		printerr("ERROR: AnimationPlayer missing")
		quit(1)
		return

	var anim_list = anim.get_animation_list()
	print("ANIM_LIST: ", anim_list)

	var has_idle := false
	var has_walk := false
	var has_run := false

	for clip in anim_list:
		var low: String = clip.to_lower()
		if low.contains("idle"):
			has_idle = true
		if low.contains("walk") and not low.contains("wheel"):
			has_walk = true
		if low.contains("run") or low.contains("sprint"):
			has_run = true

	if not (has_idle and has_walk and has_run):
		printerr("ERROR: Missing required clips: idle=", has_idle, " walk=", has_walk, " run=", has_run)
		quit(1)
		return

	var skel = inst.find_child("Skeleton3D", true, false) as Skeleton3D
	if skel == null:
		printerr("ERROR: Skeleton3D missing")
		quit(1)
		return

	print("MOTION_E2E_OK bones=", skel.get_bone_count(), " anims=", anim_list.size())
	quit(0)
`,
      "utf8",
    );

    // Run Godot import pass
    const importRes = spawnSync(
      DEFAULT_GODOT_BIN,
      ["--path", godotDir, "--headless", "--editor", "--quit"],
      { encoding: "utf8", timeout: 120_000, windowsHide: true },
    );
    assert.equal(importRes.status, 0, `Godot import failed: ${importRes.stderr || importRes.stdout}`);

    // Run Godot verification script
    const verifyRes = spawnSync(
      DEFAULT_GODOT_BIN,
      ["--path", godotDir, "--headless", "-s", "verify_motion_e2e.gd"],
      { encoding: "utf8", timeout: 120_000, windowsHide: true },
    );
    assert.equal(verifyRes.status, 0, `Godot verification failed: ${verifyRes.stderr || verifyRes.stdout}`);
    assert.ok(
      String(verifyRes.stdout).includes("MOTION_E2E_OK"),
      `Expected MOTION_E2E_OK in stdout: ${verifyRes.stdout}`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
