/**
 * Non-skipping live V3 candidate gate. Generates only yun_player_base_v3,
 * archives its Blender outputs, runs V3 sanity, and validates it through
 * Flyrail/Godot on a disposable project.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
  runYunCharacterArtV3Sanity,
  resolveYunCharacterArtV3FromGoal,
} from "../studio/adapters/blender/index.js";
import {
  DEFAULT_GODOT_BIN,
  FlyrailClient,
  runGodotEditorImport,
  resolveDisposableGodotFixture,
  runYunGameplayCameraProbe,
  runYunWrapperMotionProbe,
  validateGlbThroughFlyrail,
  writeYunGameplayCameraProbe,
  writeYunWrapperMotionProbe,
} from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

const CANDIDATE = "yun_player_base_v3";
const TASK_ID = "yun-character-art-v3-base-candidate";
const OUTPUTS = [
  `${CANDIDATE}.blend`,
  `${CANDIDATE}.glb`,
  `${CANDIDATE}-preview.png`,
  `${CANDIDATE}-front.png`,
  `${CANDIDATE}-side.png`,
  `${CANDIDATE}-back.png`,
  `${CANDIDATE}-three-quarter.png`,
  `${CANDIDATE}-report.json`,
  "blender-task.json",
  "blender-report.json",
  "blender-result.json",
  "blender-stdout.log",
  "blender-stderr.log",
];

function archiveDir(): string {
  return resolve(process.cwd(), "artifacts", "yun-character-candidate", CANDIDATE);
}

function writeRealMatchAbProbe(projectDir: string): string {
  const scriptPath = join(projectDir, "tests", "yun_character_v3_ab_probe.gd");
  const script = `extends SceneTree
## Disposable A/B captures using the production Yun match scene and its camera.
const CURRENT := "res://assets/matterhorn/yun_player_base.glb"
const CANDIDATE := "res://yun_player_base_v3.glb"
const OUT := "res://tests/yun-character-v3-ab"
const TEAM := Color(0.95, 0.72, 0.18, 1.0)
var pair := []
var game: Node
var cam_rig: Node3D
var cam: Camera3D
var report := {"ok": false, "screenshots": [], "checks": []}

func _initialize() -> void:
    DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
    DisplayServer.window_set_size(Vector2i(1440, 900))
    change_scene_to_file("res://scenes/match.tscn")
    call_deferred("_run")

func _run() -> void:
    for i in range(12):
        await process_frame
    game = root.get_child(root.get_child_count() - 1)
    if game == null or not game.has_method("_apply_roles"):
        report["error"] = "production match scene failed to load"
        _write_report()
        quit(1)
        return
    cam_rig = game.get_node("CamRig") as Node3D
    cam = game.get_node("CamRig/Camera3D") as Camera3D
    if cam == null or cam_rig == null:
        report["error"] = "production YunCamRig/Camera3D missing"
        _write_report()
        quit(1)
        return
    var hud := game.get_node_or_null("HUD") as CanvasItem
    if hud:
        hud.visible = false
    cam_rig.set_process(false)
    cam_rig.set_physics_process(false)
    for actor in game.attackers + game.defenders:
        actor.set_process(false)
        actor.set_physics_process(false)
        actor.visible = false

    if not ResourceLoader.exists(CURRENT) or not ResourceLoader.exists(CANDIDATE):
        report["error"] = "current or V3 GLB missing in disposable Yun project"
        _write_report()
        quit(1)
        return
    pair = [_make_host(CURRENT, "Current", Vector3(13.86, 0.02, 7.0)), _make_host(CANDIDATE, "V3", Vector3(14.94, 0.02, 7.0))]
    if pair.has(null):
        report["error"] = "current/V3 GLB failed to instantiate"
        _write_report()
        quit(1)
        return
    _add_pair_labels()
    cam.current = true
    cam.fov = 46.0
    _aim(Vector3(14.4, 4.7, 12.3), Vector3(14.4, 0.9, 7.0))
    await _pose("idle", 0.2)
    await _capture("standing-ab.png")
    await _pose("walk", 0.02)
    await _capture("walk-contact-ab.png")
    await _pose("walk", 0.29)
    await _capture("walk-passing-ab.png")
    await _pose("run", 0.02)
    await _capture("run-contact-ab.png")
    await _pose("run", 0.18)
    await _capture("run-flight-ab.png")
    _aim(Vector3(16.0, 4.3, 11.0), Vector3(14.4, 0.9, 7.0))
    await _pose("idle", 0.2)
    await _capture("three-quarter-gameplay-ab.png")
    _aim(Vector3(14.4, 3.55, 9.3), Vector3(14.4, 0.93, 7.0))
    await _capture("close-gameplay-ab.png")

    for node in pair:
        node.visible = false
    _show_six_player_scene()
    _aim(Vector3(14.4, 4.7, 15.6), Vector3(14.4, 0.9, 7.15))
    await _wait_frames(12)
    await _capture("six-player-one-v3.png")
    report["camera"] = {"source": "production match.tscn CamRig/Camera3D", "fov": 46.0, "wrapperScale": 1.2, "lighting": "production Yun match WorldEnvironment and sun"}
    var visible_models := 0
    var v3_models := 0
    var actor_evidence: Array = []
    for actor in game.attackers + game.defenders:
        var model: Node3D = actor.get_node_or_null("Kenney") as Node3D
        var meshes := 0 if model == null else model.find_children("*", "MeshInstance3D", true, false).size()
        var shown: bool = actor.visible and model != null and model.visible and meshes > 0
        if shown:
            visible_models += 1
        if model and model.get_meta("v3_candidate", false):
            v3_models += 1
        actor_evidence.append({"actor": actor.name, "visible": shown, "meshCount": meshes, "position": [actor.global_position.x, actor.global_position.y, actor.global_position.z], "v3": model != null and model.get_meta("v3_candidate", false)})
    report["sixActors"] = actor_evidence
    report["sixPlayer"] = {"visibleActors": visible_models, "v3Players": v3_models, "currentBasePlayers": visible_models - v3_models}
    report["checks"].append({"id": "real_match_camera", "ok": true})
    report["checks"].append({"id": "six_players_one_v3", "ok": visible_models == 6 and v3_models == 1})
    report["ok"] = report["screenshots"].size() >= 7 and visible_models == 6 and v3_models == 1
    _write_report()
    print("YUN_CHARACTER_V3_REAL_MATCH_AB_OK screenshots=", report["screenshots"].size())
    quit(0 if report["ok"] else 1)

func _make_host(path: String, label: String, pos: Vector3) -> Node3D:
    var packed := ResourceLoader.load(path) as PackedScene
    if packed == null:
        return null
    var host := Node3D.new()
    host.name = label + "Host"
    host.position = pos
    game.add_child(host)
    var model := packed.instantiate() as Node3D
    if model == null:
        host.queue_free()
        return null
    model.name = "Kenney"
    model.scale = Vector3.ONE * 1.2
    host.add_child(model)
    _apply_team(model)
    return host

func _apply_team(model: Node) -> void:
    for raw in model.find_children("*", "MeshInstance3D", true, false):
        var mesh := raw as MeshInstance3D
        if mesh.mesh == null:
            continue
        for i in range(mesh.mesh.get_surface_count()):
            var mat := mesh.get_active_material(i)
            if mat == null or not String(mat.resource_name).to_lower().contains("teamshirt"):
                continue
            var copy := mat.duplicate() as StandardMaterial3D
            if copy:
                copy.albedo_color = TEAM
                mesh.set_surface_override_material(i, copy)

func _add_pair_labels() -> void:
    var layer := CanvasLayer.new()
    game.add_child(layer)
    for item in [{"text":"CURRENT","x":485}, {"text":"V3 CANDIDATE","x":850}]:
        var label := Label.new()
        label.text = item.text
        label.position = Vector2(item.x, 48)
        label.add_theme_font_size_override("font_size", 30)
        label.add_theme_color_override("font_color", Color(1, 0.92, 0.42))
        layer.add_child(label)

func _aim(position: Vector3, target: Vector3) -> void:
    cam_rig.global_position = position
    cam_rig.look_at(target, Vector3.UP)
    cam.current = true

func _pose(kind: String, seconds: float) -> void:
    for host in pair:
        var model: Node = host.get_node("Kenney")
        var anim := model.find_child("AnimationPlayer", true, false) as AnimationPlayer
        if anim == null:
            report["error"] = "missing AnimationPlayer on " + str(host.name)
            _write_report()
            quit(1)
            return
        var clip := _clip(anim, kind)
        if clip == "":
            report["error"] = "missing " + kind + " animation on " + str(host.name)
            _write_report()
            quit(1)
            return
        anim.play(clip)
        anim.advance(seconds)
    await _wait_frames(3)

func _clip(anim: AnimationPlayer, kind: String) -> String:
    for clip in anim.get_animation_list():
        var low := String(clip).to_lower()
        if kind == "run" and (low.contains("run") or low.contains("sprint")):
            return String(clip)
        if kind != "run" and low.contains(kind):
            return String(clip)
    return ""

func _show_six_player_scene() -> void:
    game.set_process(false)
    game.set_physics_process(false)
    var six_positions := [Vector3(12.7, 0.02, 5.8), Vector3(14.4, 0.02, 5.8), Vector3(16.1, 0.02, 5.8), Vector3(12.7, 0.02, 8.5), Vector3(14.4, 0.02, 8.5), Vector3(16.1, 0.02, 8.5)]
    var index := 0
    for actor in game.attackers + game.defenders:
        actor.set_process(false)
        actor.set_physics_process(false)
        actor.global_position = six_positions[index]
        index += 1
        actor.visible = true
        var old: Node3D = actor.get_node_or_null("Kenney") as Node3D
        if old == null:
            continue
        old.visible = true
        if actor == game.attackers[0]:
            var packed := ResourceLoader.load(CANDIDATE) as PackedScene
            if packed:
                actor.remove_child(old)
                old.queue_free()
                var model := packed.instantiate() as Node3D
                model.name = "Kenney"
                model.scale = Vector3.ONE * 1.2
                model.set_meta("v3_candidate", true)
                actor.add_child(model)
                _apply_team(model)
                var animation := model.find_child("AnimationPlayer", true, false) as AnimationPlayer
                var idle := _clip(animation, "idle")
                if animation and idle != "":
                    animation.play(idle)

func _wait_frames(count: int) -> void:
    for i in range(count):
        await process_frame

func _capture(name: String) -> void:
    await _wait_frames(3)
    var image := root.get_viewport().get_texture().get_image()
    image.save_png(ProjectSettings.globalize_path(OUT.path_join(name)))
    report["screenshots"].append(name)

func _write_report() -> void:
    var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
    if f:
        f.store_string(JSON.stringify(report, "\\t"))
        f.close()
`;
  mkdirSync(join(projectDir, "tests"), { recursive: true });
  mkdirSync(join(projectDir, "tests", "yun-character-v3-ab"), { recursive: true });
  writeFileSync(scriptPath, script, "utf8");
  return scriptPath;
}

async function requireLivePrerequisites(): Promise<void> {
  const missing: string[] = [];
  const blender = findBlenderExecutable();
  if (!blender) missing.push("Blender executable");
  if (!existsSync(DEFAULT_GODOT_BIN)) missing.push(`Godot executable: ${DEFAULT_GODOT_BIN}`);
  try {
    resolveDisposableGodotFixture();
  } catch (error) {
    missing.push(`disposable Godot fixture: ${error instanceof Error ? error.message : String(error)}`);
  }
  const client = new FlyrailClient();
  try {
    const health = await client.health();
    if (!(health.ok && health.product === "flyrail")) missing.push("healthy Flyrail daemon");
  } catch (error) {
    missing.push(`Flyrail daemon: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    client.disconnect();
  }
  if (missing.length) {
    throw new Error(`Required live prerequisites missing:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  }
}

async function main(): Promise<void> {
  await requireLivePrerequisites();
  const variant = resolveYunCharacterArtV3FromGoal(`Generate only ${CANDIDATE}`);
  assert.ok(variant && variant.assetId === "yun_player_base", "explicit V3 request resolves to the existing base spec");

  const archive = archiveDir();
  const blenderWorkRoot = join(archive, "blender-work");
  mkdirSync(archive, { recursive: true });
  const adapter = new BlenderAdapter({ baseWorkDir: blenderWorkRoot });
  const handoff: NssStudioHandoff = {
    protocol: "nss.studio-handoff.v1",
    id: "h-yun-character-art-v3-base-candidate",
    taskId: TASK_ID,
    from: "matterhorn",
    to: "blender-engine",
    goal: `Generate only ${CANDIDATE} through the structured Blender task pipeline`,
    acceptanceCriteria: [
      `${CANDIDATE}.blend created`,
      `${CANDIDATE}.glb exported with idle walk run`,
      "18-bone rig and MAT_TeamShirt present",
      "V3 multi-view renders produced",
    ],
    inputArtifacts: [],
  };

  const handle = await adapter.submitTask(handoff);
  assert.equal(handle.accepted, true, "BlenderAdapter accepted the structured V3 handoff");
  const result = await adapter.getResult(TASK_ID);
  assert.equal(result.status, "completed", result.summary);
  const workDir = join(blenderWorkRoot, TASK_ID);
  for (const name of OUTPUTS) {
    const source = join(workDir, name);
    assert.ok(existsSync(source), `Blender output exists: ${name}`);
    cpSync(source, join(archive, name));
  }

  const sanity = runYunCharacterArtV3Sanity({ workDir, assetPrefix: CANDIDATE });
  writeFileSync(join(archive, "sanity.json"), JSON.stringify(sanity, null, 2), "utf8");
  assert.equal(sanity.ok, true, JSON.stringify(sanity.checks.filter((check) => !check.ok), null, 2));
  const glbPath = join(archive, `${CANDIDATE}.glb`);

  const disposableProjectDir = join(archive, `godot-flyrail-disposable-${Date.now()}`);
  const { report: importReport, result: importResult } = await validateGlbThroughFlyrail({
    glbSourcePath: glbPath,
    disposableProjectDir,
    fixtureSourceDir: resolveDisposableGodotFixture(),
    assetFileName: `${CANDIDATE}.glb`,
    requireSkeleton: true,
    requireAnimations: ["idle", "walk", "run_or_sprint"],
  });
  assert.ok(importReport.sessionId, "real Flyrail import session recorded");
  assert.equal(importResult.status, "completed", importResult.summary);
  const animationMatch = matchYunAnimationClips(importReport.probe?.animationNames ?? []);
  assert.equal(animationMatch.missing.length, 0, `missing clips: ${animationMatch.missing.join(", ")}`);
  writeYunWrapperMotionProbe(disposableProjectDir, `${CANDIDATE}.glb`);
  const wrapperMotion = runYunWrapperMotionProbe(disposableProjectDir);
  assert.equal(wrapperMotion.ok, true, wrapperMotion.error);
  assert.equal(wrapperMotion.wrapperScale, 1.2);
  writeYunGameplayCameraProbe(disposableProjectDir, `${CANDIDATE}.glb`);
  const gameplayCamera = runYunGameplayCameraProbe(disposableProjectDir);
  assert.equal(gameplayCamera.ok, true, gameplayCamera.error);
  assert.ok((gameplayCamera.screenshots?.length ?? 0) >= 3);

  const flyrailEvidence = join(archive, "flyrail-import");
  mkdirSync(flyrailEvidence, { recursive: true });
  writeFileSync(join(flyrailEvidence, "import-validation.json"), JSON.stringify({ importReport, importResult, animationMatch }, null, 2), "utf8");
  writeFileSync(join(flyrailEvidence, "wrapper-motion.json"), JSON.stringify(wrapperMotion, null, 2), "utf8");
  writeFileSync(join(flyrailEvidence, "gameplay-camera.json"), JSON.stringify(gameplayCamera, null, 2), "utf8");
  for (const name of readdirSync(disposableProjectDir)) {
    if (name.startsWith("gameplay-") && name.endsWith(".png")) {
      cpSync(join(disposableProjectDir, name), join(flyrailEvidence, name));
    }
  }

  const productionYunDir = resolve(dirname(DEFAULT_GODOT_BIN), "..", "..", "..", "games", "yun");
  const currentGlb = join(productionYunDir, "assets", "matterhorn", "yun_player_base.glb");
  assert.ok(existsSync(currentGlb), `production base GLB exists: ${currentGlb}`);
  const abProjectDir = join(archive, `godot-real-match-ab-${Date.now()}`);
  cpSync(productionYunDir, abProjectDir, {
    recursive: true,
    filter: (source) => {
      const rel = relative(productionYunDir, source).replace(/\\/g, "/");
      return !/(^|\/)(\.godot|\.flyrail|\.git|build|multiplayer-relay|tests|_dl)(\/|$)/i.test(rel);
    },
  });
  cpSync(glbPath, join(abProjectDir, `${CANDIDATE}.glb`));
  const abScript = writeRealMatchAbProbe(abProjectDir);
  runGodotEditorImport(abProjectDir);
  const abRun = spawnSync(
    DEFAULT_GODOT_BIN,
    ["--path", abProjectDir, "--script", `res://${relative(abProjectDir, abScript).replace(/\\/g, "/")}`],
    { encoding: "utf8", timeout: 240_000, windowsHide: true },
  );
  writeFileSync(join(archive, "real-match-ab.stdout.txt"), abRun.stdout ?? "", "utf8");
  writeFileSync(join(archive, "real-match-ab.stderr.txt"), abRun.stderr ?? "", "utf8");
  assert.equal(abRun.status, 0, `real production Yun match A/B probe failed: ${abRun.stderr || abRun.stdout || abRun.error?.message}`);
  const abReportPath = join(abProjectDir, "tests", "yun-character-v3-ab", "report.json");
  assert.ok(existsSync(abReportPath), "real match A/B evidence report exists");
  const abReport = JSON.parse(readFileSync(abReportPath, "utf8")) as { ok?: boolean; screenshots?: string[]; error?: string };
  assert.equal(abReport.ok, true, abReport.error ?? "A/B or six-player quality probe failed");
  const abEvidenceDir = join(archive, "real-match-ab");
  mkdirSync(abEvidenceDir, { recursive: true });
  const currentBaseSha256 = createHash("sha256").update(readFileSync(currentGlb)).digest("hex");
  writeFileSync(join(abEvidenceDir, "report.json"), JSON.stringify({ ...abReport, currentBaseSha256 }, null, 2), "utf8");
  for (const name of abReport.screenshots ?? []) {
    cpSync(join(abProjectDir, "tests", "yun-character-v3-ab", name), join(abEvidenceDir, name));
  }

  const geometry = sanity.geometry;
  const summary = {
    candidate: CANDIDATE,
    generatedAt: new Date().toISOString(),
    structuredBlenderTaskId: TASK_ID,
    blenderSummary: result.summary,
    sanity,
    geometry: {
      vertices: geometry?.vertices,
      polygons: geometry?.polygons,
      meshObjects: geometry?.meshObjects,
      materials: sanity.materials?.length,
      materialNames: sanity.materials,
      bones: sanity.boneCount,
      glbBytes: statSync(glbPath).size,
    },
    flyrail: { importReport, importResult, animationMatch, wrapperMotion, gameplayCamera },
    realMatchAb: { report: abReport, currentBaseSha256 },
  };
  writeFileSync(join(archive, "v3-live-gate.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify({
    candidate: CANDIDATE,
    archive,
    geometry: summary.geometry,
    flyrailImportSessionId: importReport.sessionId,
    screenshots: gameplayCamera.screenshots,
  }, null, 2));
  console.log("YUN_CHARACTER_V3_LIVE_GENERATION_PASS");
}

void main().catch((error: unknown) => {
  console.error(`YUN_CHARACTER_V3_LIVE_GENERATION_FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
