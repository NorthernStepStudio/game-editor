import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { BlenderAdapter, findBlenderExecutable } from "../studio/adapters/blender/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

test("Full Cross-Tool Vertical Slice: Matterhorn -> BlenderAdapter -> crate.glb -> Godot Import -> Evidence", async () => {
  const blenderBin = findBlenderExecutable();
  const godotBin = "D:\\dev\\Northern Step Studio\\apps\\flyrail\\tools\\godot\\bin\\Godot_v4.7.2-stable_win64.exe";

  if (!blenderBin || !existsSync(godotBin)) {
    return; // Skip if binaries absent
  }

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-slice-test-"));
  const godotDir = join(workDir, "godot-fixture");

  try {
    // 1. Matterhorn submits task to BlenderAdapter
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

    // 2. Set up Godot disposable project fixture
    const fixtureSource = resolve(__dirname, "../../../core/src/test/fixtures/disposable-godot-project");
    cpSync(fixtureSource, godotDir, { recursive: true });

    // Copy exported GLB into Godot project
    const importedGlbPath = join(godotDir, "crate.glb");
    cpSync(glbArtifact.uri, importedGlbPath);

    // Write Godot import verification script
    const gdScriptPath = join(godotDir, "verify_crate_slice.gd");
    const gdScriptCode = `@tool
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
`;
    const fs = await import("node:fs");
    fs.writeFileSync(gdScriptPath, gdScriptCode, "utf8");

    // 3. Run Godot asset import scan
    const importRes = spawnSync(godotBin, ["--path", godotDir, "--headless", "--editor", "--quit"], {
      encoding: "utf8",
    });
    assert.equal(importRes.status, 0);

    // 4. Run Godot import verification script
    const verifyRes = spawnSync(
      godotBin,
      ["--path", godotDir, "--headless", "-s", "verify_crate_slice.gd"],
      { encoding: "utf8" },
    );
    assert.equal(verifyRes.status, 0);
    assert.ok(verifyRes.stdout.includes("SLICE_GODOT_OK"));

    // 5. Verify multi-specialist evidence aggregation
    const blendedEvidence = [
      ...(blenderResult.evidence || []),
      {
        kind: "test" as const,
        summary: "Godot imported and instantiated crate.glb successfully",
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
