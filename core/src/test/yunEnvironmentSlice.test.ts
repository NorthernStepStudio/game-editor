import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  BlenderAdapter,
  buildYunEnvironmentOperations,
  buildYunEnvironmentTaskSpec,
  findBlenderExecutable,
  runYunEnvironmentVisualSanity,
  validateYunEnvironmentSpec,
  YUN_COURT_CONTRACT,
  YUN_COURT_WORLD_METRICS,
  YUN_ENVIRONMENT_PLAY_X,
  YUN_FIRST_ENVIRONMENT_SPEC,
} from "../studio/adapters/blender/index.js";
import { DEFAULT_GODOT_BIN, FlyrailClient, resolveDisposableGodotFixture, runGodotEditorImport, validateGlbThroughFlyrail } from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

function flyrailRoot(): string | undefined {
  const candidates = [process.env.FLYRAIL_REPO_ROOT?.trim() ?? "", resolve(process.cwd(), "..")].filter(Boolean);
  return candidates.find((p) => existsSync(join(p, "games", "yun", "scripts", "court.gd")));
}

function createDisposableYunProject(sourceGame: string, destination: string, environmentEnabled: boolean): void {
  cpSync(sourceGame, destination, {
    recursive: true,
    filter: (source) => {
      const rel = relative(sourceGame, source).replace(/\\/g, "/");
      return rel !== "scripts/credits_copy.gd" && !/(^|\/)(\.godot|\.flyrail|build|multiplayer-relay|tests|_dl)(\/|$)/i.test(rel);
    },
  });
  const settingsPath = join(destination, "scripts", "game_settings.gd");
  let settings = readFileSync(settingsPath, "utf8");
  settings = settings.replace('var environment_provider: String = "kenney"', `var environment_provider: String = "${environmentEnabled ? "matterhorn_calle" : "kenney"}"`);
  settings = settings.replace("\tload_settings()\n", `\tload_settings()\n\tenvironment_provider = "${environmentEnabled ? "matterhorn_calle" : "kenney"}"\n`);
  writeFileSync(settingsPath, settings, "utf8");

  mkdirSync(join(destination, "tests"), { recursive: true });
  writeFileSync(join(destination, "tests", "yun_environment_runtime_probe.gd"), yunEnvironmentRuntimeProbe(environmentEnabled), "utf8");
  const scenePath = join(destination, "scenes", "match.tscn");
  let scene = readFileSync(scenePath, "utf8");
  scene = scene.replace("[gd_scene load_steps=8 format=3]", "[gd_scene load_steps=9 format=3]");
  scene = scene.replace('[ext_resource type="Script" path="res://scripts/sfx.gd" id="7"]', '[ext_resource type="Script" path="res://scripts/sfx.gd" id="7"]\n[ext_resource type="Script" path="res://tests/yun_environment_runtime_probe.gd" id="8"]');
  scene += '\n[node name="EnvironmentGateProbe" type="Node" parent="."]\nscript = ExtResource("8")\n';
  writeFileSync(scenePath, scene, "utf8");
}

function yunEnvironmentRuntimeProbe(environmentExpected: boolean): string {
  return `extends Node\n\nconst EXPECT_MATTERHORN := ${environmentExpected ? "true" : "false"}\nconst REPORT_PATH := "res://tests/yun_environment_runtime.json"\n\nfunc _ready() -> void:\n\tcall_deferred("_run")\n\nfunc _run() -> void:\n\tvar runtime_started_at_ms := Time.get_ticks_msec()\n\tawait get_tree().create_timer(1.0).timeout\n\tvar game := get_parent() as YunMatch\n\tvar court = game.get_node("Court")\n\tvar env_root := court.get_node_or_null("MatterhornCalleEnvironment")\n\tvar mesh_count := 0\n\tif env_root:\n\t\tmesh_count = env_root.find_children("*", "MeshInstance3D", true, false).size()\n\tvar geometry_ok := YunCourt.COURT_LEFT == 160.0 and YunCourt.COURT_RIGHT == 992.0 and YunCourt.HEAD_Y == 70.0 and YunCourt.FAR_Y == 560.0 and YunCourt.TUBE_Y == [190.0, 320.0, 450.0]\n\tvar roster_ok: bool = game.attackers.size() == 3 and game.defenders.size() == 3\n\tvar provider_ok := (env_root != null) == EXPECT_MATTERHORN\n\tvar route := {"walked": false, "crossed_tube": false, "turned_at_turn": false, "returned_to_yun": false}\n\tvar previous: Dictionary = {}\n\tvar screenshots: Array[String] = []\n\tvar tag_gameplay_ok := false\n\tif EXPECT_MATTERHORN:\n\t\tgame.human_attacking = false\n\t\tgame._apply_roles()\n\t\tgame._begin_rush()\n\t\tfor d in game.defenders:\n\t\t\td.set_process(false)\n\t\t\td.set_physics_process(false)\n\t\tfor a in game.attackers:\n\t\t\ta.set_attack_job(YunAttacker.AttackJob.RUN)\n\t\tgame._refresh_hud()\n\telse:\n\t\tgame.human_attacking = false\n\t\tgame._apply_roles()\n\t\tgame._begin_rush()\n\t\tgame._refresh_hud()\n\tawait get_tree().create_timer(0.4).timeout\n\tvar visible_players := 0\n\tfor node in game.attackers + game.defenders:\n\t\tif node.active and node.visible:\n\t\t\tvisible_players += 1\n\t_shot("yun-environment-start", screenshots)\n\tvar camera: Camera3D = game.get_node("CamRig/Camera3D")\n\tvar viewport_rect := Rect2(Vector2.ZERO, get_viewport().get_visible_rect().size)\n\tvar camera_visible_environment_meshes := 0\n\tif env_root and EXPECT_MATTERHORN:\n\t\tfor mesh in env_root.find_children("*", "MeshInstance3D", true, false):\n\t\t\tvar pixel := camera.unproject_position(mesh.global_position)\n\t\t\tif not camera.is_position_behind(mesh.global_position) and viewport_rect.has_point(pixel):\n\t\t\t\tcamera_visible_environment_meshes += 1\n\tif EXPECT_MATTERHORN:\n\t\tfor step in range(100):\n\t\t\tawait get_tree().create_timer(0.22).timeout\n\t\t\tfor i in game.attackers.size():\n\t\t\t\tvar a = game.attackers[i]\n\t\t\t\tvar pos: Vector2 = court.to_planar(a.global_position)\n\t\t\t\tvar key := str(i)\n\t\t\t\tif previous.has(key):\n\t\t\t\t\tvar old: Vector2 = previous[key]\n\t\t\t\t\tif old.distance_to(pos) > 2.0:\n\t\t\t\t\t\troute.walked = true\n\t\t\t\t\tif court.path_crosses_any_tube(old, pos):\n\t\t\t\t\t\troute.crossed_tube = true\n\t\t\t\tprevious[key] = pos\n\t\t\t\tif a.has_turned:\n\t\t\t\t\troute.turned_at_turn = true\n\t\t\t\t\tif court.in_head_zone(pos):\n\t\t\t\t\t\troute.returned_to_yun = true\n\t\t\tif step == 12:\n\t\t\t\t_shot("yun-environment-walk-run", screenshots)\n\t\t\tif route.turned_at_turn and step == 34:\n\t\t\t\t_shot("yun-environment-turn", screenshots)\n\t\t_shot("yun-environment-return", screenshots)\n\t\tgame.human_attacking = false\n\t\tgame._apply_roles()\n\t\tgame._begin_rush()\n\t\tfor a in game.attackers:\n\t\t\ta.set_process(false)\n\t\t\ta.set_physics_process(false)\n\t\tfor d in game.defenders:\n\t\t\td.set_process(false)\n\t\t\td.set_physics_process(false)\n\t\tvar tag_runner = game.attackers[0]\n\t\tvar tag_defender = game.defenders[0]\n\t\tvar tag_point: Vector2 = court.tube_center(0)\n\t\ttag_runner.active = true\n\t\ttag_runner.tagged = false\n\t\ttag_runner.safe_until_msec = 0\n\t\ttag_runner.hop_until_msec = 0\n\t\ttag_runner.global_position = court.to_world(tag_point)\n\t\ttag_defender.active = true\n\t\ttag_defender.global_position = court.to_world(tag_point)\n\t\tawait get_tree().physics_frame\n\t\ttag_defender._check_tags()\n\t\tawait get_tree().process_frame\n\t\ttag_gameplay_ok = tag_runner.tagged and game.phase == YunMatch.Phase.RESOLVE and game.human_attacking\n\t\t_shot("yun-environment-tag", screenshots)\n\tvar current_visible_players := 0\n\tfor node in game.attackers + game.defenders:\n\t\tif node.active and node.visible:\n\t\t\tcurrent_visible_players += 1\n\tvisible_players = maxi(visible_players, current_visible_players)\n\tvar camera_current := camera.current\n\tvar report := {"ok": geometry_ok and roster_ok and provider_ok and visible_players == 6 and (not EXPECT_MATTERHORN or (camera_visible_environment_meshes > 0 and route.walked and route.crossed_tube and route.turned_at_turn and route.returned_to_yun and tag_gameplay_ok)), "environmentOptIn": EXPECT_MATTERHORN, "environmentMeshCount": mesh_count, "cameraVisibleEnvironmentMeshes": camera_visible_environment_meshes, "runtimeObservationMs": Time.get_ticks_msec() - runtime_started_at_ms, "providerOk": provider_ok, "courtGeometryInvariant": geometry_ok, "playerCount": visible_players, "tagGameplayOk": tag_gameplay_ok, "route": route, "cameraCurrent": camera_current, "screenshots": screenshots}\n\tvar file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)\n\tif file:\n\t\tfile.store_string(JSON.stringify(report))\n\t\tfile.close()\n\tprint("YUN_ENVIRONMENT_RUNTIME_REPORT ", JSON.stringify(report))\n\nfunc _shot(label: String, screenshots: Array[String]) -> void:\n\tvar image := get_viewport().get_texture().get_image()\n\tif image:\n\t\tvar path := "res://tests/%s.png" % label\n\t\timage.save_png(ProjectSettings.globalize_path(path))\n\t\tscreenshots.append(path)\n`;
}

async function runYunMatchThroughFlyrail(projectDir: string, expectedMatterhorn: boolean, runtimeBudgetMs: number): Promise<Record<string, any>> {
  const client = new FlyrailClient({ requestTimeoutMs: 180_000 });
  let runtimeSessionId = "";
  let sessionId = "";
  try {
    await client.connect();
    const opened = await client.call("project.open", { path: projectDir, installAddons: true }) as { sessionId?: string };
    sessionId = opened.sessionId ?? "";
    assert.ok(sessionId, "Flyrail project.open returned a Yun project session");
    assert.ok(existsSync(join(projectDir, "assets", "matterhorn", "yun_street_block_calle_v1.glb")), "disposable Yun project contains the imported environment GLB");
    const validation = await client.call("test.validate_static", { sessionId }) as { ok?: boolean };
    assert.equal(validation.ok, true, `Flyrail static validation passed for the Yun project: ${JSON.stringify(validation)}`);
    const launched = await client.call("runtime.launch", {
      sessionId, scene: "res://scenes/match.tscn", headless: false,
      quitAfter: expectedMatterhorn ? 7200 : 1200,
    }) as { runtimeSessionId?: string; runtime?: { sessionId?: string }; process?: { processId?: string } };
    runtimeSessionId = launched.runtimeSessionId ?? launched.runtime?.sessionId ?? "";
    assert.ok(runtimeSessionId, `Flyrail runtime.launch started the real match scene: ${JSON.stringify(launched)}`);
    const reportPath = join(projectDir, "tests", "yun_environment_runtime.json");
    const deadline = Date.now() + runtimeBudgetMs;
    while (!existsSync(reportPath) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
    if (!existsSync(reportPath)) {
      const status = await client.call("runtime.status", { runtimeSessionId }).catch((error) => String(error));
      assert.fail(`Flyrail-launched Yun match emitted no runtime evidence. status=${JSON.stringify(status)}`);
    }
    let report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, any>;
    if (expectedMatterhorn) {
      const routeDeadline = Date.now() + 14_500;
      while ((!report.route?.returned_to_yun || report.route?.walked !== true) && Date.now() < routeDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, any>;
      }
    }
    await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    return report;
  } finally {
    if (runtimeSessionId) await client.call("runtime.stop", { runtimeSessionId }).catch(() => undefined);
    if (sessionId) await client.call("session.close", { sessionId }).catch(() => undefined);
    client.disconnect();
  }
}

test("Yun environment contract, fixture operations, and court invariance", { skip: !flyrailRoot() && "set FLYRAIL_REPO_ROOT to verify the production court source" }, () => {
  assert.equal(YUN_COURT_CONTRACT.planarToWorld, 0.025);
  assert.deepEqual(YUN_ENVIRONMENT_PLAY_X, [4, 24.8]);
  assert.equal(YUN_COURT_WORLD_METRICS.playableWidth, 20.8);
  assert.equal(YUN_COURT_WORLD_METRICS.headToTurnLength, 12.25);
  assert.deepEqual(validateYunEnvironmentSpec(YUN_FIRST_ENVIRONMENT_SPEC), []);
  const ops = buildYunEnvironmentOperations(YUN_FIRST_ENVIRONMENT_SPEC);
  assert.ok(ops.filter((op) => op.op === "mesh.create_primitive").length > 60);
  assert.equal(ops.filter((op) => op.op === "material.create").length, 10);
  assert.ok(!ops.some((op) => op.op === "mesh.create_primitive" && /yun_ring|turn_ring|tube_|spine|court_marking/i.test(op.name)));
  assert.equal(buildYunEnvironmentTaskSpec("C:\\temp").expectedArtifacts.filter((a) => a.kind === "png").length, 6);

  const repo = flyrailRoot();
  assert.ok(repo, "Flyrail source checkout is required for geometry invariant verification");
  const courtPath = join(repo!, "games", "yun", "scripts", "court.gd");
  const court = readFileSync(courtPath, "utf8");
  const head = spawnSync("git", ["show", "HEAD:games/yun/scripts/court.gd"], { cwd: repo, encoding: "utf8" });
  assert.equal(head.status, 0);
  assert.equal(court.replace(/\r\n/g, "\n"), String(head.stdout).replace(/\r\n/g, "\n"), "production court.gd must remain unchanged");
  assert.match(court, /const COURT_LEFT := 160\.0/);
  assert.match(court, /const COURT_RIGHT := 992\.0/);
  assert.match(court, /const HEAD_Y := 70\.0/);
  assert.match(court, /const FAR_Y := 560\.0/);
  assert.match(court, /const TUBE_Y: Array\[float\] = \[190\.0, 320\.0, 450\.0\]/);
  assert.match(court, /var offsets: Array\[float\] = \[-100\.0, -55\.0, 100\.0\]/);
  assert.match(court, /func defender_spawn\(index: int\).*?return tube_center\(index\)/s);
});

test("environment contract rejects court overlap and duplicate prop IDs", () => {
  const overlap = { ...YUN_FIRST_ENVIRONMENT_SPEC, props: [{ id: "bad", kind: "bench" as const, position: [4.2, 0, 9] as const }] };
  assert.match(validateYunEnvironmentSpec(overlap).join("; "), /intrudes into authoritative playable X region/);
  const duplicate = { ...YUN_FIRST_ENVIRONMENT_SPEC, props: [...YUN_FIRST_ENVIRONMENT_SPEC.props, YUN_FIRST_ENVIRONMENT_SPEC.props[0]!] };
  assert.match(validateYunEnvironmentSpec(duplicate).join("; "), /duplicate prop id/);
  const gameplay = { ...YUN_FIRST_ENVIRONMENT_SPEC, includesGameplayCourtGeometry: true } as unknown as typeof YUN_FIRST_ENVIRONMENT_SPEC;
  assert.match(validateYunEnvironmentSpec(gameplay).join("; "), /must not replace authoritative YunCourt/);
});

test("production Calle provider is opt-in and Kenney rollback remains available", { skip: !flyrailRoot() && "set FLYRAIL_REPO_ROOT to inspect the production provider" }, () => {
  const repo = flyrailRoot();
  assert.ok(repo, "Flyrail source checkout is required for provider verification");
  const root = join(repo!, "games", "yun");
  const settings = readFileSync(join(root, "scripts", "game_settings.gd"), "utf8");
  const streetKit = readFileSync(join(root, "scripts", "street_kit.gd"), "utf8");
  const menu = readFileSync(join(root, "scripts", "main_menu.gd"), "utf8");
  const map = readFileSync(join(root, "scripts", "yun_map.gd"), "utf8");
  assert.match(settings, /var environment_provider: String = "kenney"/);
  assert.match(settings, /"kenney", "matterhorn_calle"/);
  assert.match(streetKit, /environment_provider\(\) == "matterhorn_calle"/);
  assert.match(streetKit, /res:\/\/assets\/matterhorn\/yun_street_block_calle_v1\.glb/);
  assert.match(streetKit, /return _layout_calle\(court, false\)/);
  assert.match(menu, /Matterhorn Calle/);
  assert.match(menu, /set_environment_provider\(next\)/);
  assert.match(map, /static func apply_world/);
  assert.match(streetKit, /func dress\(court: Node3D, map_id := 0\)/);
});

test("Yun environment generation, report sanity, and Flyrail import", { skip: !flyrailRoot() && "set FLYRAIL_REPO_ROOT; the dedicated live runner requires it" }, async (t) => {
  const blender = findBlenderExecutable();
  if (!blender) { t.skip("Blender unavailable; mandatory live runner reports this as failure"); return; }
  if (!existsSync(DEFAULT_GODOT_BIN)) { t.skip("Godot unavailable; mandatory live runner reports this as failure"); return; }
  const client = new FlyrailClient();
  let flyrailUp = false;
  try { const h = await client.health(); flyrailUp = h.ok && h.product === "flyrail"; } catch { /* unavailable */ }
  finally { client.disconnect(); }
  if (!flyrailUp) { t.skip("Flyrail daemon unavailable; mandatory live runner reports this as failure"); return; }

  const temp = mkdtempSync(join(tmpdir(), "matterhorn-yun-environment-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: temp, blenderBin: blender });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1", id: "h-yun-calle-env", taskId: "t-yun-calle-env",
      from: "matterhorn", to: "blender-engine", goal: "Generate Yun environment yun_street_block_calle_v1",
      acceptanceCriteria: ["Yun environment Blender scene and GLB"], inputArtifacts: [],
    };
    const accepted = await adapter.submitTask(handoff);
    assert.equal(accepted.accepted, true);
    const result = await adapter.getResult(handoff.taskId);
    assert.equal(result.status, "completed", result.summary);
    const workDir = join(temp, handoff.taskId);
    assert.ok(existsSync(join(workDir, "blender-task.json")), "Blender task manifest preserved");
    assert.ok(existsSync(join(workDir, "blender-result.json")), "Blender result manifest preserved");
    const sanity = runYunEnvironmentVisualSanity({ workDir, spec: YUN_FIRST_ENVIRONMENT_SPEC });
    assert.equal(sanity.ok, true, JSON.stringify(sanity.checks.filter((c) => !c.ok), null, 2));
    assert.ok((sanity.geometry?.vertices ?? 0) > 200);

    const archive = resolve(process.cwd(), "artifacts", "yun-environment-candidate", YUN_FIRST_ENVIRONMENT_SPEC.assetId);
    mkdirSync(archive, { recursive: true });
    for (const name of readdirSync(workDir)) {
      const source = join(workDir, name);
      if (statSync(source).isFile() && !name.toLowerCase().endsWith(".pyc")) cpSync(source, join(archive, name));
    }
    writeFileSync(join(archive, "visual-sanity.json"), JSON.stringify(sanity, null, 2));

    const glb = join(workDir, `${YUN_FIRST_ENVIRONMENT_SPEC.assetId}.glb`);
    const productionRoot = flyrailRoot();
    assert.ok(productionRoot, "Flyrail repository root is required for production asset installation");
    const productionAssetDir = join(productionRoot!, "games", "yun", "assets", "matterhorn");
    mkdirSync(productionAssetDir, { recursive: true });
    cpSync(glb, join(productionAssetDir, `${YUN_FIRST_ENVIRONMENT_SPEC.assetId}.glb`));
    const disposable = join(temp, "godot-yun-environment-glb");
    const { report, result: flyrailResult } = await validateGlbThroughFlyrail({
      glbSourcePath: glb, disposableProjectDir: disposable,
      fixtureSourceDir: resolveDisposableGodotFixture(),
      assetFileName: `${YUN_FIRST_ENVIRONMENT_SPEC.assetId}.glb`,
      requireSkeleton: false, requireAnimations: [],
    });
    assert.equal(flyrailResult.specialistId, "flyrail");
    assert.equal(flyrailResult.status, "completed", flyrailResult.summary);
    assert.ok(report.probe?.ok);
    assert.ok((report.probe?.childCount ?? 0) >= 60, "imported environment root contains expected prop meshes");
    mkdirSync(join(archive, "flyrail"), { recursive: true });
    writeFileSync(join(archive, "flyrail", "import-validation.json"), JSON.stringify({ report, result: flyrailResult }, null, 2));
    for (const name of readdirSync(disposable)) if (name.endsWith(".png")) cpSync(join(disposable, name), join(archive, "flyrail", name));

    const sourceGame = join(productionRoot!, "games", "yun");
    const matterhornProject = join(temp, "yun-match-matterhorn");
    createDisposableYunProject(sourceGame, matterhornProject, true);
    // Godot editor import builds the disposable project's global script-class cache.
    // The actual match launch, scene tree and runtime evidence still run through Flyrail below.
    runGodotEditorImport(matterhornProject, DEFAULT_GODOT_BIN);
    const runtimeEvidence = await runYunMatchThroughFlyrail(matterhornProject, true, 30_000);
    assert.equal(runtimeEvidence.ok, true, JSON.stringify(runtimeEvidence));
    assert.equal(runtimeEvidence.courtGeometryInvariant, true);
    assert.equal(runtimeEvidence.environmentMeshCount > 50, true);
    assert.equal(runtimeEvidence.cameraVisibleEnvironmentMeshes > 0, true);
    assert.equal(runtimeEvidence.runtimeObservationMs >= 20_000, true);
    assert.equal(runtimeEvidence.playerCount, 6);
    assert.equal(runtimeEvidence.route.walked, true);
    assert.equal(runtimeEvidence.route.crossed_tube, true);
    assert.equal(runtimeEvidence.route.turned_at_turn, true);
    assert.equal(runtimeEvidence.route.returned_to_yun, true);
    assert.equal(runtimeEvidence.tagGameplayOk, true);
    mkdirSync(join(archive, "godot"), { recursive: true });
    cpSync(join(matterhornProject, "tests", "yun_environment_runtime.json"), join(archive, "godot", "matterhorn-runtime.json"));
    for (const name of readdirSync(join(matterhornProject, "tests"))) {
      if (name.startsWith("yun-environment-") && name.endsWith(".png")) cpSync(join(matterhornProject, "tests", name), join(archive, "godot", name));
    }

    const fallbackProject = join(temp, "yun-match-kenney-fallback");
    createDisposableYunProject(sourceGame, fallbackProject, false);
    runGodotEditorImport(fallbackProject, DEFAULT_GODOT_BIN);
    const fallbackEvidence = await runYunMatchThroughFlyrail(fallbackProject, false, 8_000);
    assert.equal(fallbackEvidence.ok, true, JSON.stringify(fallbackEvidence));
    assert.equal(fallbackEvidence.providerOk, true);
    assert.equal(fallbackEvidence.environmentMeshCount, 0);
    assert.equal(fallbackEvidence.playerCount, 6);
    cpSync(join(fallbackProject, "tests", "yun_environment_runtime.json"), join(archive, "godot", "kenney-fallback-runtime.json"));
    t.diagnostic(`Environment PASS: ${JSON.stringify({ archive, geometry: sanity.geometry, objects: sanity.objectCount, materials: sanity.materials?.length, glbBytes: statSync(glb).size, flyrail: flyrailResult.status })}`);
  } finally {
    try { rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 }); }
    catch (error) { t.diagnostic(`Disposable Flyrail test root retained because Windows still holds it: ${temp} (${String(error)})`); }
  }
});
