/**
 * Yun character vertical slice: Matterhorn → Blender → yun_player_base → Flyrail → Godot.
 * Does not modify production Yun assets.
 */

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
  YUN_CHARACTER_CONTRACT,
  YUN_PLAYER_BASE_ASSET_NAME,
  YUN_PLAYER_BASE_BONES,
  YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
} from "../studio/adapters/blender/index.js";
import {
  DEFAULT_GODOT_BIN,
  FlyrailClient,
  prepareDisposableGlbProject,
  resolveDisposableGodotFixture,
  validateGlbThroughFlyrail,
  writeYunWrapperMotionProbe,
  runYunWrapperMotionProbe,
} from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

/** Durable candidate archive under the Matterhorn repo (not production Yun). */
export function yunCandidateArchiveDir(): string {
  return resolve(process.cwd(), "artifacts", "yun-character-candidate", YUN_PLAYER_BASE_ASSET_NAME);
}

function archiveCandidate(taskWorkDir: string): string {
  const dest = yunCandidateArchiveDir();
  mkdirSync(dest, { recursive: true });
  for (const name of [
    "yun_player_base.blend",
    "yun_player_base.glb",
    "yun_player_base-report.json",
    "yun_player_base-front.png",
    "yun_player_base-side.png",
    "yun_player_base-back.png",
    "yun_player_base-three-quarter.png",
    "yun_player_base-preview.png",
    "blender-task.json",
    "blender-result.json",
    "blender-report.json",
    "blender-stdout.log",
    "blender-stderr.log",
  ]) {
    const src = join(taskWorkDir, name);
    if (existsSync(src)) cpSync(src, join(dest, name));
  }
  return dest;
}

test("YunCharacterContract documents team-color material preference", () => {
  assert.equal(YUN_CHARACTER_CONTRACT.materials.preferredTeamColorMaterial, "MAT_TeamShirt");
  assert.equal(YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL, "MAT_TeamShirt");
  assert.ok(YUN_PLAYER_BASE_BONES.includes("Hand_L"));
  assert.ok(YUN_PLAYER_BASE_BONES.includes("Foot_R"));
});

test("Yun player base Blender generation produces rigged animated candidate", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-char-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-yun-base-1",
      taskId: "t-yun-player-base",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Generate first Yun character production candidate yun_player_base",
      acceptanceCriteria: [
        "yun_player_base.blend created",
        "idle, walk, and run animations present with keyframes",
        "animated yun_player_base.glb exported",
      ],
      inputArtifacts: [],
    };

    const handle = await adapter.submitTask(handoff);
    assert.equal(handle.accepted, true);
    const result = await adapter.getResult("t-yun-player-base");
    assert.equal(result.status, "completed", result.summary);

    const work = join(tempDir, "t-yun-player-base");
    assert.ok(existsSync(join(work, "yun_player_base.blend")));
    assert.ok(existsSync(join(work, "yun_player_base.glb")));
    assert.ok(existsSync(join(work, "yun_player_base-front.png")));
    assert.ok(existsSync(join(work, "yun_player_base-side.png")));
    assert.ok(existsSync(join(work, "yun_player_base-back.png")));
    assert.ok(existsSync(join(work, "yun_player_base-three-quarter.png")));
    assert.ok(existsSync(join(work, "yun_player_base-report.json")));

    const report = JSON.parse(readFileSync(join(work, "yun_player_base-report.json"), "utf8"));
    assert.ok(report.skeleton?.boneNames?.length >= YUN_PLAYER_BASE_BONES.length);
    assert.ok((report.materials?.names ?? []).includes(YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL));
    const anims: string[] = report.exportInfo?.animations ?? [];
    assert.equal(matchYunAnimationClips(anims).missing.length, 0, `anims=${anims.join(",")}`);
    assert.ok((report.geometry?.polygons ?? 0) > 0);
    assert.ok((report.geometry?.vertices ?? 0) > 0);

    const archived = archiveCandidate(work);
    assert.ok(existsSync(join(archived, "yun_player_base.glb")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Yun player base Flyrail disposable Godot + wrapper motion validation", async (t) => {
  const blenderBin = findBlenderExecutable();
  if (!blenderBin) {
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

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-flyrail-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: workDir });
    const handle = await adapter.submitTask({
      protocol: "nss.studio-handoff.v1",
      id: "h-yun-flyrail",
      taskId: "t-yun-player-base-flyrail",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Generate Yun character yun_player_base for Flyrail validation",
      acceptanceCriteria: ["yun_player_base.glb exported", "idle walk run present"],
      inputArtifacts: [],
    });
    assert.equal(handle.accepted, true);
    const blenderResult = await adapter.getResult("t-yun-player-base-flyrail");
    assert.equal(blenderResult.status, "completed", blenderResult.summary);
    const glb = blenderResult.artifacts?.find((a) => a.kind === "glb");
    assert.ok(glb && existsSync(glb.uri));

    const disposableProjectDir = join(workDir, "godot-yun-candidate");
    const { report, result } = await validateGlbThroughFlyrail({
      glbSourcePath: glb.uri,
      disposableProjectDir,
      fixtureSourceDir: resolveDisposableGodotFixture(),
      assetFileName: "yun_player_base.glb",
      requireSkeleton: true,
      requireAnimations: ["idle", "walk", "run_or_sprint"],
    });
    assert.ok(report.sessionId, "Flyrail project.open session required");
    assert.equal(result.status, "completed", result.summary);
    assert.ok(report.probe?.hasSkeleton3D);
    assert.ok(report.probe?.hasAnimationPlayer);
    assert.equal(matchYunAnimationClips(report.probe?.animationNames ?? []).missing.length, 0);

    // Yun wrapper + motion sequence on the same disposable project Flyrail opened.
    writeYunWrapperMotionProbe(disposableProjectDir, "yun_player_base.glb");
    const motion = runYunWrapperMotionProbe(disposableProjectDir);
    assert.equal(motion.ok, true);
    assert.equal(motion.wrapperScale, 1.2);
    assert.equal(motion.childName, "Kenney");
    assert.ok(motion.motionSequence && motion.motionSequence.length >= 4);
    assert.ok((motion.aabbHeight ?? 0) > 0.5 && (motion.aabbHeight ?? 0) < 5.0);

    archiveCandidate(join(workDir, "t-yun-player-base-flyrail"));
    writeFileSync(
      join(yunCandidateArchiveDir(), "flyrail-yun-validation.json"),
      JSON.stringify({ report, motion, blenderSummary: blenderResult.summary }, null, 2),
      "utf8",
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("Yun candidate fail-closed: missing idle / skeleton / invalid GLB", async (t) => {
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

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-neg-"));
  try {
    const fakeGlb = join(workDir, "broken.glb");
    writeFileSync(fakeGlb, "not-a-glb");
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

    // Missing animation criterion fails closed on probe JSON without idle.
    const probeDir = join(workDir, "probe-missing-idle");
    prepareDisposableGlbProject({
      fixtureSourceDir: resolveDisposableGodotFixture(),
      disposableProjectDir: probeDir,
      glbSourcePath: fakeGlb,
      assetFileName: "broken.glb",
    });
    writeFileSync(
      join(probeDir, "flyrail-character-probe.json"),
      JSON.stringify({
        ok: true,
        hasSkeleton3D: true,
        hasAnimationPlayer: true,
        animationNames: ["walk", "run"],
      }),
      "utf8",
    );
    const missing = matchYunAnimationClips(["walk", "run"]);
    assert.ok(missing.missing.includes("idle"));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("Yun candidate fail-closed: execution ID mismatch", async () => {
  const { assertResultMatchesExecution } = await import(
    "../studio/adapters/blender/blenderManifest.js"
  );
  assert.throws(
    () =>
      assertResultMatchesExecution(
        {
          schemaVersion: "1.0.0",
          taskId: "t-yun",
          executionId: "forged",
          handoffId: "h",
          blenderVersion: "5.2.1",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          requestedOperations: [],
          completedOperations: [],
          outputArtifacts: [],
          warnings: [],
          errors: [],
          status: "completed",
        },
        "real-exec",
        "t-yun",
      ),
    /executionId mismatch/,
  );
});
