/**
 * Production Yun character opt-in path: yun_player_base coexists with Kenney.
 * Verifies selector entry, resource resolution, animations, scale, and Kenney fallback.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { DEFAULT_GODOT_BIN } from "../studio/adapters/flyrail/index.js";
import { matchYunAnimationClips, YUN_CHARACTER_CONTRACT } from "../studio/adapters/blender/index.js";

function resolveFlyrailRoot(): string {
  const candidates = [
    process.env.FLYRAIL_REPO_ROOT ?? "",
    resolve(process.cwd(), "..", "flyrail"),
    "D:\\dev\\Northern Step Studio\\apps\\flyrail",
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(join(c, "games", "yun", "scripts", "mini_figure.gd"))) return c;
  }
  return candidates[candidates.length - 1]!;
}

function yunProductionPaths(flyrailRoot: string) {
  const yun = join(flyrailRoot, "games", "yun");
  return {
    yun,
    miniFigure: join(yun, "scripts", "mini_figure.gd"),
    gameSettings: join(yun, "scripts", "game_settings.gd"),
    netSession: join(yun, "scripts", "yun_net_session.gd"),
    yunGlb: join(yun, "assets", "matterhorn", "yun_player_base.glb"),
    kenneyGlb: join(yun, "assets", "kenney", "mini_characters", "character-male-a.glb"),
    project: yun,
  };
}

test("yun production character integration: selector + resources + fallback", () => {
  const flyrailRoot = resolveFlyrailRoot();
  const paths = yunProductionPaths(flyrailRoot);
  assert.ok(existsSync(paths.miniFigure), `mini_figure.gd missing under ${flyrailRoot}`);

  const mini = readFileSync(paths.miniFigure, "utf8");
  assert.match(mini, /yun_player_base\.glb/);
  assert.match(mini, /MODEL_YUN_PLAYER_BASE\s*:=\s*12/);
  assert.match(mini, /character-male-a\.glb/);
  assert.match(mini, /_apply_team_shirt_color/);

  const settings = readFileSync(paths.gameSettings, "utf8");
  assert.match(settings, /CHAR_MAX\s*:=\s*12/);
  assert.match(settings, /"Yun"/);
  // Default remains Kenney (character_id = 0).
  assert.match(settings, /character_id:\s*int\s*=\s*0/);

  const net = readFileSync(paths.netSession, "utf8");
  assert.match(net, /CHAR_MAX\s*:=\s*12/);

  assert.ok(existsSync(paths.kenneyGlb), "Kenney fallback GLB must still exist");
  assert.ok(existsSync(paths.yunGlb), "Opt-in yun_player_base.glb must be present in production assets");
  assert.ok(statSync(paths.yunGlb).size > 1024);

  assert.equal(YUN_CHARACTER_CONTRACT.scaleOrientation.wrapperDefaultScale, 1.2);
  assert.equal(YUN_CHARACTER_CONTRACT.materials.preferredTeamColorMaterial, "MAT_TeamShirt");
});

test("yun production character runtime probe: mount yun + kenney fallback", async (t) => {
  if (!existsSync(DEFAULT_GODOT_BIN)) {
    t.diagnostic("SKIPPED — environment unavailable (Godot binary not found)");
    return;
  }
  const flyrailRoot = resolveFlyrailRoot();
  const paths = yunProductionPaths(flyrailRoot);
  if (!existsSync(paths.yunGlb)) {
    t.diagnostic("SKIPPED — yun_player_base.glb not yet installed in production assets");
    return;
  }

  const scriptPath = join(paths.yun, "tests", "yun_production_character_probe.gd");
  const evidencePath = join(paths.yun, "tests", "yun_production_character_probe.json");
  mkdirSync(join(paths.yun, "tests"), { recursive: true });

  const script = `extends SceneTree
## Production opt-in character probe — does not alter saved settings permanently.

func _init() -> void:
	var report = {"ok": false, "checks": []}
	var fig = YunMiniFigure.new()
	var host = Node3D.new()
	root.add_child(host)

	var ok_yun = fig.mount(host, YunMiniFigure.MODEL_YUN_PLAYER_BASE, Color(0.95, 0.72, 0.18), 1.2, true)
	report["checks"].append({"id": "mount_yun", "ok": ok_yun})
	var kenney = host.get_node_or_null("Kenney") as Node3D
	report["checks"].append({"id": "yun_child", "ok": kenney != null})
	report["checks"].append({"id": "yun_scale", "ok": kenney != null and is_equal_approx(kenney.scale.x, 1.2)})
	var anim = kenney.find_child("AnimationPlayer", true, false) as AnimationPlayer if kenney else null
	var names: Array = []
	if anim:
		for c in anim.get_animation_list():
			names.append(str(c))
	report["yunAnimations"] = names
	var has_idle = false
	var has_walk = false
	var has_run = false
	for c in names:
		var low = str(c).to_lower()
		if low.contains("idle"): has_idle = true
		if low.contains("walk") and not low.contains("wheel"): has_walk = true
		if low.contains("run") or low.contains("sprint"): has_run = true
	report["checks"].append({"id": "yun_anims", "ok": has_idle and has_walk and has_run})

	var ok_kenney = fig.mount(host, 0, Color(0.2, 0.6, 1.0), 1.2, true)
	report["checks"].append({"id": "mount_kenney_fallback", "ok": ok_kenney})
	var kenney2 = host.get_node_or_null("Kenney") as Node3D
	report["checks"].append({"id": "kenney_child", "ok": kenney2 != null})
	report["checks"].append({"id": "model_count", "ok": YunMiniFigure.count() >= 13})
	report["checks"].append({"id": "display_yun", "ok": YunMiniFigure.display_name(12) == "Yun"})

	report["ok"] = true
	for c in report["checks"]:
		if not c["ok"]:
			report["ok"] = false
			break
	var f = FileAccess.open("res://tests/yun_production_character_probe.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report))
		f.close()
	quit(0 if report["ok"] else 1)
`;
  writeFileSync(scriptPath, script, "utf8");

  const res = spawnSync(
    DEFAULT_GODOT_BIN,
    ["--path", paths.project, "--headless", "-s", "tests/yun_production_character_probe.gd"],
    { encoding: "utf8", timeout: 180_000, windowsHide: true },
  );
  if (!existsSync(evidencePath)) {
    assert.fail(`Production probe produced no evidence: ${res.stderr || res.stdout || res.status}`);
  }
  const report = JSON.parse(readFileSync(evidencePath, "utf8")) as {
    ok: boolean;
    checks: Array<{ id: string; ok: boolean }>;
    yunAnimations?: string[];
  };
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(matchYunAnimationClips(report.yunAnimations ?? []).missing.length, 0);

  // Archive evidence into Matterhorn candidate tree.
  const dest = resolve(process.cwd(), "artifacts", "yun-character-candidate", "yun_player_base_v2", "production");
  mkdirSync(dest, { recursive: true });
  cpSync(evidencePath, join(dest, "yun_production_character_probe.json"));
  writeFileSync(
    join(dest, "rollback.md"),
    [
      "# Rollback: Yun player base → Kenney",
      "",
      "1. In-game character picker: select any Kenney (Tito…Nati), **or**",
      "2. Set `character_id = 0` in `user://yun_settings.cfg` / GameSettings.",
      "3. Do **not** delete `res://assets/matterhorn/yun_player_base.glb` — opt-in stays available.",
      "",
      "Default remains Kenney (`character_id = 0`). Index 12 is Yun only when chosen.",
      "",
    ].join("\n"),
    "utf8",
  );
});
