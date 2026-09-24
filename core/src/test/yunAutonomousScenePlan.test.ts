import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createYunAutonomousScenePlan,
  resolveYunSceneTheme,
  YUN_FULL_SCENE_FLYRAIL_CRITERIA,
} from "../studio/yunAutonomousScenePlan.js";
import { createStudioHandoff } from "../studio/orchestrator.js";
import { handoffToLoopRunParams } from "../studio/adapters/flyrail/flyrailMapper.js";

test("Yun autonomous scene planner resolves high-level themes", () => {
  assert.equal(resolveYunSceneTheme({ goal: "Create a Yun Noche street scene" }), "noche");
  assert.equal(resolveYunSceneTheme({ goal: "Build a Yun Malecón environment" }), "malecon");
  assert.equal(resolveYunSceneTheme({ goal: "Create a Yun park full scene" }), "parque");
  assert.equal(resolveYunSceneTheme({ goal: "Create a Yun Calle street scene" }), "calle");
});

test("Yun autonomous scene plan creates Blender then Flyrail dependency graph", () => {
  const plan = createYunAutonomousScenePlan({
    goal: "Create a Yun Noche street scene with warm lamps and clear competitive visibility.",
    godotProjectPath: "D:\\yun-disposable",
  });

  assert.equal(plan.tasks.length, 2);
  const blender = plan.tasks[0]!;
  const flyrail = plan.tasks[1]!;
  assert.equal(blender.specialistId, "blender-engine");
  assert.equal(flyrail.specialistId, "flyrail");
  assert.deepEqual(flyrail.dependsOn, ["generate-environment"]);
  assert.ok(blender.outputArtifacts?.some((artifact) => artifact.kind === "glb"));
  assert.ok(blender.goal.includes("yun_street_block_noche_v1"));
  assert.deepEqual(flyrail.acceptanceCriteria, YUN_FULL_SCENE_FLYRAIL_CRITERIA);
  assert.ok(flyrail.inputArtifacts?.some((artifact) => artifact.kind === "godot-project"));
});

test("Flyrail handoff text contains dependency artifact URIs", () => {
  const plan = createYunAutonomousScenePlan({
    goal: "Create a Yun Parque full scene",
    godotProjectPath: "D:\\yun-disposable",
  });
  const flyrailTask = plan.tasks[1]!;
  const withDependency = {
    ...flyrailTask,
    id: "run-1-assemble",
    inputArtifacts: [
      ...(flyrailTask.inputArtifacts ?? []),
      {
        kind: "glb",
        uri: "D:\\matterhorn\\runs\\generate\\yun_street_block_parque_v1.glb",
        label: "yun_street_block_parque_v1.glb",
        producedBy: "blender-engine" as const,
      },
    ],
  };
  const handoff = createStudioHandoff(withDependency);
  const params = handoffToLoopRunParams(handoff, "session-1");
  const text = String(params.text);
  assert.match(text, /Input artifacts:/);
  assert.match(text, /yun_street_block_parque_v1\.glb/);
  assert.match(text, /D:\\matterhorn\\runs\\generate/);
  assert.match(text, /Acceptance criteria:/);
});

test("Yun full-scene gate rejects unsupported player count", () => {
  assert.throws(
    () => createYunAutonomousScenePlan({
      goal: "Create a Yun Noche street scene",
      godotProjectPath: "D:\\yun-disposable",
      playerCount: 4,
    }),
    /exactly six players/,
  );
});

test("Yun full-scene final criteria remain fail-closed and scene-specific", () => {
  const joined = YUN_FULL_SCENE_FLYRAIL_CRITERIA.join("\n");
  assert.match(joined, /Godot validation passes/);
  assert.match(joined, /Matterhorn environment root exists/);
  assert.match(joined, /Six Yun players are visible/);
  assert.match(joined, /Yun route returns to home/);
  assert.match(joined, /Yun tag and role swap succeeds/);
});
