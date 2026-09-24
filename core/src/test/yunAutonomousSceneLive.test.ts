import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SpecialistAdapter } from '../studio/adapters/types.js';
import { createYunAutonomousScenePlan, YUN_FULL_SCENE_FLYRAIL_CRITERIA } from '../studio/yunAutonomousScenePlan.js';
import { SpecialistAdapterRegistry } from '../studio/run/registry.js';
import { StudioExecutionEngine } from '../studio/runController.js';
import type { NssStudioExecutionResult, NssStudioHandoff, NssStudioPlan } from '../studio/types.js';
import { terminalRun, type StudioRun } from '../studio/runTypes.js';

type Scenario = { omitGlb?: boolean; playerCount?: number; removeGlb?: boolean };

function resultFor(handoff: NssStudioHandoff, artifactPath: string, scenario: Scenario): NssStudioExecutionResult {
  if (handoff.to === 'blender-engine') {
    return {
      taskId: handoff.taskId,
      specialistId: 'blender-engine',
      status: 'completed',
      summary: 'Generated current-run environment.',
      ...(scenario.omitGlb ? {} : { artifacts: [{ kind: 'glb', uri: artifactPath, label: 'generated.glb', producedBy: 'blender-engine' as const }] }),
      evidence: handoff.acceptanceCriteria.map((criterion, index) => ({ kind: 'test', summary: criterion, outcome: 'passed', uri: `fixture:blender:${index}` })),
      criterionResults: handoff.acceptanceCriteria.map((criterion, index) => ({ criterion, criterionId: `criterion-${index + 1}`, outcome: 'passed', evidenceUri: `fixture:blender:${index}`, executionId: handoff.taskId })),
    };
  }

  const dependency = handoff.inputArtifacts.find((item) => item.kind === 'glb');
  if (!dependency || (scenario.removeGlb && !existsSync(dependency.uri))) {
    return { taskId: handoff.taskId, specialistId: 'flyrail', status: 'failed', summary: 'Current-run dependency GLB is missing.' };
  }
  const criterionResults = handoff.acceptanceCriteria.map((criterion, index) => {
    if (YUN_FULL_SCENE_FLYRAIL_CRITERIA.includes(criterion as (typeof YUN_FULL_SCENE_FLYRAIL_CRITERIA)[number]) && !criterion.startsWith('{')) {
      return { criterion, criterionId: `gate-${index + 1}`, outcome: 'passed' as const, evidenceUri: `fixture:flyrail:${index}`, executionId: handoff.taskId };
    }
    const spec = JSON.parse(criterion) as { id: string; description: string; expected: unknown };
    const actual = spec.id === 'scene-player-count' ? 6 : spec.expected;
    return { criterion, criterionId: spec.id, description: spec.description, expected: spec.expected, actual, outcome: actual === spec.expected ? 'passed' as const : 'failed' as const, evidenceUri: `fixture:flyrail:${index}`, executionId: handoff.taskId };
  });
  const failed = criterionResults.some((item) => item.outcome === 'failed');
  return {
    taskId: handoff.taskId,
    specialistId: 'flyrail',
    status: failed ? 'failed' : 'completed',
    summary: failed ? 'Scene criterion failed.' : `Consumed dependency ${dependency.uri}`,
    evidence: criterionResults.map((item) => ({ kind: 'test', summary: item.criterion, outcome: item.outcome, uri: item.evidenceUri })),
    criterionResults,
  };
}

function adapter(specialistId: 'blender-engine' | 'flyrail', received: NssStudioHandoff[], artifactPath: string, scenario: Scenario): SpecialistAdapter {
  const results = new Map<string, NssStudioExecutionResult>();
  return {
    specialistId,
    health: async () => ({ available: true, specialistId }),
    getCapabilities: async () => ({ specialistId, protocolVersion: 'fixture', capabilities: specialistId === 'blender-engine'
      ? ['blender.create', 'blender.render.preview', 'blender.export.glb', 'blender.qa']
      : ['godot.project.inspect', 'godot.project.run', 'godot.validation.run', 'godot.screenshot.capture'] }),
    submitTask: async (handoff) => {
      received.push(handoff);
      if (specialistId === 'blender-engine' && scenario.removeGlb) rmSync(artifactPath, { force: true });
      results.set(handoff.taskId, resultFor(handoff, artifactPath, scenario));
      return { taskId: handoff.taskId, specialistId, accepted: true };
    },
    getTaskStatus: async (taskId) => ({ taskId, specialistId, phase: 'completed' }),
    getResult: async (taskId) => results.get(taskId)!,
    cancelTask: async (taskId) => ({ taskId, cancelled: false }),
  };
}

function fixturePlan(projectPath: string): NssStudioPlan {
  return createYunAutonomousScenePlan({ goal: 'Create a Yun Noche street scene with warm lamps and six players.', godotProjectPath: projectPath, target: 'disposable', playerCount: 6 });
}

async function run(plan: NssStudioPlan, artifactPath: string, scenario: Scenario = {}): Promise<{ run: StudioRun; blenderCalls: NssStudioHandoff[]; flyrailCalls: NssStudioHandoff[] }> {
  const blenderCalls: NssStudioHandoff[] = [];
  const flyrailCalls: NssStudioHandoff[] = [];
  const registry = new SpecialistAdapterRegistry();
  registry.register(adapter('blender-engine', blenderCalls, artifactPath, scenario));
  registry.register(adapter('flyrail', flyrailCalls, artifactPath, scenario));
  const engine = new StudioExecutionEngine(registry, { taskTimeoutMs: 1000, requestTimeoutMs: 100, pollIntervalMs: 1 });
  const started = engine.start(plan);
  for (let i = 0; i < 1000; i++) {
    const current = engine.store.get(started.id)!;
    if (terminalRun(current.status)) return { run: current, blenderCalls, flyrailCalls };
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error('Studio scene fixture run did not settle.');
}

test('Studio engine orders Blender and Flyrail and forwards this run’s exact GLB', async () => {
  const root = mkdtempSync(join(tmpdir(), 'matterhorn-yun-autonomous-test-'));
  const artifactPath = join(root, 'current-run.glb');
  writeFileSync(artifactPath, 'fixture-glb');
  try {
    const { run: result, blenderCalls, flyrailCalls } = await run(fixturePlan(root), artifactPath);
    assert.equal(result.status, 'completed');
    assert.deepEqual(blenderCalls.map((item) => item.to), ['blender-engine']);
    assert.equal(flyrailCalls.length, 1);
    assert.equal(flyrailCalls[0]!.to, 'flyrail');
    assert.equal(flyrailCalls[0]!.taskId, result.tasks[1]!.executionId);
    assert.ok(flyrailCalls[0]!.inputArtifacts.some((item) => item.kind === 'glb' && item.uri === artifactPath));
    assert.equal(result.tasks[0]!.status, 'completed');
    assert.equal(result.tasks[1]!.status, 'completed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a missing Blender GLB fails output requirements and never submits Flyrail', async () => {
  const root = mkdtempSync(join(tmpdir(), 'matterhorn-yun-autonomous-test-'));
  const artifactPath = join(root, 'missing.glb');
  writeFileSync(artifactPath, 'temporary');
  try {
    const { run: result, flyrailCalls } = await run(fixturePlan(root), artifactPath, { omitGlb: true });
    assert.notEqual(result.status, 'completed');
    assert.equal(result.tasks[0]!.status, 'failed');
    assert.equal(result.tasks[1]!.status, 'blocked');
    assert.equal(flyrailCalls.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a removed current-run GLB cannot complete downstream Flyrail work', async () => {
  const root = mkdtempSync(join(tmpdir(), 'matterhorn-yun-autonomous-test-'));
  const artifactPath = join(root, 'removed.glb');
  writeFileSync(artifactPath, 'temporary');
  try {
    const { run: result, flyrailCalls } = await run(fixturePlan(root), artifactPath, { removeGlb: true });
    assert.notEqual(result.status, 'completed');
    assert.equal(flyrailCalls.length, 1);
    assert.equal(result.tasks[1]!.status, 'failed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a measured six-player scene fails when the planned acceptance requires seven', async () => {
  const root = mkdtempSync(join(tmpdir(), 'matterhorn-yun-autonomous-test-'));
  const artifactPath = join(root, 'current-run.glb');
  writeFileSync(artifactPath, 'fixture-glb');
  const basePlan = fixturePlan(root);
  const plan: NssStudioPlan = {
    ...basePlan,
    tasks: basePlan.tasks.map((task) => task.id === 'assemble-validate-scene' ? { ...task, acceptanceCriteria: task.acceptanceCriteria.map((raw) => raw.includes('scene-player-count') ? raw.replace('"expected":6', '"expected":7') : raw) } : task),
    finalAcceptanceCriteria: basePlan.finalAcceptanceCriteria.map((raw) => raw.includes('scene-player-count') ? raw.replace('"expected":6', '"expected":7') : raw),
  };
  try {
    const { run: result } = await run(plan, artifactPath, { playerCount: 6 });
    const playerCheck = result.tasks[1]!.result?.criterionResults?.find((item) => item.criterionId === 'scene-player-count');
    assert.equal(playerCheck?.expected, 7);
    assert.equal(playerCheck?.actual, 6);
    assert.equal(playerCheck?.outcome, 'failed');
    assert.equal(result.tasks[1]!.status, 'failed');
    assert.notEqual(result.status, 'completed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
