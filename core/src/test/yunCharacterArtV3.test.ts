import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildYunCharacterArtV3Operations,
  buildYunCharacterArtV3TaskSpec,
  resolveYunCharacterArtV3FromGoal,
} from "../studio/adapters/blender/yunCharacterArtV3Fixture.js";
import { getYunRosterVariant } from "../studio/adapters/blender/yunCharacterVariantSpec.js";
import { validateBlenderTaskSpec } from "../studio/adapters/blender/blenderTaskSpec.js";
import { compileBlenderTaskScript } from "../studio/adapters/blender/blenderScriptCompiler.js";
import type { AnimationInsertKeyframeOp } from "../studio/adapters/blender/blenderOperations.js";

test("Yun V3 character generator replaces mannequin joint fillers with aligned tapered anatomy", () => {
  const spec = getYunRosterVariant("yun_player_base");
  assert.ok(spec);
  const ops = buildYunCharacterArtV3Operations(spec!);

  assert.ok(ops.some((op) => op.op === "mesh.create_tapered_segment"));
  assert.ok(ops.some((op) => op.op === "mesh.create_tapered_box"));
  assert.equal(ops.filter((op) => op.op === "mesh.join").length, 1);
  assert.equal(ops.filter((op) => op.op === "rig.assign_weights").length, 1);
  assert.ok(ops.some((op) => op.op === "mesh.smooth" && op.target === "Mesh_Character"));

  const names = ops
    .filter((op): op is Extract<(typeof ops)[number], { name: string }> => "name" in op && typeof op.name === "string")
    .map((op) => op.name);
  assert.ok(!names.some((name) => /Mesh_(Elbow|Knee|HipJoin|Shoulder)_[LR]/.test(name)));
});

test("Yun V3 task remains bounded, validates, and compiles without arbitrary Python", () => {
  const spec = getYunRosterVariant("yun_player_04");
  assert.ok(spec);
  const task = buildYunCharacterArtV3TaskSpec(spec!, join(tmpdir(), "matterhorn-yun-v3-test"));
  const validated = validateBlenderTaskSpec(task);
  assert.equal(validated.assetName, "yun_player_04_v3");
  const compiled = compileBlenderTaskScript({
    spec: validated,
    executionId: "v3-execution",
    taskId: "v3-task",
    handoffId: "v3-handoff",
  });
  assert.match(compiled.pythonCode, /mesh\.create_tapered_segment/);
  assert.match(compiled.pythonCode, /bpy\.ops\.object\.join\(\)/);
  assert.match(compiled.pythonCode, /poly\.use_smooth/);
});

test("Yun V3 routing is explicit and does not replace production roster requests", () => {
  assert.equal(resolveYunCharacterArtV3FromGoal("Generate yun_player_02_v3"), getYunRosterVariant("yun_player_02"));
  assert.equal(resolveYunCharacterArtV3FromGoal("Generate Yun character art V3"), getYunRosterVariant("yun_player_base"));
  assert.equal(resolveYunCharacterArtV3FromGoal("Generate yun_player_02"), undefined);
  assert.equal(resolveYunCharacterArtV3FromGoal("Create a character"), undefined);
});

test("Yun V3 locomotion has denser walk/run key poses than the old three-pose placeholder", () => {
  const spec = getYunRosterVariant("yun_player_03");
  assert.ok(spec);
  const ops = buildYunCharacterArtV3Operations(spec!);
  const walkFrames = new Set(
    ops
      .filter((op): op is AnimationInsertKeyframeOp => op.op === "animation.insert_keyframe" && op.action === "walk")
      .map((op) => op.frame),
  );
  const runFrames = new Set(
    ops
      .filter((op): op is AnimationInsertKeyframeOp => op.op === "animation.insert_keyframe" && op.action === "run")
      .map((op) => op.frame),
  );
  assert.deepEqual([...walkFrames], [1, 8, 16, 24, 32]);
  assert.deepEqual([...runFrames], [1, 5, 10, 15, 20]);
});
