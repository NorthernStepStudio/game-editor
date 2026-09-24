/**
 * Yun player base v2 art pass: refine → visual sanity → Flyrail disposable → gameplay camera.
 * Phase 3H archive under yun_player_base/ is preserved; v2 archives separately.
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
  runYunCharacterVisualSanity,
  YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
  YUN_PLAYER_BASE_V2_ASSET_NAME,
  YUN_PLAYER_BASE_V2_REVISION,
} from "../studio/adapters/blender/index.js";
import {
  DEFAULT_GODOT_BIN,
  FlyrailClient,
  resolveDisposableGodotFixture,
  validateGlbThroughFlyrail,
  writeYunWrapperMotionProbe,
  runYunWrapperMotionProbe,
  writeYunGameplayCameraProbe,
  runYunGameplayCameraProbe,
} from "../studio/adapters/flyrail/index.js";
import type { NssStudioHandoff } from "../studio/types.js";

export function yunV2CandidateArchiveDir(): string {
  return resolve(process.cwd(), "artifacts", "yun-character-candidate", YUN_PLAYER_BASE_V2_ASSET_NAME);
}

function archiveV2(taskWorkDir: string): string {
  const dest = yunV2CandidateArchiveDir();
  mkdirSync(dest, { recursive: true });
  for (const name of [
    "yun_player_base_v2.blend",
    "yun_player_base_v2.glb",
    "yun_player_base_v2-report.json",
    "yun_player_base_v2-front.png",
    "yun_player_base_v2-side.png",
    "yun_player_base_v2-back.png",
    "yun_player_base_v2-three-quarter.png",
    "yun_player_base_v2-preview.png",
    "blender-task.json",
    "blender-result.json",
    "blender-report.json",
    "blender-stdout.log",
    "blender-stderr.log",
  ]) {
    const src = join(taskWorkDir, name);
    if (existsSync(src)) cpSync(src, join(dest, name));
  }
  writeFileSync(
    join(dest, "manifest.json"),
    JSON.stringify(
      {
        asset: YUN_PLAYER_BASE_V2_ASSET_NAME,
        revision: YUN_PLAYER_BASE_V2_REVISION,
        lineage: ["yun_player_base", YUN_PLAYER_BASE_V2_ASSET_NAME],
        teamColorMaterial: YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
        archivedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return dest;
}

test("Yun player base v2 Blender generation + visual sanity", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-v2-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-yun-v2-1",
      taskId: "t-yun-player-base-v2",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Refine Yun character yun_player_base_v2 art and animations",
      acceptanceCriteria: [
        "yun_player_base_v2.blend created",
        "idle, walk, and run animations with keyframes",
        "animated yun_player_base_v2.glb exported",
      ],
      inputArtifacts: [],
    };

    const handle = await adapter.submitTask(handoff);
    assert.equal(handle.accepted, true);
    const result = await adapter.getResult("t-yun-player-base-v2");
    assert.equal(result.status, "completed", result.summary);

    const work = join(tempDir, "t-yun-player-base-v2");
    assert.ok(existsSync(join(work, "yun_player_base_v2.glb")));

    const sanity = runYunCharacterVisualSanity({
      workDir: work,
      assetPrefix: "yun_player_base_v2",
      requiredMaterials: [YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL, "MAT_Skin", "MAT_Accent", "MAT_Hair"],
      expectedBoneCount: 18,
      // Soft cap vs Phase 3H (~1042 verts) — allow growth, block explosion.
      maxVertices: 8000,
      maxPolygons: 8000,
    });
    assert.equal(sanity.ok, true, JSON.stringify(sanity.checks.filter((c) => !c.ok), null, 2));
    assert.ok((sanity.geometry?.vertices ?? 0) > 1042, "v2 should not shrink below Phase 3H detail");

    const archived = archiveV2(work);
    assert.ok(existsSync(join(archived, "yun_player_base_v2.glb")));
    writeFileSync(join(archived, "visual-sanity.json"), JSON.stringify(sanity, null, 2), "utf8");

    // Phase 3H archive must still exist untouched.
    const phase3h = resolve(process.cwd(), "artifacts", "yun-character-candidate", "yun_player_base");
    assert.ok(existsSync(join(phase3h, "yun_player_base.glb")), "Phase 3H candidate must remain");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Yun player base v2 Flyrail disposable + gameplay camera + team colors", async (t) => {
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

  const workDir = mkdtempSync(join(tmpdir(), "matterhorn-yun-v2-fly-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: workDir });
    const handle = await adapter.submitTask({
      protocol: "nss.studio-handoff.v1",
      id: "h-yun-v2-fly",
      taskId: "t-yun-player-base-v2-flyrail",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Refine Yun character yun_player_base_v2 for Flyrail validation",
      acceptanceCriteria: ["yun_player_base_v2.glb exported", "idle walk run present"],
      inputArtifacts: [],
    });
    assert.equal(handle.accepted, true);
    const blenderResult = await adapter.getResult("t-yun-player-base-v2-flyrail");
    assert.equal(blenderResult.status, "completed", blenderResult.summary);
    const glb = blenderResult.artifacts?.find((a) => a.kind === "glb");
    assert.ok(glb && existsSync(glb.uri));

    const disposableProjectDir = join(workDir, "godot-yun-v2");
    const { report, result } = await validateGlbThroughFlyrail({
      glbSourcePath: glb.uri,
      disposableProjectDir,
      fixtureSourceDir: resolveDisposableGodotFixture(),
      assetFileName: "yun_player_base_v2.glb",
      requireSkeleton: true,
      requireAnimations: ["idle", "walk", "run_or_sprint"],
    });
    assert.ok(report.sessionId);
    assert.equal(result.status, "completed", result.summary);
    assert.equal(matchYunAnimationClips(report.probe?.animationNames ?? []).missing.length, 0);

    writeYunWrapperMotionProbe(disposableProjectDir, "yun_player_base_v2.glb");
    const motion = runYunWrapperMotionProbe(disposableProjectDir);
    assert.equal(motion.ok, true);
    assert.equal(motion.wrapperScale, 1.2);

    writeYunGameplayCameraProbe(disposableProjectDir, "yun_player_base_v2.glb");
    const camera = runYunGameplayCameraProbe(disposableProjectDir);
    assert.equal(camera.ok, true);
    assert.ok((camera.screenshots?.length ?? 0) >= 3);
    assert.ok((camera.teamVariants?.length ?? 0) >= 2);

    const archived = archiveV2(join(workDir, "t-yun-player-base-v2-flyrail"));
    const evidenceDir = join(archived, "flyrail-gameplay");
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(archived, "flyrail-yun-v2-validation.json"),
      JSON.stringify({ report, motion, camera, blenderSummary: blenderResult.summary }, null, 2),
      "utf8",
    );
    for (const name of readdirSync(disposableProjectDir)) {
      if (name.startsWith("gameplay-") && name.endsWith(".png")) {
        cpSync(join(disposableProjectDir, name), join(evidenceDir, name));
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
