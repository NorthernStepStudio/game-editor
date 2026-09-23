import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { BlenderAdapter, findBlenderExecutable } from "../studio/adapters/blender/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

/**
 * Bootstrap crate import check (direct Godot).
 * This proves Matterhorn → BlenderAdapter → Blender → GLB → Godot.
 * It does NOT prove Flyrail ownership — see blenderFlyrailCharacterSlice.test.ts.
 */
test("Blender→Godot crate import slice (direct Godot; not Flyrail)", async (t) => {
  const blenderBin = findBlenderExecutable();
  const godotBin =
    process.env.FLYRAIL_GODOT_BIN ||
    process.env.MATTERHORN_GODOT_BIN ||
    "D:\\dev\\Northern Step Studio\\apps\\flyrail\\tools\\godot\\bin\\Godot_v4.7.2-stable_win64.exe";

  if (!blenderBin || !existsSync(godotBin)) {
    t.diagnostic("SKIPPED — environment unavailable (Blender and/or Godot binary missing)");
    return;
  }

  const { spawnSync } = await import("node:child_process");
  const { cpSync, writeFileSync } = await import("node:fs");

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-slice-test-"));
  const godotDir = join(workDir, "godot-fixture");

  try {
    const blenderAdapter = new BlenderAdapter({ baseWorkDir: workDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-slice-1",
      taskId: "t-blender-crate",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Build stylized game crate asset for Godot",
      acceptanceCriteria: [
        "blender.create crate.blend",
        "blender.render.preview crate-preview.png",
        "blender.export.glb crate.glb",
      ],
      inputArtifacts: [],
    };

    const handle = await blenderAdapter.submitTask(handoff);
    assert.equal(handle.accepted, true);

    const blenderResult = await blenderAdapter.getResult("t-blender-crate");
    assert.equal(blenderResult.status, "completed");

    const glbArtifact = blenderResult.artifacts?.find((a) => a.kind === "glb");
    assert.ok(glbArtifact && existsSync(glbArtifact.uri));

    const fixtureSource = resolve(__dirname, "../../../core/src/test/fixtures/disposable-godot-project");
    cpSync(fixtureSource, godotDir, { recursive: true });
    const importedGlbPath = join(godotDir, "crate.glb");
    cpSync(glbArtifact.uri, importedGlbPath);

    const gdScriptPath = join(godotDir, "verify_crate_slice.gd");
    writeFileSync(
      gdScriptPath,
      `@tool
extends SceneTree

func _init():
	var glb_path = "res://crate.glb"
	if not FileAccess.file_exists(glb_path):
		printerr("ERROR: crate.glb missing")
		quit(1)
		return
	var res = ResourceLoader.load(glb_path)
	if res == null:
		printerr("ERROR: ResourceLoader failed")
		quit(1)
		return
	var inst = res.instantiate()
	if inst == null:
		printerr("ERROR: instantiate failed")
		quit(1)
		return
	print("SLICE_GODOT_OK node=", inst.name, " children=", inst.get_child_count())
	quit(0)
`,
      "utf8",
    );

    const importRes = spawnSync(godotBin, ["--path", godotDir, "--headless", "--editor", "--quit"], {
      encoding: "utf8",
    });
    assert.equal(importRes.status, 0);

    const verifyRes = spawnSync(godotBin, ["--path", godotDir, "--headless", "-s", "verify_crate_slice.gd"], {
      encoding: "utf8",
    });
    assert.equal(verifyRes.status, 0);
    assert.ok(String(verifyRes.stdout).includes("SLICE_GODOT_OK"));

    const blendedEvidence = [
      ...(blenderResult.evidence || []),
      {
        kind: "test" as const,
        summary: "Godot imported and instantiated crate.glb successfully (direct Godot; not Flyrail)",
        outcome: "passed" as const,
        uri: importedGlbPath,
      },
    ];

    assert.ok(blendedEvidence.some((e) => e.kind === "render" && e.outcome === "passed"));
    assert.ok(blendedEvidence.some((e) => e.kind === "artifact" && e.outcome === "passed"));
    assert.ok(blendedEvidence.some((e) => e.kind === "test" && e.outcome === "passed"));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
