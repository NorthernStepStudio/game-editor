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

export interface YunGameplayCameraReport {
  readonly ok: boolean;
  readonly screenshots?: readonly string[];
  readonly teamVariants?: readonly { readonly label: string; readonly color: string; readonly shot?: string }[];
  readonly silhouetteNotes?: readonly string[];
  readonly error?: string;
}

/**
 * Disposable gameplay-camera + team-color probe approximating YunCamRig framing.
 * Captures standing / walk / run frames and two TeamShirt color variants.
 */
export function writeYunGameplayCameraProbe(projectDir: string, assetFileName: string): {
  treeScriptPath: string;
  evidencePath: string;
} {
  const treeScriptPath = join(projectDir, "verify_yun_gameplay_camera.gd");
  const evidencePath = join(projectDir, "flyrail-yun-gameplay-camera.json");

  const script = `extends SceneTree
## Gameplay-camera readability + MAT_TeamShirt team-color variants (disposable).

const WRAPPER_SCALE := 1.2
const TEAM_A := Color(0.95, 0.72, 0.18, 1.0)
const TEAM_B := Color(0.2, 0.45, 0.95, 1.0)

func _initialize() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(960, 540))
	call_deferred("_run")

func _run() -> void:
	var report = {
		"ok": false,
		"screenshots": [],
		"teamVariants": [],
		"silhouetteNotes": [],
	}
	var world = Node3D.new()
	world.name = "GameplayProbeWorld"
	root.add_child(world)

	var light = DirectionalLight3D.new()
	light.name = "Sun"
	light.rotation_degrees = Vector3(-48, 35, 0)
	light.light_energy = 1.15
	world.add_child(light)

	var fill = OmniLight3D.new()
	fill.position = Vector3(-2.5, 2.2, 1.5)
	fill.light_energy = 0.55
	world.add_child(fill)

	var ground = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(18, 24)
	ground.mesh = plane
	var gmat = StandardMaterial3D.new()
	gmat.albedo_color = Color(0.55, 0.42, 0.28, 1)
	ground.material_override = gmat
	world.add_child(ground)

	var host = Node3D.new()
	host.name = "YunHost"
	host.position = Vector3(0, 0, 0)
	world.add_child(host)

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

	# Approximate YunCamRig: elevated 3/4, FOV 46, pitch ~42 looking at player.
	var cam_rig = Node3D.new()
	cam_rig.name = "CamRig"
	world.add_child(cam_rig)
	var cam = Camera3D.new()
	cam.name = "Camera3D"
	cam.fov = 46.0
	cam.near = 0.12
	cam.far = 120.0
	cam_rig.add_child(cam)
	cam_rig.position = Vector3(0.0, 4.2, 6.4)
	cam_rig.look_at(Vector3(0.0, 0.9, 0.0), Vector3.UP)
	cam.current = true

	var anim = inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	var idle := ""
	var walk := ""
	var run := ""
	if anim != null:
		for clip in anim.get_animation_list():
			var low := str(clip).to_lower()
			if idle == "" and low.contains("idle"):
				idle = str(clip)
			elif walk == "" and low.contains("walk") and not low.contains("wheel"):
				walk = str(clip)
			elif run == "" and (low.contains("run") or low.contains("sprint")):
				run = str(clip)
	if run == "":
		run = walk
	if walk == "":
		walk = idle

	await process_frame
	await process_frame

	var shots: Array = []
	if anim != null and idle != "":
		anim.play(idle)
		anim.advance(0.2)
		await process_frame
		shots.append(_shot("standing-idle"))
	if anim != null and walk != "":
		anim.play(walk)
		anim.advance(0.35)
		await process_frame
		shots.append(_shot("walk-mid"))
	if anim != null and run != "":
		anim.play(run)
		anim.advance(0.25)
		await process_frame
		shots.append(_shot("run-mid"))

	_apply_team_shirt(inst, TEAM_A)
	await process_frame
	var shot_a = _shot("team-a-mango")
	report["teamVariants"].append({"label": "team_a", "color": "#f2b82e", "shot": shot_a})
	shots.append(shot_a)

	_apply_team_shirt(inst, TEAM_B)
	await process_frame
	var shot_b = _shot("team-b-blue")
	report["teamVariants"].append({"label": "team_b", "color": "#3373f2", "shot": shot_b})
	shots.append(shot_b)

	var top_y := -INF
	var bot_y := INF
	for raw in inst.find_children("*", "MeshInstance3D", true, false):
		var mi := raw as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		var aabb: AABB = mi.get_aabb()
		var gt: Transform3D = mi.global_transform
		for corner in [aabb.position, aabb.end]:
			var p: Vector3 = gt * corner
			top_y = maxf(top_y, p.y)
			bot_y = minf(bot_y, p.y)
	report["silhouetteNotes"] = [
		"aabb_top_y=" + str(top_y),
		"aabb_bot_y=" + str(bot_y),
		"feet_near_ground=" + str(absf(bot_y) < 0.35),
		"head_above_torso=" + str(top_y > 1.2),
	]
	report["screenshots"] = shots
	report["ok"] = shots.size() >= 3 and top_y > 1.2 and absf(bot_y) < 0.45
	if not report["ok"]:
		report["error"] = "silhouette or screenshot checks failed"
		_write(report)
		quit(1)
		return
	_write(report)
	print("FLYRAIL_YUN_GAMEPLAY_CAMERA_OK shots=", shots.size())
	quit(0)

func _apply_team_shirt(root_node: Node, color: Color) -> void:
	for raw in root_node.find_children("*", "MeshInstance3D", true, false):
		var mi := raw as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		for si in range(mi.mesh.get_surface_count()):
			var mat: Material = mi.get_active_material(si)
			if mat == null:
				continue
			var mat_name := _mat_name(mat)
			if not mat_name.to_lower().contains("teamshirt"):
				continue
			var std := mat as StandardMaterial3D
			if std == null:
				continue
			var dup := std.duplicate() as StandardMaterial3D
			if dup == null:
				continue
			dup.albedo_color = color
			mi.set_surface_override_material(si, dup)

func _mat_name(mat: Material) -> String:
	if mat.resource_name != "":
		return String(mat.resource_name)
	var path := String(mat.resource_path)
	if path != "":
		return path.get_file()
	return "mat"

func _shot(label: String) -> String:
	var vp := root.get_viewport()
	if vp == null:
		return ""
	var img: Image = vp.get_texture().get_image()
	if img == null:
		return ""
	var path := "res://gameplay-%s.png" % label
	img.save_png(path)
	print("SHOT ", path)
	return path

func _write(report: Dictionary) -> void:
	var f = FileAccess.open("res://flyrail-yun-gameplay-camera.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
`;

  writeFileSync(treeScriptPath, script, "utf8");
  return { treeScriptPath, evidencePath };
}

export function runYunGameplayCameraProbe(
  projectDir: string,
  godotBin = DEFAULT_GODOT_BIN,
): YunGameplayCameraReport {
  if (!existsSync(godotBin)) {
    throw new SpecialistError("GODOT_UNAVAILABLE", `Godot binary not found: ${godotBin}`);
  }
  // Visible window so Viewport texture captures succeed (same pattern as Yun live UI walk).
  const res = spawnSync(
    godotBin,
    ["--path", projectDir, "-s", "verify_yun_gameplay_camera.gd"],
    { encoding: "utf8", timeout: 180_000, windowsHide: true },
  );
  const evidencePath = join(projectDir, "flyrail-yun-gameplay-camera.json");
  if (!existsSync(evidencePath)) {
    throw new SpecialistError(
      "TEST_FAILED",
      `Gameplay camera probe produced no evidence: ${res.stderr || res.stdout || `exit ${res.status}`}`,
    );
  }
  const report = JSON.parse(readFileSync(evidencePath, "utf8")) as YunGameplayCameraReport;
  if (res.status !== 0 || !report.ok) {
    throw new SpecialistError(
      "TEST_FAILED",
      `Gameplay camera probe failed: ${report.error ?? res.stderr ?? `exit ${res.status}`}`,
    );
  }
  return report;
}
