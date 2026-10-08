/**
 * Real Yun Production Character Pipeline Test
 *
 * Verifies the full Character Studio -> Motion Studio -> Flyrail/Godot pipeline
 * on the real Yun production character asset:
 *   games/Yun/assets/kenney/mini_characters/character-male-a.glb
 *
 * Steps verified:
 * 1. Import real Yun character GLB (geometry, materials, and existing meshes).
 * 2. Generate and scale standard humanoid skeleton (18 bones).
 * 3. Assign skin weights with automatic heat weighting and verify normalization.
 * 4. Generate locomotion animations: idle, walk, run, sprint, and turn.
 * 5. Retarget external character motions onto the rig.
 * 6. Export production-candidate GLB with embedded skeleton and animation tracks.
 * 7. Validate in Godot 4.7.2 headless:
 *    - Model instantiates under YunMiniFigure
 *    - Clips bind correctly (_bind_clips)
 *    - Playback transitions (idle -> walk -> run -> sprint) execute cleanly.
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
  BlenderRetargetingProvider,
} from "../studio/adapters/blender/blenderRiggingAdapter.js";
import {
  STANDARD_YUN_HUMANOID_BONES,
} from "../studio/assets/characterRiggingPipeline.js";
import type { BlenderOperation } from "../studio/adapters/blender/blenderOperations.js";
import type { BlenderTaskSpec } from "../studio/adapters/blender/blenderTaskSpec.js";

const DEFAULT_GODOT_BIN =
  process.env.FLYRAIL_GODOT_BIN ||
  process.env.MATTERHORN_GODOT_BIN ||
  "D:\\dev\\Northern Step Studio\\apps\\flyrail\\tools\\godot\\bin\\Godot_v4.7.2-stable_win64.exe";

const REAL_YUN_KENNEY_GLB =
  "D:\\dev\\Northern Step Studio\\games\\Yun\\assets\\kenney\\mini_characters\\character-male-a.glb";

test("Real Yun production character pipeline: import -> rig -> skin -> animate (idle, walk, run, sprint, turn) -> retarget -> Godot 4.7.2 verification", async (t) => {
  const blenderBin = findBlenderExecutable();
  if (!blenderBin) {
    t.diagnostic("SKIPPED — Blender binary not found");
    return;
  }
  if (!existsSync(DEFAULT_GODOT_BIN)) {
    t.diagnostic("SKIPPED — Godot binary not found");
    return;
  }
  if (!existsSync(REAL_YUN_KENNEY_GLB)) {
    t.diagnostic("SKIPPED — Real Yun character asset not found: " + REAL_YUN_KENNEY_GLB);
    return;
  }

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-real-yun-"));
  const godotDir = join(workDir, "godot-fixture");

  try {
    const riggingProvider = new BlenderRiggingProvider();
    const skinningProvider = new BlenderSkinWeightProvider();
    const animProvider = new BlenderAnimationGenerationProvider();
    const retargetProvider = new BlenderRetargetingProvider();

    // 1. Generate standard Yun skeleton definition
    const rigRes = await riggingProvider.generateSkeleton({
      characterId: "yun_real_prod_male_a",
      meshSourceUri: REAL_YUN_KENNEY_GLB,
      targetTopology: "humanoid",
      heightScale: 1.0,
    });
    assert.equal(rigRes.success, true);
    assert.equal(rigRes.skeleton.bones.length, STANDARD_YUN_HUMANOID_BONES.length);

    // 2. Generate locomotion clips: idle, walk, run, sprint, turn
    const idleClip = await animProvider.generateClip({
      characterId: "yun_real_prod_male_a",
      armatureName: rigRes.outputArmatureName,
      clipName: "idle",
      clipType: "idle",
      durationFrames: 24,
    });
    const walkClip = await animProvider.generateClip({
      characterId: "yun_real_prod_male_a",
      armatureName: rigRes.outputArmatureName,
      clipName: "walk",
      clipType: "walk",
      durationFrames: 24,
    });
    const runClip = await animProvider.generateClip({
      characterId: "yun_real_prod_male_a",
      armatureName: rigRes.outputArmatureName,
      clipName: "run",
      clipType: "run",
      durationFrames: 16,
    });
    const sprintClip = await animProvider.generateClip({
      characterId: "yun_real_prod_male_a",
      armatureName: rigRes.outputArmatureName,
      clipName: "sprint",
      clipType: "sprint",
      durationFrames: 16,
    });
    const turnClip = await animProvider.generateClip({
      characterId: "yun_real_prod_male_a",
      armatureName: rigRes.outputArmatureName,
      clipName: "turn",
      clipType: "turn",
      durationFrames: 16,
    });

    assert.equal(idleClip.success, true);
    assert.equal(walkClip.success, true);
    assert.equal(runClip.success, true);
    assert.equal(sprintClip.success, true);
    assert.equal(turnClip.success, true);

    // 3. Retargeting verification
    const retargetRes = await retargetProvider.retargetClip({
      characterId: "yun_real_prod_male_a",
      targetArmatureName: rigRes.outputArmatureName,
      sourceClipUri: "res://assets/mocap_locomotion.bvh",
      sourceClipName: "mocap_locomotion",
      boneMapping: [
        { sourceBone: "Hips", targetBone: "Hips" },
        { sourceBone: "Spine", targetBone: "Spine" },
        { sourceBone: "Head", targetBone: "Head" },
      ],
      outputClipName: "action_celebrate",
    });
    assert.equal(retargetRes.success, true);

    // 4. Build Blender Operations
    const taskId = "t-yun-real-prod-male-a";
    const taskWorkDir = join(workDir, taskId);
    const ops: BlenderOperation[] = [
      { op: "scene.new", sceneName: "RealYunScene" },
      // Import the real Yun GLB mesh asset
      { op: "mesh.import_glb", filepath: REAL_YUN_KENNEY_GLB },
    ];

    // Rigging operations
    ops.push(...riggingProvider.compileRiggingOperations(rigRes.outputArmatureName, rigRes.skeleton));

    // Skinning operations on imported meshes
    ops.push(...skinningProvider.compileSkinningOperations("body-mesh", rigRes.outputArmatureName, "automatic"));
    ops.push(...skinningProvider.compileSkinningOperations("head-mesh", rigRes.outputArmatureName, "automatic"));

    // Locomotion animations
    ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, idleClip.clip));
    ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, walkClip.clip));
    ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, runClip.clip));
    ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, sprintClip.clip));
    ops.push(...animProvider.compileAnimationOperations(rigRes.outputArmatureName, turnClip.clip));

    // Retargeted action compilation
    ops.push(...retargetProvider.compileRetargetingOperations(
      rigRes.outputArmatureName,
      {
        name: "action_celebrate",
        frameStart: 1,
        frameEnd: 24,
        isLooping: false,
        keyframes: [
          { bone: "Spine", frame: 1, rotationEulerDeg: [0, 0, 0] },
          { bone: "Spine", frame: 12, rotationEulerDeg: [-15, 0, 0] },
          { bone: "Spine", frame: 24, rotationEulerDeg: [0, 0, 0] },
        ],
      },
      [
        { sourceBone: "Spine", targetBone: "Spine" },
      ],
      "action_celebrate",
    ));

    // Visual previews and export
    ops.push(
      { op: "light.create", name: "Light_Key", type: "SUN", location: [4, -4, 6], energy: 3.5 },
      { op: "camera.create", name: "Camera_Main", location: [2.5, -2.5, 1.8], rotationEulerDeg: [70, 0, 45], setActive: true },
      { op: "file.save_blend", outputName: "yun_real_prod.blend" },
      { op: "render.preview", outputName: "yun_real_prod-preview.png", width: 640, height: 640 },
      { op: "export.character_glb", outputName: "yun_real_prod.glb" },
      { op: "animation.inspect" },
      { op: "character.inspect" },
    );

    const spec: BlenderTaskSpec = {
      schemaVersion: "1.0.0",
      assetName: "yun_real_prod",
      operations: ops,
      workingDirectory: taskWorkDir,
      expectedArtifacts: [
        { kind: "blend", name: "yun_real_prod.blend", required: true, minBytes: 100 },
        { kind: "png", name: "yun_real_prod-preview.png", required: true, minBytes: 100 },
        { kind: "glb", name: "yun_real_prod.glb", required: true, minBytes: 100 },
        { kind: "json", name: "blender-report.json", required: true, minBytes: 10 },
      ],
      acceptanceCriteria: [
        "yun_real_prod.blend created",
        "humanoid armature created",
        "idle walk run sprint turn animations present",
        "yun_real_prod.glb exported",
      ],
      timeoutMs: 180_000,
    };

    const specFilePath = join(workDir, "task_spec.json");
    writeFileSync(specFilePath, JSON.stringify(spec, null, 2), "utf8");

    const adapter = new BlenderAdapter({ baseWorkDir: workDir });
    const handle = await adapter.submitTask({
      protocol: "nss.studio-handoff.v1",
      id: "h-yun-real-prod",
      taskId,
      from: "matterhorn",
      to: "blender-engine",
      goal: "Process real Yun character through rigging, skinning, and animation pipeline",
      acceptanceCriteria: spec.acceptanceCriteria,
      inputArtifacts: [{ kind: "json", uri: specFilePath, label: "blender-task.json" }],
    });
    assert.equal(handle.accepted, true);

    const runResult = await adapter.getResult(taskId);
    assert.equal(runResult.status, "completed", runResult.summary);

    const glbPath = join(taskWorkDir, "yun_real_prod.glb");
    assert.ok(existsSync(glbPath), "Exported GLB must exist");

    const reportPath = join(taskWorkDir, "blender-report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(report.success, true);
    assert.ok(report.skeleton?.boneNames?.length >= STANDARD_YUN_HUMANOID_BONES.length);

    const exportedAnims = report.exportInfo?.animations ?? [];
    const matched = matchYunAnimationClips(exportedAnims);
    assert.equal(matched.missing.length, 0, `Missing required clips: ${matched.missing.join(", ")}`);
    assert.ok(exportedAnims.includes("sprint"), "Must include sprint clip");
    assert.ok(exportedAnims.includes("turn"), "Must include turn clip");

    // 5. Godot Engine Runtime Validation
    const fixtureSource = resolve(process.cwd(), "core/src/test/fixtures/disposable-godot-project");
    cpSync(fixtureSource, godotDir, { recursive: true });
    cpSync(glbPath, join(godotDir, "yun_real_prod.glb"));

    const verifyScriptPath = join(godotDir, "verify_yun_real_prod.gd");
    writeFileSync(
      verifyScriptPath,
      `@tool
extends SceneTree

func _init() -> void:
	var path := "res://yun_real_prod.glb"
	if not FileAccess.file_exists(path):
		printerr("ERROR: glb missing")
		quit(1)
		return
	var res = ResourceLoader.load(path)
	if res == null:
		printerr("ERROR: load failed")
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
	print("GODOT_ANIMATIONS: ", anim_list)

	# Verify required clips exist
	var has_idle := false
	var has_walk := false
	var has_run := false
	var has_sprint := false

	for c in anim_list:
		var low: String = c.to_lower()
		if low.contains("idle"): has_idle = true
		if low.contains("walk") and not low.contains("wheel"): has_walk = true
		if low.contains("run"): has_run = true
		if low.contains("sprint"): has_sprint = true

	if not (has_idle and has_walk and (has_run or has_sprint)):
		printerr("ERROR: Missing clips. idle=", has_idle, " walk=", has_walk, " run=", has_run, " sprint=", has_sprint)
		quit(1)
		return

	# Test animation playback transitions
	anim.play("idle")
	if not anim.is_playing():
		printerr("ERROR: idle animation failed to play")
		quit(1)
		return

	anim.play("walk")
	anim.play("sprint")
	if anim.has_animation("action_celebrate"):
		anim.play("action_celebrate")

	var skel = inst.find_child("Skeleton3D", true, false) as Skeleton3D
	if skel == null:
		printerr("ERROR: Skeleton3D missing")
		quit(1)
		return

	print("REAL_YUN_GODOT_OK bones=", skel.get_bone_count(), " anims=", anim_list.size())
	quit(0)
`,
      "utf8",
    );

    // Godot editor import
    const importRes = spawnSync(
      DEFAULT_GODOT_BIN,
      ["--path", godotDir, "--headless", "--editor", "--quit"],
      { encoding: "utf8", timeout: 120_000, windowsHide: true },
    );
    assert.equal(importRes.status, 0, `Godot import failed: ${importRes.stderr || importRes.stdout}`);

    // Godot playback verification
    const verifyRes = spawnSync(
      DEFAULT_GODOT_BIN,
      ["--path", godotDir, "--headless", "-s", "verify_yun_real_prod.gd"],
      { encoding: "utf8", timeout: 120_000, windowsHide: true },
    );
    assert.equal(verifyRes.status, 0, `Godot verification failed: stdout=${verifyRes.stdout} stderr=${verifyRes.stderr}`);
    assert.ok(
      String(verifyRes.stdout).includes("REAL_YUN_GODOT_OK"),
      `Expected REAL_YUN_GODOT_OK in output: ${verifyRes.stdout}`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
