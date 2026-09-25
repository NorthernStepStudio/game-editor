/** Regression coverage for the public Phase 3 API after evidence/cancellation hardening. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { StudioRunController } from '../studio/run/runController.js';
import { SpecialistAdapterRegistry } from '../studio/run/registry.js';
import { InMemoryStudioRunStore } from '../studio/run/store.js';
import { createStudioPlan } from '../studio/orchestrator.js';
import { SpecialistError, type SpecialistAdapter } from '../studio/adapters/types.js';
import type { StudioRunEvent } from '../studio/run/types.js';
import type { StudioRun } from '../studio/runTypes.js';
import type { NssStudioArtifactRef } from '../studio/types.js';

const makePlan = () => createStudioPlan({
  goal: 'Verify change',
  tasks: [{
    id: 'check',
    title: 'Check',
    goal: 'Verify change',
    domain: 'godot',
    requiredCapabilities: ['godot.validation.run'],
    acceptanceCriteria: ['Works'],
  }],
});

function setup(overrides: Partial<SpecialistAdapter> = {}) {
  const registry = new SpecialistAdapterRegistry();
  registry.register({
    specialistId: 'flyrail',
    health: async () => ({ available: true, specialistId: 'flyrail' }),
    getCapabilities: async () => ({ specialistId: 'flyrail', protocolVersion: 'test', capabilities: ['godot.validation.run'] }),
    submitTask: async handoff => ({ taskId: handoff.taskId, specialistId: 'flyrail', accepted: true }),
    getTaskStatus: async id => ({ taskId: id, specialistId: 'flyrail', phase: 'completed' }),
    getResult: async id => ({
      taskId: id,
      specialistId: 'flyrail',
      status: 'completed',
      summary: 'Checked',
      artifacts: [{ kind: 'report', uri: 'fixture:report' }],
      evidence: [{ kind: 'test', summary: 'Works', outcome: 'passed', uri: 'fixture:report' }],
      criterionResults: [{ criterion: 'Works', outcome: 'passed', evidenceUri: 'fixture:report' }],
    }),
    cancelTask: async id => ({ taskId: id, cancelled: true }),
    ...overrides,
  });
  return registry;
}

async function runArtifactTask(
  specialistId: 'foundry' | 'blender-engine',
  domain: 'art' | 'blender',
  expected: NssStudioArtifactRef,
  actual: NssStudioArtifactRef,
): ReturnType<StudioRunController['executeRun']> {
  const registry = new SpecialistAdapterRegistry();
  registry.register({
    specialistId,
    health: async () => ({ available: true, specialistId }),
    getCapabilities: async () => ({ specialistId, protocolVersion: 'test', capabilities: [] }),
    submitTask: async handoff => ({ taskId: handoff.taskId, specialistId, accepted: true }),
    getTaskStatus: async taskId => ({ taskId, specialistId, phase: 'completed' }),
    getResult: async taskId => ({
      taskId,
      specialistId,
      status: 'completed',
      summary: 'Output and acceptance evidence verified.',
      artifacts: [actual],
      evidence: [{ kind: 'test', summary: 'Works', outcome: 'passed', uri: 'fixture:works' }],
      criterionResults: [{ criterion: 'Works', outcome: 'passed', evidenceUri: 'fixture:works' }],
    }),
    cancelTask: async taskId => ({ taskId, cancelled: true }),
  });
  const plan = createStudioPlan({
    goal: 'Produce the requested asset.',
    tasks: [{
      id: 'check', title: 'Produce asset', goal: 'Produce the requested asset.', domain, specialistId,
      acceptanceCriteria: ['Works'], outputArtifacts: [expected],
    }],
    finalAcceptanceCriteria: ['Works'],
  });
  return new StudioRunController({ registry, pollIntervalMs: 1 }).executeRun(plan, 'artifact-identity-run');
}

test('Phase 3 executeRun mirrors final state and ordered events into injected store', async () => {
  const store = new InMemoryStudioRunStore();
  const events: StudioRunEvent[] = [];
  const controller = new StudioRunController({ registry: setup(), store, pollIntervalMs: 2, listeners: [event => events.push(event)] });
  const run = await controller.executeRun(makePlan(), 'compat-run');
  assert.equal(run.status, 'completed');
  assert.equal(run.taskRuns.check.status, 'completed');
  assert.equal(run.artifacts.length, 1);
  assert.equal((await store.getRun('compat-run'))?.status, 'completed');
  assert.equal(events[0].kind, 'studio.run.started');
  assert.equal(events.at(-1)?.kind, 'studio.run.completed');
  assert(events.some(event => event.kind === 'studio.evidence.received'));
});

test('required capabilities block submission', async () => {
  let submissions = 0;
  const controller = new StudioRunController({
    registry: setup({
      getCapabilities: async () => ({ specialistId: 'flyrail', protocolVersion: 'test', capabilities: [] }),
      submitTask: async handoff => {
        submissions++;
        return { taskId: handoff.taskId, specialistId: 'flyrail', accepted: true };
      },
    }),
  });
  assert.equal((await controller.executeRun(makePlan())).status, 'blocked');
  assert.equal(submissions, 0);
});

test('a recoverable submission error is not replayed and uncertainty stays visible', async () => {
  let submissions = 0;
  const controller = new StudioRunController({
    registry: setup({
      submitTask: async () => {
        submissions++;
        throw new SpecialistError('TRANSPORT_ERROR', 'Uncertain', { recoverable: true });
      },
      cancelTask: async id => ({ taskId: id, cancelled: false }),
    }),
    retryPolicy: { maxTaskAttempts: 3 },
  });
  assert.equal((await controller.executeRun(makePlan())).status, 'cancel-requested');
  assert.equal(submissions, 1);
});

test('cancelRun confirms remote termination before reporting cancelled', async () => {
  const controller = new StudioRunController({
    registry: setup({ getTaskStatus: async id => ({ taskId: id, specialistId: 'flyrail', phase: 'running' }) }),
    pollIntervalMs: 2,
  });
  const promise = controller.executeRun(makePlan(), 'cancel-api');
  await new Promise(resolve => setTimeout(resolve, 10));
  const requested = await controller.cancelRun('cancel-api');
  assert.equal(requested?.status, 'cancel-requested');
  assert.equal((await promise).status, 'cancelled');
});

test('plain success summaries no longer satisfy acceptance criteria', async () => {
  const controller = new StudioRunController({
    registry: setup({
      getResult: async id => ({
        taskId: id,
        specialistId: 'flyrail',
        status: 'completed',
        summary: 'Done',
        evidence: [{ kind: 'test', summary: 'Validation passed' }],
      }),
    }),
  });
  assert.equal((await controller.executeRun(makePlan())).status, 'blocked');
});

test('required artifacts are enforced', async () => {
  const controller = new StudioRunController({ registry: setup() });
  const plan = makePlan();
  const run = await controller.executeRun({
    ...plan,
    tasks: plan.tasks.map(task => ({ ...task, outputArtifacts: [{ kind: 'export', uri: 'required' }] })),
  });
  assert.equal(run.status, 'failed');
});

test('required output artifact accepts matching identity fields and a non-empty URI', async () => {
  const artifact: NssStudioArtifactRef = {
    kind: 'foundry-asset', uri: 'C:\\assets\\hero.png', assetId: 'hero-sprite', label: 'hero-sprite', producedBy: 'foundry',
  };
  const run = await runArtifactTask('foundry', 'art', { ...artifact, uri: '' }, artifact);
  assert.equal(run.status, 'completed');
});

test('required Foundry output rejects a different asset ID even when kind matches', async () => {
  const expected: NssStudioArtifactRef = {
    kind: 'foundry-asset', uri: '', assetId: 'expected-sprite', label: 'expected-sprite', producedBy: 'foundry',
  };
  const actual: NssStudioArtifactRef = {
    kind: 'foundry-asset', uri: 'C:\\assets\\wrong.png', assetId: 'wrong-sprite', label: 'expected-sprite', producedBy: 'foundry',
  };
  const run = await runArtifactTask('foundry', 'art', expected, actual);
  assert.equal(run.status, 'failed');
  assert.match(run.taskRuns.check?.error ?? '', /identity/);
});

test('required Blender output rejects a wrong artifact label even when kind matches', async () => {
  const expected: NssStudioArtifactRef = { kind: 'glb', uri: '', label: 'hero.glb', producedBy: 'blender-engine' };
  const actual: NssStudioArtifactRef = { kind: 'glb', uri: 'C:\\assets\\enemy.glb', label: 'enemy.glb', producedBy: 'blender-engine' };
  const run = await runArtifactTask('blender-engine', 'blender', expected, actual);
  assert.equal(run.status, 'failed');
});

test('required output rejects a wrong producer and a blank artifact URI', async () => {
  const expected: NssStudioArtifactRef = { kind: 'glb', uri: '', label: 'hero.glb', producedBy: 'blender-engine' };
  const wrongProducer: NssStudioArtifactRef = { ...expected, uri: 'C:\\assets\\hero.glb', producedBy: 'flyrail' };
  const blankUri: NssStudioArtifactRef = { ...expected, uri: '   ' };
  assert.equal((await runArtifactTask('blender-engine', 'blender', expected, wrongProducer)).status, 'failed');
  assert.equal((await runArtifactTask('blender-engine', 'blender', expected, blankUri)).status, 'failed');
});

test('additional validators can reject but cannot replace the strict evidence gate', async () => {
  const controller = new StudioRunController({
    registry: setup(),
    validator: { validate: () => ({ passed: false, criteria: [], evidenceConsidered: [], failures: ['Additional gate failed'], warnings: [] }) },
  });
  assert.equal((await controller.executeRun(makePlan())).status, 'failed');
});

test('restart recovery checks a remote task without resubmitting the mutation', async () => {
  let submissions = 0;
  const plan = makePlan();
  const recovered: StudioRun = {
    id: 'recovered-run',
    plan,
    status: 'running',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    updatedAt: new Date(Date.now() - 500).toISOString(),
    tasks: [{ id: 'check', executionId: 'recovered-run-check', status: 'running', startedAt: new Date(Date.now() - 900).toISOString() }],
  };
  const controller = new StudioRunController({
    registry: setup({
      submitTask: async handoff => {
        submissions++;
        return { taskId: handoff.taskId, specialistId: 'flyrail', accepted: true };
      },
    }),
    initialRuns: [recovered],
  });
  const [run] = await controller.reconcileRecoveredRuns();
  assert.equal(run.status, 'completed');
  assert.equal(run.tasks[0].status, 'completed');
  assert.equal(submissions, 0);
});

test('restart recovery remains fail-closed while remote work is still active', async () => {
  const plan = makePlan();
  const recovered: StudioRun = {
    id: 'uncertain-run',
    plan,
    status: 'running',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    updatedAt: new Date(Date.now() - 500).toISOString(),
    tasks: [{ id: 'check', executionId: 'uncertain-run-check', status: 'running', startedAt: new Date(Date.now() - 900).toISOString() }],
  };
  const controller = new StudioRunController({
    registry: setup({ getTaskStatus: async id => ({ taskId: id, specialistId: 'flyrail', phase: 'running' }) }),
    initialRuns: [recovered],
  });
  const [run] = await controller.reconcileRecoveredRuns();
  assert.equal(run.status, 'cancel-requested');
  await assert.rejects(() => controller.executeRun(makePlan()), /already active/i);
});
