import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BlenderAdapter, findBlenderExecutable, matchYunAnimationClips } from "../studio/adapters/blender/index.js";
import {
  DEFAULT_GODOT_BIN,
  FlyrailClient,
  resolveDisposableGodotFixture,
  validateGlbThroughFlyrail,
} from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

/**
 * Real Matterhorn → Blender → Flyrail → Godot character prototype slice.
 * Flyrail owns project.open / list_files / validate_static / runtime.launch.
 */
test("Matterhorn→Blender→Flyrail→Godot humanoid character prototype", async (t) => {
  const blenderBin = findBlenderExecutable();
  const godotBin = DEFAULT_GODOT_BIN;

  if (!blenderBin) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }
  if (!existsSync(godotBin)) {
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

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-flyrail-char-"));
  try {
    const blenderAdapter = new BlenderAdapter({ baseWorkDir: workDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-char-flyrail",
      taskId: "t-humanoid-flyrail",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Generate disposable humanoid mannequin character prototype for Flyrail validation",
      acceptanceCriteria: [
        "idle animation present",
        "walk animation present",
        "run animation present",
        "animated humanoid.glb exported",
      ],
      inputArtifacts: [],
    };

    const handle = await blenderAdapter.submitTask(handoff);
    assert.equal(handle.accepted, true);
    const blenderResult = await blenderAdapter.getResult("t-humanoid-flyrail");
    assert.equal(blenderResult.status, "completed", blenderResult.summary);

    const glb = blenderResult.artifacts?.find((a) => a.kind === "glb");
    assert.ok(glb && existsSync(glb.uri));

    const disposableProjectDir = join(workDir, "godot-humanoid");
    const { report, result } = await validateGlbThroughFlyrail({
      glbSourcePath: glb.uri,
      disposableProjectDir,
      fixtureSourceDir: resolveDisposableGodotFixture(),
      assetFileName: "humanoid.glb",
      requireSkeleton: true,
      requireAnimations: ["idle", "walk", "run_or_sprint"],
    });

    assert.equal(result.specialistId, "flyrail");
    assert.ok(report.sessionId, "Flyrail project.open must return sessionId");
    assert.equal(result.status, "completed", result.summary);
    assert.ok(report.probe?.ok);
    assert.ok(report.probe?.hasSkeleton3D);
    const matched = matchYunAnimationClips(report.probe?.animationNames ?? []);
    assert.equal(matched.missing.length, 0, `Godot/Flyrail anims=${(report.probe?.animationNames ?? []).join(",")}`);

    // Fail-closed: Flyrail downstream failure would block overall plan
    assert.ok(result.criterionResults?.every((c) => c.outcome === "passed"));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("Flyrail downstream failure blocks overall character plan", async (t) => {
  const godotBin = DEFAULT_GODOT_BIN;
  if (!existsSync(godotBin)) {
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

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-flyrail-fail-"));
  try {
    // Place a non-character GLB-less project: copy fixture but point at missing glb by writing empty file name mismatch
    const { writeFileSync } = await import("node:fs");
    const fakeGlb = join(workDir, "broken.glb");
    writeFileSync(fakeGlb, "not-a-real-glb-content");
    const disposableProjectDir = join(workDir, "godot-broken");
    const { result } = await validateGlbThroughFlyrail({
      glbSourcePath: fakeGlb,
      disposableProjectDir,
      fixtureSourceDir: resolveDisposableGodotFixture(),
      assetFileName: "broken.glb",
      requireSkeleton: true,
      requireAnimations: ["idle", "walk", "run_or_sprint"],
    });
    assert.equal(result.status, "failed");
    assert.ok(result.criterionResults?.some((c) => c.outcome === "failed"));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
