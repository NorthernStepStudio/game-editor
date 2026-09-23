import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BlenderAdapter,
  findBlenderExecutable,
  matchYunAnimationClips,
  YUN_CHARACTER_CONTRACT,
} from "../studio/adapters/blender/index.js";
import { SpecialistError } from "../studio/adapters/types.js";
import type { NssStudioHandoff } from "../studio/types.js";

test("YunCharacterContract matches inspected mini_figure.gd requirements", () => {
  assert.equal(YUN_CHARACTER_CONTRACT.animations.preferredClipNames.includes("idle"), true);
  assert.equal(YUN_CHARACTER_CONTRACT.animations.preferredClipNames.includes("walk"), true);
  assert.equal(YUN_CHARACTER_CONTRACT.animations.preferredClipNames.includes("run"), true);
  assert.equal(YUN_CHARACTER_CONTRACT.skeleton.requiresAnimationPlayerNamed, "AnimationPlayer");
  assert.equal(YUN_CHARACTER_CONTRACT.collider.colliderOwnedByHostNotGlb, true);
  assert.deepEqual(YUN_CHARACTER_CONTRACT.attachments.requiredBoneNames, []);

  const matched = matchYunAnimationClips(["Idle", "Walk", "Sprint"]);
  assert.equal(matched.idle, "Idle");
  assert.equal(matched.walk, "Walk");
  assert.equal(matched.sprint, "Sprint");
  assert.equal(matched.missing.length, 0);

  const missing = matchYunAnimationClips(["Jump"]);
  assert.ok(missing.missing.includes("idle"));
});

test("Humanoid prototype generates blend, rig, idle/walk/run, renders, and animated GLB", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-humanoid-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-humanoid-1",
      taskId: "t-humanoid-1",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Generate disposable humanoid mannequin character prototype",
      acceptanceCriteria: [
        "humanoid.blend created",
        "idle, walk, and run animations present",
        "animated humanoid.glb exported",
      ],
      inputArtifacts: [],
    };

    const handle = await adapter.submitTask(handoff);
    assert.equal(handle.accepted, true);
    const result = await adapter.getResult("t-humanoid-1");
    assert.equal(result.status, "completed", result.summary);

    const work = join(tempDir, "t-humanoid-1");
    assert.ok(existsSync(join(work, "humanoid.blend")));
    assert.ok(existsSync(join(work, "humanoid-preview.png")));
    assert.ok(existsSync(join(work, "humanoid-view-front.png")));
    assert.ok(existsSync(join(work, "humanoid.glb")));
    assert.ok(existsSync(join(work, "blender-report.json")));
    assert.ok(existsSync(join(work, "blender-result.json")));

    const report = JSON.parse(readFileSync(join(work, "blender-report.json"), "utf8"));
    assert.ok(report.skeleton?.boneNames?.length > 0);
    const anims: string[] = report.exportInfo?.animations ?? [];
    const matched = matchYunAnimationClips(anims);
    assert.equal(matched.missing.length, 0, `anims=${anims.join(",")}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Report execution ID mismatch fails closed", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-exec-mismatch-"));
  try {
    // Simulate a forged report with wrong executionId after a tiny no-op would be heavy;
    // unit-check the validator path via writing a crafted result check.
    const { assertResultMatchesExecution } = await import(
      "../studio/adapters/blender/blenderManifest.js"
    );
    assert.throws(
      () =>
        assertResultMatchesExecution(
          {
            schemaVersion: "1.0.0",
            taskId: "t1",
            executionId: "other",
            handoffId: "h1",
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
          "expected-exec",
          "t1",
        ),
      /executionId mismatch/,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Missing required blend artifact fails validation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "matterhorn-missing-blend-"));
  try {
    const { validateExpectedArtifacts } = await import("../studio/adapters/blender/blenderArtifacts.js");
    writeFileSync(join(dir, "x.glb"), "not-empty");
    assert.throws(
      () =>
        validateExpectedArtifacts(dir, [
          { kind: "blend", name: "missing.blend", required: true, minBytes: 1 },
          { kind: "glb", name: "x.glb", required: true, minBytes: 1 },
        ]),
      (err: unknown) => err instanceof SpecialistError && err.code === "VALIDATION_FAILED",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
