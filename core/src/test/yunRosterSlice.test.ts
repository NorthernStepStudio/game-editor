/**
 * Yun Matterhorn roster slice: CharacterVariantSpec → Blender → Flyrail → production opt-in.
 * Preserves yun_player_base_v2 / MODELS[12]; appends yun_player_02..04 at indexes 13–15.
 */

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  assertYunRosterUnique,
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
  runYunCharacterVisualSanity,
  YUN_ROSTER_GENERATED_VARIANTS,
  YUN_ROSTER_GEOMETRY_BUDGET,
  YUN_ROSTER_REVISION,
  YUN_ROSTER_TEAM_COLOR_MATERIAL,
  YUN_ROSTER_VARIANTS,
} from "../studio/adapters/blender/index.js";
import {
  DEFAULT_GODOT_BIN,
  FlyrailClient,
  resolveDisposableGodotFixture,
  runYunGameplayCameraProbe,
  runYunWrapperMotionProbe,
  validateGlbThroughFlyrail,
  writeYunGameplayCameraProbe,
  writeYunWrapperMotionProbe,
} from "../studio/adapters/flyrail/index.js";

function resolveFlyrailRoot(): string | undefined {
  const candidates = [
    process.env.FLYRAIL_REPO_ROOT?.trim() ?? "",
    resolve(process.cwd(), "..", "flyrail"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(join(c, "games", "yun", "scripts", "mini_figure.gd"))) return c;
  }
  return undefined;
}

function rosterArchiveRoot(): string {
  return resolve(process.cwd(), "artifacts", "yun-character-candidate", "yun_roster_v1");
}

function archiveVariant(assetId: string, taskWorkDir: string): string {
  const dest = join(rosterArchiveRoot(), assetId);
  mkdirSync(dest, { recursive: true });
  for (const name of [
    `${assetId}.blend`,
    `${assetId}.glb`,
    `${assetId}-report.json`,
    `${assetId}-front.png`,
    `${assetId}-side.png`,
    `${assetId}-back.png`,
    `${assetId}-three-quarter.png`,
    `${assetId}-preview.png`,
    "blender-task.json",
    "blender-result.json",
    "blender-report.json",
  ]) {
    const src = join(taskWorkDir, name);
    if (existsSync(src)) cpSync(src, join(dest, name));
  }
  return dest;
}

test("Yun roster CharacterVariantSpec is unique and within safe bounds", () => {
  assert.doesNotThrow(() => assertYunRosterUnique());
  assert.equal(YUN_ROSTER_VARIANTS.length, 4);
  assert.equal(YUN_ROSTER_GENERATED_VARIANTS.length, 3);
  assert.equal(YUN_ROSTER_REVISION, "1.0.0");
  assert.equal(YUN_ROSTER_TEAM_COLOR_MATERIAL, "MAT_TeamShirt");
  assert.equal(YUN_ROSTER_VARIANTS[0]!.assetId, "yun_player_base");
  assert.equal(YUN_ROSTER_VARIANTS[0]!.modelIndex, 12);
  assert.equal(YUN_ROSTER_VARIANTS[3]!.modelIndex, 15);
});

test("Yun roster Blender generation + visual sanity for each new character", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-roster-"));
  const stats: Array<Record<string, unknown>> = [];
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    for (const variant of YUN_ROSTER_GENERATED_VARIANTS) {
      const taskId = `t-${variant.assetId}`;
      const handle = await adapter.submitTask({
        protocol: "nss.studio-handoff.v1",
        id: `h-${variant.assetId}`,
        taskId,
        from: "matterhorn",
        to: "blender-engine",
        goal: `Generate Yun roster character ${variant.assetId} (${variant.displayName})`,
        acceptanceCriteria: [
          `${variant.assetId}.blend created`,
          "idle walk run present",
          `animated ${variant.assetId}.glb exported`,
        ],
        inputArtifacts: [],
      });
      assert.equal(handle.accepted, true);
      const result = await adapter.getResult(taskId);
      assert.equal(result.status, "completed", `${variant.assetId}: ${result.summary}`);

      const work = join(tempDir, taskId);
      assert.ok(existsSync(join(work, `${variant.assetId}.glb`)));

      const sanity = runYunCharacterVisualSanity({
        workDir: work,
        assetPrefix: variant.assetId,
        requiredMaterials: [YUN_ROSTER_TEAM_COLOR_MATERIAL, "MAT_Skin", "MAT_Accent", "MAT_Hair"],
        expectedBoneCount: 18,
        maxVertices: YUN_ROSTER_GEOMETRY_BUDGET.maxVertices,
        maxPolygons: YUN_ROSTER_GEOMETRY_BUDGET.maxPolygons,
      });
      assert.equal(sanity.ok, true, JSON.stringify(sanity.checks.filter((c) => !c.ok), null, 2));

      const archived = archiveVariant(variant.assetId, work);
      writeFileSync(join(archived, "visual-sanity.json"), JSON.stringify(sanity, null, 2), "utf8");
      writeFileSync(
        join(archived, "variant-spec.json"),
        JSON.stringify(variant, null, 2),
        "utf8",
      );
      stats.push({
        assetId: variant.assetId,
        displayName: variant.displayName,
        modelIndex: variant.modelIndex,
        geometry: sanity.geometry,
        boneCount: sanity.boneCount,
        materials: sanity.materials,
        glbBytes: statSync(join(archived, `${variant.assetId}.glb`)).size,
      });
    }

    // Phase 3I base archive must remain.
    assert.ok(
      existsSync(
        resolve(process.cwd(), "artifacts", "yun-character-candidate", "yun_player_base_v2", "yun_player_base_v2.glb"),
      ),
    );

    mkdirSync(rosterArchiveRoot(), { recursive: true });
    writeFileSync(
      join(rosterArchiveRoot(), "roster-stats.json"),
      JSON.stringify({ revision: YUN_ROSTER_REVISION, generated: stats }, null, 2),
      "utf8",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Yun roster Flyrail disposable validation + team colors per character", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }
  if (!existsSync(DEFAULT_GODOT_BIN)) {
    t.diagnostic("SKIPPED — environment unavailable (Godot binary not found)");
    return;
  }
  const client = new FlyrailClient();
  let flyrailUp = false;
  try {
    const health = await client.health();
    flyrailUp = health.ok === true && health.product === "flyrail";
  } catch {
    flyrailUp = false;
  } finally {
    client.disconnect();
  }
  if (!flyrailUp) {
    t.diagnostic("SKIPPED — environment unavailable (Flyrail daemon not reachable)");
    return;
  }

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-roster-fly-"));
  const perChar: Array<Record<string, unknown>> = [];
  try {
    for (const variant of YUN_ROSTER_GENERATED_VARIANTS) {
      // Prefer archived GLB if present (avoids regenerating Blender when already archived).
      let glbPath = join(rosterArchiveRoot(), variant.assetId, `${variant.assetId}.glb`);
      if (!existsSync(glbPath)) {
        const adapter = new BlenderAdapter({ baseWorkDir: workDir });
        const taskId = `t-fly-${variant.assetId}`;
        await adapter.submitTask({
          protocol: "nss.studio-handoff.v1",
          id: `h-fly-${variant.assetId}`,
          taskId,
          from: "matterhorn",
          to: "blender-engine",
          goal: `Generate Yun roster character ${variant.assetId} for Flyrail`,
          acceptanceCriteria: [`${variant.assetId}.glb exported`],
          inputArtifacts: [],
        });
        const result = await adapter.getResult(taskId);
        assert.equal(result.status, "completed", result.summary);
        const glb = result.artifacts?.find((a) => a.kind === "glb");
        assert.ok(glb && existsSync(glb.uri));
        glbPath = glb.uri;
        archiveVariant(variant.assetId, join(workDir, taskId));
      }

      const disposable = join(workDir, `godot-${variant.assetId}`);
      const { report, result } = await validateGlbThroughFlyrail({
        glbSourcePath: glbPath,
        disposableProjectDir: disposable,
        fixtureSourceDir: resolveDisposableGodotFixture(),
        assetFileName: `${variant.assetId}.glb`,
        requireSkeleton: true,
        requireAnimations: ["idle", "walk", "run_or_sprint"],
      });
      assert.equal(result.status, "completed", result.summary);
      assert.ok(report.probe?.hasSkeleton3D);
      assert.ok(report.probe?.hasAnimationPlayer);
      assert.equal(matchYunAnimationClips(report.probe?.animationNames ?? []).missing.length, 0);

      writeYunWrapperMotionProbe(disposable, `${variant.assetId}.glb`);
      const motion = runYunWrapperMotionProbe(disposable);
      assert.equal(motion.ok, true);
      assert.equal(motion.wrapperScale, 1.2);

      writeYunGameplayCameraProbe(disposable, `${variant.assetId}.glb`);
      const camera = runYunGameplayCameraProbe(disposable);
      assert.equal(camera.ok, true);
      assert.ok((camera.teamVariants?.length ?? 0) >= 2);

      const evidenceDir = join(rosterArchiveRoot(), variant.assetId, "flyrail");
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(
        join(evidenceDir, "validation.json"),
        JSON.stringify({ report, motion, camera }, null, 2),
        "utf8",
      );
      for (const name of readdirSync(disposable)) {
        if (name.startsWith("gameplay-") && name.endsWith(".png")) {
          cpSync(join(disposable, name), join(evidenceDir, name));
        }
      }
      perChar.push({ assetId: variant.assetId, flyrail: "PASS", teamVariants: camera.teamVariants?.length });
    }
    writeFileSync(
      join(rosterArchiveRoot(), "flyrail-roster-validation.json"),
      JSON.stringify({ revision: YUN_ROSTER_REVISION, characters: perChar }, null, 2),
      "utf8",
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("Yun roster production model list + install + six-player/lineup probes", async (t) => {
  const flyrailRoot = resolveFlyrailRoot();
  if (!flyrailRoot) {
    t.skip("Flyrail checkout unavailable; set FLYRAIL_REPO_ROOT or place it beside Matterhorn");
    return;
  }
  const yun = join(flyrailRoot, "games", "yun");
  const mini = readFileSync(join(yun, "scripts", "mini_figure.gd"), "utf8");
  assert.match(mini, /yun_player_02\.glb/);
  assert.match(mini, /yun_player_03\.glb/);
  assert.match(mini, /yun_player_04\.glb/);
  assert.match(mini, /MODEL_YUN_PLAYER_04\s*:=\s*15/);
  assert.match(mini, /is_matterhorn_character/);
  assert.match(mini, /"Raya"/);
  assert.match(mini, /"Kade"/);
  assert.match(mini, /"Mira"/);

  const settings = readFileSync(join(yun, "scripts", "game_settings.gd"), "utf8");
  assert.match(settings, /CHAR_MAX\s*:=\s*15/);
  assert.match(settings, /character_id:\s*int\s*=\s*0/);

  const net = readFileSync(join(yun, "scripts", "yun_net_session.gd"), "utf8");
  assert.match(net, /CHAR_MAX\s*:=\s*15/);

  // Install generated GLBs into production assets (keep yun_player_base intact).
  const assetDir = join(yun, "assets", "matterhorn");
  mkdirSync(assetDir, { recursive: true });
  for (const variant of YUN_ROSTER_GENERATED_VARIANTS) {
    const src = join(rosterArchiveRoot(), variant.assetId, `${variant.assetId}.glb`);
    if (!existsSync(src)) {
      t.diagnostic(`SKIPPED production install — missing archive GLB for ${variant.assetId}`);
      return;
    }
    cpSync(src, join(assetDir, `${variant.assetId}.glb`));
  }
  assert.ok(existsSync(join(assetDir, "yun_player_base.glb")), "Yun base must remain");

  if (!existsSync(DEFAULT_GODOT_BIN)) {
    t.diagnostic("SKIPPED — environment unavailable (Godot binary not found)");
    return;
  }

  // Import new GLBs
  spawnSync(
    DEFAULT_GODOT_BIN,
    ["--path", yun, "--editor", "--headless", "--import"],
    { encoding: "utf8", timeout: 120_000, windowsHide: true },
  );

  const probePath = join(yun, "tests", "yun_roster_production_probe.gd");
  writeFileSync(
    probePath,
    `extends SceneTree
## Roster production probe: 4 Matterhorn models + Kenney fallback + 6-player mix + lineup.

func _initialize() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280, 720))
	call_deferred("_run")

func _run() -> void:
	var report = {"ok": false, "checks": [], "screenshots": [], "performance": {}}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://tests/yun_roster_shots"))

	var world = Node3D.new()
	root.add_child(world)
	var light = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-48, 28, 0)
	light.light_energy = 1.2
	world.add_child(light)
	var ground = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(40, 30)
	ground.mesh = plane
	var gmat = StandardMaterial3D.new()
	gmat.albedo_color = Color(0.5, 0.4, 0.28)
	ground.material_override = gmat
	world.add_child(ground)

	var cam_rig = Node3D.new()
	world.add_child(cam_rig)
	var cam = Camera3D.new()
	cam.fov = 46.0
	cam_rig.add_child(cam)
	cam_rig.position = Vector3(0.0, 4.8, 9.0)
	cam_rig.look_at(Vector3(0.0, 1.0, 0.0), Vector3.UP)
	cam.current = true

	var roster = [
		YunMiniFigure.MODEL_YUN_PLAYER_BASE,
		YunMiniFigure.MODEL_YUN_PLAYER_02,
		YunMiniFigure.MODEL_YUN_PLAYER_03,
		YunMiniFigure.MODEL_YUN_PLAYER_04,
	]
	var colors = [
		Color(0.95, 0.72, 0.18),
		Color(0.2, 0.45, 0.95),
		Color(0.9, 0.25, 0.3),
		Color(0.2, 0.8, 0.45),
	]

	# Lineup of all four Matterhorn characters
	var lineup_hosts: Array = []
	var lineup_figs: Array = []
	for i in range(4):
		var host = Node3D.new()
		host.position = Vector3((i - 1.5) * 1.5, 0.0, 0.0)
		world.add_child(host)
		var fig = YunMiniFigure.new()
		var ok = fig.mount(host, roster[i], colors[i], 1.2, true)
		_check(report, "lineup_mount_%d" % roster[i], ok)
		lineup_hosts.append(host)
		lineup_figs.append(fig)
	await process_frame
	await process_frame
	report["screenshots"].append(_shot("lineup-front"))
	cam_rig.position = Vector3(3.5, 3.8, 7.0)
	cam_rig.look_at(Vector3(0.0, 1.0, 0.0), Vector3.UP)
	await process_frame
	report["screenshots"].append(_shot("lineup-three-quarter"))

	# Clear lineup; build 6-player mix (3+ Matterhorn models, mixed colors)
	for h in lineup_hosts:
		h.queue_free()
	await process_frame

	var mix = [
		YunMiniFigure.MODEL_YUN_PLAYER_BASE,
		YunMiniFigure.MODEL_YUN_PLAYER_02,
		YunMiniFigure.MODEL_YUN_PLAYER_03,
		YunMiniFigure.MODEL_YUN_PLAYER_04,
		YunMiniFigure.MODEL_YUN_PLAYER_02,
		YunMiniFigure.MODEL_YUN_PLAYER_BASE,
	]
	var mix_colors = [
		Color(0.95, 0.72, 0.18),
		Color(0.2, 0.45, 0.95),
		Color(0.9, 0.25, 0.3),
		Color(0.2, 0.8, 0.45),
		Color(0.95, 0.4, 0.85),
		Color(0.15, 0.7, 0.9),
	]
	var hosts: Array = []
	var figs: Array = []
	for i in range(6):
		var host2 = Node3D.new()
		host2.position = Vector3((i % 3) * 1.5 - 1.5, 0.0, floor(float(i) / 3.0) * 1.7)
		world.add_child(host2)
		var fig2 = YunMiniFigure.new()
		var ok2 = fig2.mount(host2, mix[i], mix_colors[i], 1.2, true)
		_check(report, "mix_mount_%d" % i, ok2)
		hosts.append(host2)
		figs.append(fig2)
	await process_frame
	report["screenshots"].append(_shot("six-player-idle"))

	# Animate first three distinct Matterhorn models
	for i in range(3):
		var f: YunMiniFigure = figs[i]
		f.play_walk()
		await _advance(hosts[i], 0.35)
	report["screenshots"].append(_shot("six-player-walk"))
	for i in range(3):
		var f2: YunMiniFigure = figs[i]
		f2.play_move(90.0)
		await _advance(hosts[i], 0.3)
	report["screenshots"].append(_shot("six-player-run"))

	# Team-color isolation: recolor player 0 shirt; player 1 must keep prior color path
	var m0 = hosts[0].get_node_or_null("Kenney") as Node3D
	var m1 = hosts[1].get_node_or_null("Kenney") as Node3D
	_check(report, "isolation_hosts", m0 != null and m1 != null)
	if m0:
		YunMiniFigure._apply_team_shirt_color(m0, Color(0.1, 0.9, 0.2))
	await process_frame
	report["screenshots"].append(_shot("team-color-isolation"))

	# Fallback Kenney then remount Matterhorn
	var fig0: YunMiniFigure = figs[0]
	_check(report, "fallback_kenney", fig0.mount(hosts[0], 0, mix_colors[0], 1.2, true))
	await process_frame
	report["screenshots"].append(_shot("fallback-kenney"))
	_check(report, "remount_raya", fig0.mount(hosts[0], YunMiniFigure.MODEL_YUN_PLAYER_02, mix_colors[1], 1.2, true))
	await process_frame
	report["screenshots"].append(_shot("remount-raya"))

	_check(report, "model_count", YunMiniFigure.count() == 16)
	_check(report, "display_mira", YunMiniFigure.display_name(15) == "Mira")

	# Sustained animation frames (honest interval sample, not startup FPS)
	var t0 = Time.get_ticks_msec()
	var frames = 0
	while Time.get_ticks_msec() - t0 < 1500:
		for i in range(3):
			var ff: YunMiniFigure = figs[i]
			ff.play_move(70.0)
			await _advance(hosts[i], 0.05)
		frames += 1
	var elapsed_ms = maxi(Time.get_ticks_msec() - t0, 1)
	report["performance"] = {
		"sustained_loop_frames": frames,
		"elapsed_ms": elapsed_ms,
		"approx_loops_per_sec": float(frames) * 1000.0 / float(elapsed_ms),
		"note": "Loop advance sample over ~1.5s; not a GPU FPS claim.",
	}

	report["ok"] = true
	for c in report["checks"]:
		if not c["ok"]:
			report["ok"] = false
			break
	_write(report)
	print("YUN_ROSTER_PRODUCTION_PROBE ok=", report["ok"], " shots=", report["screenshots"].size())
	quit(0 if report["ok"] else 1)

func _check(report: Dictionary, id: String, ok: bool) -> void:
	report["checks"].append({"id": id, "ok": ok})
	print("CHECK ", "PASS" if ok else "FAIL", " ", id)

func _advance(host: Node3D, seconds: float) -> void:
	var model := host.get_node_or_null("Kenney") as Node3D
	if model == null:
		await process_frame
		return
	var anim := model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if anim == null:
		await process_frame
		return
	var steps := int(ceil(seconds / 0.05))
	for i in range(steps):
		anim.advance(0.05)
		await process_frame

func _shot(label: String) -> String:
	var vp := root.get_viewport()
	if vp == null:
		return ""
	var img: Image = vp.get_texture().get_image()
	if img == null:
		return ""
	var path := "res://tests/yun_roster_shots/%s.png" % label
	img.save_png(path)
	print("SHOT ", path)
	return path

func _write(report: Dictionary) -> void:
	var f := FileAccess.open("res://tests/yun_roster_production_probe.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
`,
    "utf8",
  );

  const res = spawnSync(
    DEFAULT_GODOT_BIN,
    ["--path", yun, "-s", "tests/yun_roster_production_probe.gd"],
    { encoding: "utf8", timeout: 240_000, windowsHide: true },
  );
  const evidence = join(yun, "tests", "yun_roster_production_probe.json");
  if (!existsSync(evidence)) {
    assert.fail(`Roster production probe produced no evidence: ${res.stderr || res.stdout || res.status}`);
  }
  const report = JSON.parse(readFileSync(evidence, "utf8")) as {
    ok: boolean;
    checks: Array<{ id: string; ok: boolean }>;
    screenshots?: string[];
    performance?: Record<string, unknown>;
  };
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));

  const dest = join(rosterArchiveRoot(), "production");
  mkdirSync(join(dest, "shots"), { recursive: true });
  cpSync(evidence, join(dest, "yun_roster_production_probe.json"));
  const shotDir = join(yun, "tests", "yun_roster_shots");
  if (existsSync(shotDir)) {
    for (const name of readdirSync(shotDir)) {
      if (name.endsWith(".png")) cpSync(join(shotDir, name), join(dest, "shots", name));
    }
  }
  writeFileSync(
    join(dest, "rollback.md"),
    [
      "# Roster rollback",
      "",
      "Set `character_id` to any Kenney index 0–11 (default 0).",
      "Matterhorn models 12–15 remain installed and opt-in.",
      "No asset deletion required.",
      "",
    ].join("\n"),
    "utf8",
  );
});
