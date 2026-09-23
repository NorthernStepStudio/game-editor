/**
 * Disposable Yun-compatible wrapper + motion validation for Blender character candidates.
 * Mirrors YunMiniFigure clip binding / host scale without modifying production Yun assets.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SpecialistError } from "../types.js";
import { matchYunAnimationClips } from "../blender/yunCharacterContract.js";
import { DEFAULT_GODOT_BIN } from "./flyrailAssetValidation.js";

export interface YunWrapperMotionReport {
  readonly ok: boolean;
  readonly wrapperScale: number;
  readonly childName?: string;
  readonly hasSkeleton3D?: boolean;
  readonly hasAnimationPlayer?: boolean;
  readonly animationNames?: readonly string[];
  readonly matched?: { idle?: string; walk?: string; sprint?: string };
  readonly motionSequence?: readonly string[];
  readonly aabbHeight?: number;
  readonly error?: string;
}

/** Write Yun-style wrapper + idle→walk→run→idle motion probe scripts into a disposable project. */
export function writeYunWrapperMotionProbe(projectDir: string, assetFileName: string): {
  treeScriptPath: string;
  evidencePath: string;
} {
  const treeScriptPath = join(projectDir, "verify_yun_wrapper_motion.gd");
  const evidencePath = join(projectDir, "flyrail-yun-wrapper-motion.json");

  const script = `extends SceneTree
## Disposable YunMiniFigure-compatible wrapper + motion probe (production Yun untouched).

const WRAPPER_SCALE := 1.2

func _init():
	var report = {
		"ok": false,
		"wrapperScale": WRAPPER_SCALE,
		"animationNames": [],
		"motionSequence": [],
		"hasSkeleton3D": false,
		"hasAnimationPlayer": false,
	}
	var host = Node3D.new()
	host.name = "YunHost"
	# Host owns collision in production; keep a Marker3D stand-in only.
	var marker = Marker3D.new()
	marker.name = "CollisionHostMarker"
	host.add_child(marker)

	var glb_path = "res://${assetFileName}"
	if not FileAccess.file_exists(glb_path):
		report["error"] = "GLB missing"
		_write(report)
		quit(1)
		return
	var packed = ResourceLoader.load(glb_path)
	if packed == null:
		report["error"] = "ResourceLoader failed"
		_write(report)
		quit(1)
		return
	var inst = packed.instantiate() as Node3D
	if inst == null:
		report["error"] = "instantiate failed"
		_write(report)
		quit(1)
		return
	inst.name = "Kenney"
	inst.scale = Vector3.ONE * WRAPPER_SCALE
	host.add_child(inst)
	report["childName"] = inst.name

	var skeleton = inst.find_child("Skeleton3D", true, false)
	report["hasSkeleton3D"] = skeleton != null
	var anim = inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	report["hasAnimationPlayer"] = anim != null
	var names: Array = []
	if anim != null:
		for clip in anim.get_animation_list():
			names.append(str(clip))
	report["animationNames"] = names

	# AABB height for scale comparison vs procedural stub (~1.7) * scale.
	var meshes = inst.find_children("*", "MeshInstance3D", true, false)
	var top_y := -INF
	var bot_y := INF
	for raw in meshes:
		var mi := raw as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		var aabb: AABB = mi.get_aabb()
		var gt: Transform3D = mi.global_transform
		var corners: Array[Vector3] = [
			aabb.position,
			aabb.position + Vector3(aabb.size.x, 0, 0),
			aabb.position + Vector3(0, aabb.size.y, 0),
			aabb.position + Vector3(0, 0, aabb.size.z),
			aabb.end,
		]
		for corner in corners:
			var p: Vector3 = gt * corner
			top_y = maxf(top_y, p.y)
			bot_y = minf(bot_y, p.y)
	if not is_inf(top_y) and not is_inf(bot_y):
		report["aabbHeight"] = top_y - bot_y

	var idle := ""
	var walk := ""
	var sprint := ""
	for clip in names:
		var low := str(clip).to_lower()
		if idle == "" and low.contains("idle"):
			idle = str(clip)
		elif walk == "" and low.contains("walk") and not low.contains("wheel"):
			walk = str(clip)
		elif sprint == "" and (low.contains("sprint") or low.contains("run")):
			sprint = str(clip)
	if sprint == "":
		sprint = walk
	if walk == "":
		walk = idle

	var seq: Array = []
	if anim == null or idle == "" or walk == "" or sprint == "":
		report["error"] = "Missing AnimationPlayer or required clips"
		report["matched"] = {"idle": idle, "walk": walk, "sprint": sprint}
		_write(report)
		quit(1)
		return

	for clip in [idle, walk, sprint, idle]:
		anim.play(clip)
		seq.append(str(clip) + "@" + str(anim.current_animation))
		# Advance a few frames of sim without display.
		for i in range(4):
			anim.advance(0.05)
	report["motionSequence"] = seq
	report["matched"] = {"idle": idle, "walk": walk, "sprint": sprint}
	report["ok"] = true
	_write(report)
	print("FLYRAIL_YUN_WRAPPER_MOTION_OK idle=", idle, " walk=", walk, " run=", sprint)
	quit(0)

func _write(report: Dictionary) -> void:
	var f = FileAccess.open("res://flyrail-yun-wrapper-motion.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
`;

  writeFileSync(treeScriptPath, script, "utf8");
  return { treeScriptPath, evidencePath };
}

export function runYunWrapperMotionProbe(projectDir: string, godotBin = DEFAULT_GODOT_BIN): YunWrapperMotionReport {
  if (!existsSync(godotBin)) {
    throw new SpecialistError("GODOT_UNAVAILABLE", `Godot binary not found: ${godotBin}`);
  }
  const res = spawnSync(
    godotBin,
    ["--path", projectDir, "--headless", "-s", "verify_yun_wrapper_motion.gd"],
    { encoding: "utf8", timeout: 120_000, windowsHide: true },
  );
  const evidencePath = join(projectDir, "flyrail-yun-wrapper-motion.json");
  if (!existsSync(evidencePath)) {
    throw new SpecialistError(
      "TEST_FAILED",
      `Yun wrapper motion probe produced no evidence: ${res.stderr || res.stdout || `exit ${res.status}`}`,
    );
  }
  const report = JSON.parse(readFileSync(evidencePath, "utf8")) as YunWrapperMotionReport;
  if (res.status !== 0 || !report.ok) {
    throw new SpecialistError(
      "TEST_FAILED",
      `Yun wrapper motion probe failed: ${report.error ?? res.stderr ?? `exit ${res.status}`}`,
    );
  }
  const matched = matchYunAnimationClips(report.animationNames ?? []);
  if (matched.missing.length > 0) {
    throw new SpecialistError(
      "VALIDATION_FAILED",
      `Yun wrapper missing animations: ${matched.missing.join(",")}`,
    );
  }
  return { ...report, matched };
}
