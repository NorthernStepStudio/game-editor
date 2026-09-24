/** Full PC gate for the four Yun Matterhorn environments. */
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { BlenderAdapter, buildYunEnvironmentTaskSpec, findBlenderExecutable, runYunEnvironmentVisualSanity, resolveYunEnvironmentSpecFromGoal, YUN_ENVIRONMENT_SPECS, validateYunEnvironmentSpec } from "../studio/adapters/blender/index.js";
import { DEFAULT_GODOT_BIN, FlyrailClient, runGodotEditorImport } from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

const EXPECTED_ASSETS = [
  "yun_street_block_calle_v1",
  "yun_street_block_malecon_v1",
  "yun_street_block_parque_v1",
  "yun_street_block_noche_v1",
];

function requiredFlyrailRoot(): string {
  const root = process.env.FLYRAIL_REPO_ROOT?.trim();
  assert.ok(root && existsSync(join(root, "games", "yun", "scripts", "court.gd")), "FLYRAIL_REPO_ROOT must point to the Flyrail Yun production repository");
  return resolve(root);
}

function verifyProductionContracts(flyrailRoot: string): void {
  const gameRoot = join(flyrailRoot, "games", "yun");
  const courtPath = join(gameRoot, "scripts", "court.gd");
  const court = readFileSync(courtPath, "utf8");
  const committedCourt = requireGitHeadFile(flyrailRoot, "games/yun/scripts/court.gd");
  assert.equal(court.replace(/\r\n/g, "\n"), committedCourt.replace(/\r\n/g, "\n"), "authoritative YunCourt source must remain unchanged");
  for (const [name, value] of [
    ["COURT_LEFT", "160.0"], ["COURT_RIGHT", "992.0"], ["COURT_CENTER_X", "576.0"],
    ["HEAD_Y", "70.0"], ["FAR_Y", "560.0"],
  ]) assert.ok(court.includes(`const ${name} := ${value}`), `${name} must retain its production value`);
  assert.ok(court.includes("const TUBE_Y: Array[float] = [190.0, 320.0, 450.0]"), "tube lanes must retain their production values");
  assert.match(court, /func attacker_spawn\(slot: int\) -> Vector2:\s+var offsets: Array\[float\] = \[-100\.0, -55\.0, 100\.0\]\s+return Vector2\(COURT_CENTER_X \+ offsets\[slot\], HEAD_Y - 48\.0\)/, "attacker spawn offsets and head position must remain unchanged");
  assert.match(court, /func defender_spawn\(index: int\) -> Vector2:\s+return tube_center\(index\)/, "defender spawns must remain on their production tube lanes");
  assert.match(court, /const TAG_LINE_SLACK := TUBE_HALF/);
  assert.match(court, /const TAG_REACH := 52\.0/);
  assert.match(court, /func is_on_defender_lane\(pos: Vector2, tube_index: int, slack := TAG_LINE_SLACK\) -> bool:\s+return absf\(pos\.y - TUBE_Y\[tube_index\]\) <= slack and pos\.x >= COURT_LEFT - 8\.0 and pos\.x <= COURT_RIGHT \+ 8\.0/);
  assert.match(court, /func path_crosses_any_tube\(a: Vector2, b: Vector2\) -> bool:/);

  const settings = readFileSync(join(gameRoot, "scripts", "game_settings.gd"), "utf8");
  const streetKit = readFileSync(join(gameRoot, "scripts", "street_kit.gd"), "utf8");
  const menu = readFileSync(join(gameRoot, "scripts", "main_menu.gd"), "utf8");
  const map = readFileSync(join(gameRoot, "scripts", "yun_map.gd"), "utf8");
  assert.match(settings, /var environment_provider: String = "kenney"/, "Kenney must remain the default");
  assert.match(settings, /"kenney", "matterhorn"/, "provider selection must be bounded and persisted");
  assert.match(streetKit, /var asset_names := \[/);
  for (const assetId of EXPECTED_ASSETS) assert.ok(streetKit.includes(assetId), `production map lookup must include ${assetId}`);
  assert.match(streetKit, /environment_provider\(\) == "matterhorn"/);
  assert.match(streetKit, /Missing or invalid opt-in assets fall back to the selected map's Kenney dressing/);
  assert.match(menu, /YunMap\.display_name\(_Cfg\.map_id\(\)\)/, "menu must show the selected map beside its provider");
  assert.match(menu, /set_environment_provider\(next\)/);
  assert.match(map, /static func apply_world/);
}

function requireGitHeadFile(repo: string, path: string): string {
  const result = spawnSync("git", ["show", `HEAD:${path}`], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, `could read committed ${path}`);
  return String(result.stdout);
}

function createDisposableProject(sourceGame: string, destination: string, mapId: number, matterhorn: boolean): void {
  cpSync(sourceGame, destination, {
    recursive: true,
    filter: (source) => {
      const rel = relative(sourceGame, source).replace(/\\/g, "/");
      return rel !== "scripts/credits_copy.gd" && !/(^|\/)(\.godot|\.flyrail|build|multiplayer-relay|tests|_dl)(\/|$)/i.test(rel);
    },
  });
  const settingsPath = join(destination, "scripts", "game_settings.gd");
  const originalSettings = readFileSync(settingsPath, "utf8");
  const newline = originalSettings.includes("\r\n") ? "\r\n" : "\n";
  let settings = originalSettings;
  settings = settings.replace('var environment_provider: String = "kenney"', `var environment_provider: String = "${matterhorn ? "matterhorn" : "kenney"}"`);
  settings = settings.replace(`\tload_settings()${newline}`, `\tload_settings()${newline}\tmap_id = ${mapId}${newline}\tenvironment_provider = "${matterhorn ? "matterhorn" : "kenney"}"${newline}`);
  assert.ok(settings.includes(`\tmap_id = ${mapId}`), "disposable project map was configured");
  assert.ok(settings.includes(`\tenvironment_provider = "${matterhorn ? "matterhorn" : "kenney"}"`), "disposable project provider was configured");
  writeFileSync(settingsPath, settings, "utf8");
  mkdirSync(join(destination, "tests"), { recursive: true });
  writeFileSync(join(destination, "tests", "yun_environment_set_probe.gd"), runtimeProbe(mapId, matterhorn), "utf8");
  const scenePath = join(destination, "scenes", "match.tscn");
  let scene = readFileSync(scenePath, "utf8");
  const header = scene.match(/\[gd_scene load_steps=(\d+) format=3\]/);
  assert.ok(header, "production match scene has a Godot 4 scene header");
  scene = scene.replace(header![0], `[gd_scene load_steps=${Number(header![1]) + 1} format=3]`);
  assert.ok(scene.includes('[ext_resource type="Script" path="res://scripts/sfx.gd" id="7"]'), "production match scene has expected script anchors");
  scene = scene.replace('[ext_resource type="Script" path="res://scripts/sfx.gd" id="7"]', '[ext_resource type="Script" path="res://scripts/sfx.gd" id="7"]\n[ext_resource type="Script" path="res://tests/yun_environment_set_probe.gd" id="99"]');
  scene += '\n[node name="EnvironmentSetGateProbe" type="Node" parent="."]\nscript = ExtResource("99")\n';
  writeFileSync(scenePath, scene, "utf8");
}

function runtimeProbe(mapId: number, matterhorn: boolean): string {
  return `extends Node

const MAP_ID := ${mapId}
const EXPECT_MATTERHORN := ${matterhorn ? "true" : "false"}
const REPORT_PATH := "res://tests/yun_environment_runtime.json"

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	var started := Time.get_ticks_msec()
	await get_tree().create_timer(1.0).timeout
	var game := get_parent() as YunMatch
	var court = game.get_node("Court")
	var env_root := court.get_node_or_null("MatterhornEnvironment")
	var mesh_count := 0 if env_root == null else env_root.find_children("*", "MeshInstance3D", true, false).size()
	var imported_node_count := 0 if env_root == null else env_root.find_children("*", "Node", true, false).size() + 1
	var geometry_ok := YunCourt.COURT_LEFT == 160.0 and YunCourt.COURT_RIGHT == 992.0 and YunCourt.COURT_CENTER_X == 576.0 and YunCourt.HEAD_Y == 70.0 and YunCourt.FAR_Y == 560.0 and YunCourt.TUBE_Y == [190.0, 320.0, 450.0]
	var provider_ok := (env_root != null) == EXPECT_MATTERHORN
	var route := {"walked": false, "crossed_tube": false, "turned_at_turn": false, "returned_to_yun": false}
	var screenshots: Array[String] = []
	var tag_ok := false
	var tag_overlap_count := 0
	var tag_can_resolve := false
	game.human_attacking = false
	game._apply_roles()
	game._begin_rush()
	if EXPECT_MATTERHORN:
		for d in game.defenders:
			d.set_process(false)
			d.set_physics_process(false)
		for a in game.attackers:
			a.set_attack_job(YunAttacker.AttackJob.RUN)
	game._refresh_hud()
	await get_tree().create_timer(0.4).timeout
	var visible_players := 0
	for actor in game.attackers + game.defenders:
		if actor.active and actor.visible:
			visible_players += 1
	_shot("idle-six-player", screenshots)
	var camera: Camera3D = game.get_node("CamRig/Camera3D")
	var viewport_rect := Rect2(Vector2.ZERO, get_viewport().get_visible_rect().size)
	var visible_meshes := 0
	if env_root:
		for mesh in env_root.find_children("*", "MeshInstance3D", true, false):
			var pixel := camera.unproject_position(mesh.global_position)
			if not camera.is_position_behind(mesh.global_position) and viewport_rect.has_point(pixel):
				visible_meshes += 1
	var previous: Dictionary = {}
	if EXPECT_MATTERHORN:
		for step in range(100):
			await get_tree().create_timer(0.22).timeout
			for i in game.attackers.size():
				var actor = game.attackers[i]
				var pos: Vector2 = court.to_planar(actor.global_position)
				var key := str(i)
				if previous.has(key):
					var old: Vector2 = previous[key]
					if old.distance_to(pos) > 2.0:
						route.walked = true
					if court.path_crosses_any_tube(old, pos):
						route.crossed_tube = true
				previous[key] = pos
				if actor.has_turned:
					route.turned_at_turn = true
					if court.in_head_zone(pos):
						route.returned_to_yun = true
			if route.crossed_tube and screenshots.find("res://tests/tube-crossing.png") < 0:
				_shot("tube-crossing", screenshots)
			if route.turned_at_turn and screenshots.find("res://tests/turn.png") < 0:
				_shot("turn", screenshots)
			if route.returned_to_yun and screenshots.find("res://tests/return.png") < 0:
				_shot("return", screenshots)
		game.human_attacking = false
		game._apply_roles()
		game._begin_rush()
		for actor in game.attackers + game.defenders:
			actor.set_process(false)
			actor.set_physics_process(false)
		var runner = game.attackers[0]
		var defender = game.defenders[0]
		var point: Vector2 = court.tube_center(0)
		runner.active = true
		runner.tagged = false
		runner.safe_until_msec = 0
		runner.hop_until_msec = 0
		# Move the live CharacterBody3D from outside into the production Area3D so
		# Godot's physics server can deliver the connected body_entered signal.
		runner.global_position = court.to_world(point + Vector2(0.0, -100.0))
		defender.active = true
		defender.global_position = court.to_world(point)
		await get_tree().physics_frame
		await get_tree().physics_frame
		runner.global_position = court.to_world(point)
		await get_tree().physics_frame
		await get_tree().physics_frame
		tag_overlap_count = defender.tag_area.get_overlapping_bodies().size()
		tag_can_resolve = defender._can_tag(runner)
		defender._check_tags()
		await get_tree().process_frame
		tag_ok = runner.tagged and game.phase == YunMatch.Phase.RESOLVE and game.human_attacking
		_shot("tag-role-swap", screenshots)
	var report := {"ok": geometry_ok and provider_ok and visible_players == 6 and (not EXPECT_MATTERHORN or (mesh_count > 0 and visible_meshes > 0 and route.walked and route.crossed_tube and route.turned_at_turn and route.returned_to_yun and tag_overlap_count > 0 and tag_ok)), "mapId": MAP_ID, "environmentOptIn": EXPECT_MATTERHORN, "environmentRootPresent": env_root != null, "environmentMeshCount": mesh_count, "importedNodeCount": imported_node_count, "cameraVisibleEnvironmentMeshes": visible_meshes, "runtimeObservationMs": Time.get_ticks_msec() - started, "courtGeometryInvariant": geometry_ok, "playerCount": visible_players, "route": route, "tagGameplayOk": tag_ok, "tagOverlapCount": tag_overlap_count, "tagCanResolve": tag_can_resolve, "phaseAfterTag": game.phase, "cameraCurrent": camera.current, "screenshots": screenshots}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(report))
		file.close()
	print("YUN_ENVIRONMENT_SET_RUNTIME_REPORT ", JSON.stringify(report))

func _shot(label: String, screenshots: Array[String]) -> void:
	var image := get_viewport().get_texture().get_image()
	if image:
		var path := "res://tests/%s.png" % label
		image.save_png(ProjectSettings.globalize_path(path))
		screenshots.append(path)
`;
}

function createMapSwitchProject(sourceGame: string, destination: string): void {
  cpSync(sourceGame, destination, {
    recursive: true,
    filter: (source) => {
      const rel = relative(sourceGame, source).replace(/\\/g, "/");
      return rel !== "scripts/credits_copy.gd" && !/(^|\/)(\.godot|\.flyrail|build|multiplayer-relay|tests|_dl)(\/|$)/i.test(rel);
    },
  });
  const probePath = join(destination, "tests", "yun_environment_switch_probe.gd");
  mkdirSync(join(destination, "tests"), { recursive: true });
  writeFileSync(probePath, mapSwitchProbe(), "utf8");
  // Flyrail's lightweight static validator misreads the production triple-quoted credits string.
  // Credits are unrelated to map selection, so the disposable menu gets an API-compatible stub.
  writeFileSync(join(destination, "scripts", "credits_copy.gd"), "extends Object\nconst MENU := \"\"\n", "utf8");
  const scenePath = join(destination, "scenes", "main_menu.tscn");
  let scene = readFileSync(scenePath, "utf8");
  scene = scene.replace("[gd_scene load_steps=3 format=3]", "[gd_scene load_steps=4 format=3]");
  scene = scene.replace('[ext_resource type="Texture2D" uid="uid://vxryjeuti1js" path="res://icon.svg" id="2"]', '[ext_resource type="Texture2D" uid="uid://vxryjeuti1js" path="res://icon.svg" id="2"]\n[ext_resource type="Script" path="res://tests/yun_environment_switch_probe.gd" id="99"]');
  scene += '\n[node name="EnvironmentSwitchGateProbe" type="Node" parent="."]\nscript = ExtResource("99")\n';
  writeFileSync(scenePath, scene, "utf8");
}

function mapSwitchProbe(): string {
  return `extends Node

const _Cfg = preload("res://scripts/yun_cfg.gd")
const REPORT_PATH := "res://tests/yun_environment_switch_runtime.json"
const EXPECTED_ASSETS := ["yun_street_block_calle_v1", "yun_street_block_malecon_v1", "yun_street_block_parque_v1", "yun_street_block_noche_v1"]

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	var menu = get_parent()
	var results: Array[Dictionary] = []
	var stale_courts_cleared := true
	var unique_environments := true
	_Cfg.set_environment_provider("kenney")
	menu._toggle_environment_provider()
	for map_id in range(4):
		var previous_court = menu._stage_court
		menu._pick_map(map_id)
		await get_tree().process_frame
		await get_tree().process_frame
		var court = menu._stage_court
		var environment = court.get_node_or_null("MatterhornEnvironment")
		var meshes: int = 0 if environment == null else environment.find_children("*", "MeshInstance3D", true, false).size()
		stale_courts_cleared = stale_courts_cleared and not is_instance_valid(previous_court)
		var roots: Array[Node] = court.find_children("MatterhornEnvironment", "Node3D", true, false)
		unique_environments = unique_environments and roots.size() == 1
		var expected_provider_text: bool = menu._environment_provider_button.text.contains(YunMap.display_name(map_id)) and menu._environment_provider_button.text.contains("Matterhorn")
		results.append({"mapId": map_id, "assetId": EXPECTED_ASSETS[map_id], "environmentRoot": environment != null, "meshCount": meshes, "menuShowsMapAndProvider": expected_provider_text})
		if environment == null or meshes == 0 or not expected_provider_text:
			break
	_Cfg.set_map_id(3)
	var last_court = menu._stage_court
	menu._toggle_environment_provider()
	await get_tree().process_frame
	await get_tree().process_frame
	var fallback_environment = menu._stage_court.get_node_or_null("MatterhornEnvironment")
	var fallback_meshes: int = menu._stage_court.find_children("*", "MeshInstance3D", true, false).size()
	var fallback_ok: bool = fallback_environment == null and fallback_meshes > 0 and _Cfg.environment_provider() == "kenney" and not is_instance_valid(last_court)
	var all_maps_ok := results.size() == 4 and results.all(func(item: Dictionary) -> bool: return item["environmentRoot"] and item["meshCount"] > 0 and item["menuShowsMapAndProvider"])
	var report := {"ok": all_maps_ok and stale_courts_cleared and unique_environments and fallback_ok, "maps": results, "staleCourtsCleared": stale_courts_cleared, "oneEnvironmentAtATime": unique_environments, "kenneyFallback": fallback_ok}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(report))
		file.close()
	print("YUN_ENVIRONMENT_SWITCH_REPORT ", JSON.stringify(report))

`;
}

async function launchProbe(projectDir: string, expectedMatterhorn: boolean, timeoutMs: number): Promise<Record<string, any>> {
  const client = new FlyrailClient({ requestTimeoutMs: 180_000 });
  let sessionId = "";
  let runtimeSessionId = "";
  try {
    await client.connect();
    const opened = await client.call("project.open", { path: projectDir, installAddons: true }) as { sessionId?: string };
    sessionId = opened.sessionId ?? "";
    assert.ok(sessionId, "Flyrail project.open returned a disposable Yun project session");
    const validation = await client.call("test.validate_static", { sessionId }) as { ok?: boolean; [key: string]: unknown };
    assert.equal(validation.ok, true, `Flyrail import and static validation succeeded: ${JSON.stringify(validation)}`);
    const launch = await client.call("runtime.launch", { sessionId, scene: "res://scenes/match.tscn", headless: false, quitAfter: 7200 }) as { runtimeSessionId?: string; runtime?: { sessionId?: string } };
    runtimeSessionId = launch.runtimeSessionId ?? launch.runtime?.sessionId ?? "";
    assert.ok(runtimeSessionId, "Flyrail launched the real Yun production match scene");
    const reportPath = join(projectDir, "tests", "yun_environment_runtime.json");
    const deadline = Date.now() + timeoutMs;
    while (!existsSync(reportPath) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    if (!existsSync(reportPath)) {
      const status = await client.call("runtime.status", { runtimeSessionId }).catch((error) => String(error));
      assert.fail(`Godot emitted no runtime probe evidence via Flyrail; status=${JSON.stringify(status)}; project=${projectDir}`);
    }
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, any>;
    assert.equal(report.environmentOptIn, expectedMatterhorn);
    assert.equal(report.ok, true, JSON.stringify(report));
    await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    return { report, validation };
  } finally {
    if (runtimeSessionId) await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    if (sessionId) await client.call("session.close", { sessionId }).catch(() => undefined);
    client.disconnect();
  }
}

async function launchMapSwitchProbe(projectDir: string): Promise<{ report: Record<string, any>; validation: Record<string, unknown> }> {
  const client = new FlyrailClient({ requestTimeoutMs: 180_000 });
  let sessionId = "";
  let runtimeSessionId = "";
  try {
    await client.connect();
    const opened = await client.call("project.open", { path: projectDir, installAddons: true }) as { sessionId?: string };
    sessionId = opened.sessionId ?? "";
    assert.ok(sessionId, "Flyrail opened the production map-selection UI project");
    const validation = await client.call("test.validate_static", { sessionId }) as { ok?: boolean; [key: string]: unknown };
    assert.equal(validation.ok, true, `Flyrail validated the map-selection project: ${JSON.stringify(validation)}`);
    const launch = await client.call("runtime.launch", { sessionId, scene: "res://scenes/main_menu.tscn", headless: false, quitAfter: 7200 }) as { runtimeSessionId?: string; runtime?: { sessionId?: string } };
    runtimeSessionId = launch.runtimeSessionId ?? launch.runtime?.sessionId ?? "";
    assert.ok(runtimeSessionId, "Flyrail launched the real main menu for the map-switch test");
    const reportPath = join(projectDir, "tests", "yun_environment_switch_runtime.json");
    const deadline = Date.now() + 20_000;
    while (!existsSync(reportPath) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    if (!existsSync(reportPath)) {
      const status = await client.call("runtime.status", { runtimeSessionId }).catch((error) => String(error));
      assert.fail(`four-map switch probe emitted no evidence; status=${JSON.stringify(status)}`);
    }
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, any>;
    assert.equal(report.ok, true, JSON.stringify(report));
    await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    return { report, validation };
  } finally {
    if (runtimeSessionId) await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    if (sessionId) await client.call("session.close", { sessionId }).catch(() => undefined);
    client.disconnect();
  }
}

async function healthGate(): Promise<void> {
  const client = new FlyrailClient();
  try {
    const health = await client.health();
    assert.equal(health.ok && health.product === "flyrail", true, "healthy Flyrail daemon required");
  } finally { client.disconnect(); }
}

async function generateEnvironment(tempRoot: string, spec: typeof YUN_ENVIRONMENT_SPECS[number]): Promise<{ workDir: string; sanity: ReturnType<typeof runYunEnvironmentVisualSanity> }> {
  const blender = findBlenderExecutable();
  assert.ok(blender, "Blender executable required for the live environment-set gate");
  assert.deepEqual(validateYunEnvironmentSpec(spec), [], `${spec.assetId} passes the shared environment contract`);
  const adapter = new BlenderAdapter({ baseWorkDir: tempRoot, blenderBin: blender });
  const handoff: NssStudioHandoff = {
    protocol: "nss.studio-handoff.v1", id: `h-${spec.assetId}`, taskId: `t-${spec.assetId}`,
    from: "matterhorn", to: "blender-engine", goal: `Generate Yun environment ${spec.displayName} ${spec.assetId}`,
    acceptanceCriteria: [`Create the requested ${spec.theme} Yun environment`, "Export the requested asset ID", "Preserve the court as authoritative"], inputArtifacts: [],
  };
  const requested = resolveYunEnvironmentSpecFromGoal(handoff.goal);
  assert.equal(requested?.assetId, spec.assetId, "the requested goal selected the generated environment spec");
  const resolvedTask = adapter.resolveTaskSpec(handoff, join(tempRoot, handoff.taskId));
  assert.equal(resolvedTask.assetName, spec.assetId, "BlenderAdapter resolved the actual requested asset identity from the goal");
  const accepted = await adapter.submitTask(handoff);
  assert.equal(accepted.accepted, true, `${spec.assetId} Blender task accepted`);
  const result = await adapter.getResult(handoff.taskId);
  assert.equal(result.status, "completed", result.summary);
  const workDir = join(tempRoot, handoff.taskId);
  const sanity = runYunEnvironmentVisualSanity({ workDir, spec });
  assert.equal(sanity.ok, true, JSON.stringify(sanity.checks.filter((check) => !check.ok), null, 2));
  const taskSpec = buildYunEnvironmentTaskSpec(workDir, spec);
  assert.equal(taskSpec.assetName, spec.assetId);
  return { workDir, sanity };
}

async function runMapSwitchGate(flyrailRoot: string, tempRoot: string): Promise<{ report: Record<string, any>; validation: Record<string, unknown> }> {
  const sourceGame = join(flyrailRoot, "games", "yun");
  const switchProject = join(tempRoot, "yun-map-switch-session");
  createMapSwitchProject(sourceGame, switchProject);
  runGodotEditorImport(switchProject, DEFAULT_GODOT_BIN);
  const result = await launchMapSwitchProbe(switchProject);
  const switchArchive = join(resolve(process.cwd(), "artifacts", "yun-environment-candidate"), "map-switch");
  mkdirSync(switchArchive, { recursive: true });
  writeFileSync(join(switchArchive, "four-map-switch-runtime.json"), JSON.stringify(result.report, null, 2));
  writeFileSync(join(switchArchive, "flyrail-import-validation.json"), JSON.stringify(result.validation, null, 2));
  return result;
}

async function runSwitchOnly(): Promise<void> {
  const blender = findBlenderExecutable();
  const flyrailRoot = requiredFlyrailRoot();
  assert.ok(blender, "Blender executable required; skipping is a failure");
  assert.ok(existsSync(DEFAULT_GODOT_BIN), `Godot executable required at ${DEFAULT_GODOT_BIN}`);
  for (const assetId of EXPECTED_ASSETS) {
    const path = join(flyrailRoot, "games", "yun", "assets", "matterhorn", `${assetId}.glb`);
    assert.ok(existsSync(path) && statSync(path).size > 0, `provider asset present: ${assetId}`);
  }
  await healthGate();
  verifyProductionContracts(flyrailRoot);
  const tempRoot = mkdtempSync(join(tmpdir(), "matterhorn-yun-map-switch-"));
  let passed = false;
  try {
    const result = await runMapSwitchGate(flyrailRoot, tempRoot);
    console.log(`YUN FOUR-MAP SWITCH LIVE PASS: ${JSON.stringify(result.report)}`);
    passed = true;
  } finally {
    if (!passed && process.env.MATTERHORN_KEEP_ENV_SET_TEMP === "1") console.error(`Disposable switch failure evidence retained: ${tempRoot}`);
    else rmSync(tempRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--switch-only")) return runSwitchOnly();
  const blender = findBlenderExecutable();
  const flyrailRoot = requiredFlyrailRoot();
  assert.ok(blender, "Blender executable required; skipping is a failure");
  assert.ok(existsSync(DEFAULT_GODOT_BIN), `Godot executable required at ${DEFAULT_GODOT_BIN}`);
  await healthGate();
  verifyProductionContracts(flyrailRoot);
  assert.equal(YUN_ENVIRONMENT_SPECS.length, 4, "exactly four Matterhorn environment specs are required");
  assert.deepEqual(YUN_ENVIRONMENT_SPECS.map((spec) => spec.assetId), EXPECTED_ASSETS);

  const tempRoot = mkdtempSync(join(tmpdir(), "matterhorn-yun-environment-set-"));
  const sourceGame = join(flyrailRoot, "games", "yun");
  const productionAssetDir = join(sourceGame, "assets", "matterhorn");
  const artifactRoot = resolve(process.cwd(), "artifacts", "yun-environment-candidate");
  const metrics: Array<Record<string, unknown>> = [];
  let passed = false;
  try {
    for (let mapId = 0; mapId < YUN_ENVIRONMENT_SPECS.length; mapId++) {
      const spec = YUN_ENVIRONMENT_SPECS[mapId]!;
      const archive = join(artifactRoot, spec.assetId);
      mkdirSync(archive, { recursive: true });
      let glbSource = join(productionAssetDir, `${spec.assetId}.glb`);
      let sanity: ReturnType<typeof runYunEnvironmentVisualSanity> | undefined;
      if (mapId === 0) {
        // Calle is already accepted. Reuse its pushed asset and evidence; never regenerate it here.
        assert.ok(existsSync(glbSource) && statSync(glbSource).size > 0, "accepted Calle production GLB exists");
        const sanityPath = join(archive, "visual-sanity.json");
        if (existsSync(sanityPath)) sanity = JSON.parse(readFileSync(sanityPath, "utf8"));
      } else {
        const archivedGlb = join(archive, `${spec.assetId}.glb`);
        const archivedTask = join(archive, "blender-task.json");
        const archivedResult = join(archive, "blender-result.json");
        if (existsSync(archivedGlb) && existsSync(archivedTask) && existsSync(archivedResult)) {
          glbSource = archivedGlb;
          sanity = runYunEnvironmentVisualSanity({ workDir: archive, spec });
          assert.equal(sanity.ok, true, `archived generation evidence remains valid for ${spec.assetId}`);
          const task = JSON.parse(readFileSync(archivedTask, "utf8"));
          const result = JSON.parse(readFileSync(archivedResult, "utf8"));
          assert.equal(task.assetName, spec.assetId, "archived Blender manifest preserves goal-selected identity");
          assert.equal(result.status, "completed", "archived Blender result is completed");
        } else {
          const generated = await generateEnvironment(tempRoot, spec);
          sanity = generated.sanity;
          glbSource = join(generated.workDir, `${spec.assetId}.glb`);
          assert.ok(existsSync(glbSource) && statSync(glbSource).size > 0, "generated GLB is non-empty");
          for (const name of readdirSync(generated.workDir)) {
            const source = join(generated.workDir, name);
            if (statSync(source).isFile()) cpSync(source, join(archive, name));
          }
          writeFileSync(join(archive, "visual-sanity.json"), JSON.stringify(sanity, null, 2));
        }
        const installed = join(productionAssetDir, `${spec.assetId}.glb`);
        if (existsSync(installed)) {
          assert.equal(readFileSync(installed).equals(readFileSync(glbSource)), true, `refusing to overwrite different existing ${spec.assetId}`);
        } else cpSync(glbSource, installed);
      }

      const disposable = join(tempRoot, `yun-map-${mapId}-matterhorn`);
      createDisposableProject(sourceGame, disposable, mapId, true);
      cpSync(glbSource, join(disposable, "assets", "matterhorn", `${spec.assetId}.glb`));
      runGodotEditorImport(disposable, DEFAULT_GODOT_BIN);
      const live = await launchProbe(disposable, true, 40_000);
      const godotDir = join(archive, "godot");
      mkdirSync(godotDir, { recursive: true });
      writeFileSync(join(godotDir, "matterhorn-runtime.json"), JSON.stringify(live.report, null, 2));
      writeFileSync(join(godotDir, "flyrail-import-validation.json"), JSON.stringify(live.validation, null, 2));
      for (const screenshot of live.report.screenshots as string[]) {
        const name = screenshot.split("/").pop();
        if (name && existsSync(join(disposable, "tests", name))) cpSync(join(disposable, "tests", name), join(godotDir, name));
      }
      const fallback = join(tempRoot, `yun-map-${mapId}-kenney`);
      createDisposableProject(sourceGame, fallback, mapId, false);
      runGodotEditorImport(fallback, DEFAULT_GODOT_BIN);
      const fallbackLive = await launchProbe(fallback, false, 15_000);
      writeFileSync(join(godotDir, "kenney-fallback-runtime.json"), JSON.stringify(fallbackLive.report, null, 2));
      metrics.push({ mapId, assetId: spec.assetId, provider: "matterhorn", geometry: sanity?.geometry ?? null, glbBytes: statSync(glbSource).size, matterhorn: live.report, fallback: fallbackLive.report });
      console.log(`PASS ${spec.assetId}: ${JSON.stringify({ mapId, meshes: live.report.environmentMeshCount, importedNodes: live.report.importedNodeCount, players: live.report.playerCount, route: live.report.route, tag: live.report.tagGameplayOk, fallbackPlayers: fallbackLive.report.playerCount })}`);
    }
    const switchResult = await runMapSwitchGate(flyrailRoot, tempRoot);
    writeFileSync(join(artifactRoot, "yun-environment-set-live.json"), JSON.stringify({ ok: true, metrics, mapSwitch: switchResult.report }, null, 2));
    const flyrailHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: flyrailRoot, encoding: "utf8" }).stdout.trim();
    console.log(`YUN ENVIRONMENT SET LIVE PASS: ${JSON.stringify({ matterhornHead: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), flyrailHead, switch: switchResult.report, artifacts: artifactRoot })}`);
    passed = true;
  } finally {
    if (!passed && process.env.MATTERHORN_KEEP_ENV_SET_TEMP === "1") {
      console.error(`Disposable failure evidence retained: ${tempRoot}`);
    } else {
      try { rmSync(tempRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 }); }
      catch (error) { console.error(`Disposable test directory retained because Windows still holds it: ${tempRoot} (${String(error)})`); }
    }
  }
}

void main().catch((error) => {
  console.error("YUN ENVIRONMENT SET LIVE FAIL:", error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
