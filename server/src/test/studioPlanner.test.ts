import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createStudioPlan,
  StudioAdapterRegistry,
  StudioRunController,
  type NssStudioExecutionResult,
  type NssStudioHandoff,
  type SpecialistAdapter,
} from '../../../core/out/index.js';
import { StudioHistory } from '../services/studioHistory.js';
import { FoundryStudioAdapter, foundryAssetOutputCriterion } from '../services/foundryStudioAdapter.js';
import { MatterhornQaAdapter } from '../services/matterhornQaAdapter.js';
import { createStudioPlannerPlan, createStudioPlannerPlanWithAssistant } from '../services/studioPlanner.js';
import type { StudioRoutingPreferences } from '../services/studioRoutingPreferences.js';
import type { FoundryProviderStatus } from '../services/foundryGenerationService.js';

const project = { id: 'demo', name: 'Demo', path: 'C:\\projects\\demo' };
const basePreferences: StudioRoutingPreferences = {
  version: 1,
  game: 'auto',
  threeD: 'auto',
  assets: 'auto',
  localFirst: true,
  requireCommercialUse: true,
  allowNetworkProviders: false,
  allowExternalCostProviders: false,
  updatedAt: new Date(0).toISOString(),
};
const provider = (values: Partial<FoundryProviderStatus> & Pick<FoundryProviderStatus, 'id' | 'operations' | 'kinds'>): FoundryProviderStatus => ({
  id: values.id,
  name: values.name ?? values.id,
  configured: values.configured ?? true,
  available: values.available ?? true,
  local: values.local ?? false,
  requiresNetwork: values.requiresNetwork ?? false,
  externalCost: values.externalCost ?? false,
  commercialUseAllowed: values.commercialUseAllowed ?? true,
  operations: values.operations,
  kinds: values.kinds,
  note: values.note ?? 'test provider',
  ...(values.estimatedCost ? { estimatedCost: values.estimatedCost } : {}),
});
const spriteFusion = provider({
  id: 'sprite-fusion', operations: ['generate'], kinds: ['sprite_sheet', 'pixel_sprite'],
  requiresNetwork: true, externalCost: true, estimatedCost: { currency: 'SPRITE_FUSION_CREDITS', amount: 15 },
});
const comfy = provider({ id: 'comfyui-local', operations: ['generate'], kinds: ['background', 'concept_art'], local: true, requiresNetwork: false, externalCost: false, commercialUseAllowed: true });
const criteria = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass'];

function taskSummary(goal: string, options: Parameters<typeof createStudioPlannerPlan>[0]['project'] extends never ? never : Partial<Parameters<typeof createStudioPlannerPlan>[0]> = {}, preferences = basePreferences, providers: readonly FoundryProviderStatus[] = [spriteFusion, comfy]) {
  return createStudioPlannerPlan({ goal, project, criteria, ...options }, preferences, providers).tasks;
}

test('Godot-only intent routes through Flyrail and a real Matterhorn QA stage', () => {
  const tasks = taskSummary('Change the dash cooldown in my Godot game and test it.');
  assert.deepEqual(tasks.map(task => task.specialistId), ['flyrail', 'matterhorn']);
  assert.deepEqual(tasks[1]?.dependsOn, ['flyrail-game-work']);
  assert.equal(tasks.some(task => task.specialistId === 'blender-engine' || task.specialistId === 'foundry'), false);
});

test('2D pixel-art game request routes Foundry before Flyrail and QA with per-request approvals off', () => {
  const tasks = taskSummary('Make a 2D pixel-art farming scene with animated characters.');
  assert.deepEqual(tasks.map(task => task.specialistId), ['foundry', 'flyrail', 'matterhorn']);
  assert.deepEqual(tasks[1]?.dependsOn, ['foundry-assets-1']);
  assert.deepEqual(tasks[2]?.dependsOn, ['foundry-assets-1', 'flyrail-game-work']);
  const foundry = tasks[0]!;
  assert.equal(foundry.taskSpec?.specialist, 'foundry');
  if (foundry.taskSpec?.specialist !== 'foundry') throw new Error('Expected Foundry task spec.');
  assert.equal(foundry.taskSpec.kind, 'sprite_sheet');
  assert.equal(foundry.taskSpec.allowNetwork, false);
  assert.equal(foundry.taskSpec.approveExternalCost, false);
  assert.equal(foundry.disclosure?.networkMayBeRequired, true);
  assert.equal(foundry.disclosure?.externalCostMayBeIncurred, true);
  assert.equal(foundry.disclosure?.explicitApprovalRequired, true);
});

test('3D enemy game request routes Blender before Flyrail and uses Foundry references only when requested', () => {
  const tasks = taskSummary('Create a stylized 3D enemy, import it into my Godot game, add its attack behavior, and test it.');
  assert.deepEqual(tasks.map(task => task.specialistId), ['blender-engine', 'flyrail', 'matterhorn']);
  assert.deepEqual(tasks[1]?.dependsOn, ['blender-work']);

  const withReference = taskSummary('Create concept art references for a stylized 3D enemy, import it into my Godot game, and test it.');
  assert.deepEqual(withReference.map(task => task.specialistId), ['foundry', 'blender-engine', 'flyrail', 'matterhorn']);
  assert.equal(withReference[1]?.dependsOn?.[0], 'foundry-assets-1');
  assert.deepEqual(withReference[0]?.outputArtifacts?.[0]?.assetId, withReference[1]?.taskSpec?.specialist === 'blender-engine' ? withReference[1]?.taskSpec.sourceAssetIds?.[0] : undefined);
});

test('Blender-only intent remains Blender plus QA and accepts a validated structured Blender spec', () => {
  const tasks = taskSummary('Create a humanoid character prototype in Blender.', { domains: ['blender'] });
  assert.deepEqual(tasks.map(task => task.specialistId), ['blender-engine', 'matterhorn']);
  assert.equal(tasks.some(task => task.specialistId === 'flyrail'), false);
  const withSpec = taskSummary('Create an asset in Blender.', {
    domains: ['blender'],
    blenderTaskSpec: {
      schemaVersion: '1.0.0', assetName: 'fixture', operations: [{ op: 'scene.new', sceneName: 'PlannerFixture' }],
      workingDirectory: 'ignored', expectedArtifacts: [{ kind: 'blend', name: 'fixture.blend', required: true }],
      acceptanceCriteria: ['fixture scene saved'],
    },
  });
  assert.equal(withSpec[0]?.taskSpec?.specialist, 'blender-engine');
});

test('explicit ComfyUI preference is carried into the Foundry task without switching providers', () => {
  const tasks = taskSummary('Generate concept art for my prototype.', { assets: [{ kind: 'concept_art', operation: 'generate' }] }, { ...basePreferences, assets: 'comfyui-local' });
  const spec = tasks[0]?.taskSpec;
  assert.equal(spec?.specialist, 'foundry');
  if (spec?.specialist !== 'foundry') throw new Error('Expected Foundry task spec.');
  assert.equal(spec.providerId, 'comfyui-local');
  assert.deepEqual(tasks[0]?.requiredCapabilities, ['foundry.asset.generate', 'foundry.provider.comfyui-local']);
});

test('Sprite Fusion preference remains explicit and cannot bypass per-request network, cost, or budget approval', () => {
  const tasks = taskSummary('Generate a pixel sprite.', { assets: [{ kind: 'pixel_sprite', operation: 'generate' }] }, { ...basePreferences, assets: 'sprite-fusion', allowNetworkProviders: true, allowExternalCostProviders: true });
  const spec = tasks[0]?.taskSpec;
  assert.equal(spec?.specialist, 'foundry');
  if (spec?.specialist !== 'foundry') throw new Error('Expected Foundry task spec.');
  assert.equal(spec.providerId, 'sprite-fusion');
  assert.equal(spec.allowNetwork, false);
  assert.equal(spec.approveExternalCost, false);
  assert.equal(spec.maxCost, undefined);
  assert.equal(tasks[0]?.disclosure?.explicitApprovalRequired, true);
});

test('commercial-use preference cannot be weakened by an asset request', () => {
  const tasks = taskSummary('Generate concept art.', { assets: [{ kind: 'concept_art', requireCommercialUse: false }] });
  const spec = tasks[0]?.taskSpec;
  assert.equal(spec?.specialist, 'foundry');
  if (spec?.specialist !== 'foundry') throw new Error('Expected Foundry task spec.');
  assert.equal(spec.requireCommercialUse, true);
});

test('provider-neutral planner suggestions augment deterministic routing without changing criteria or policy', async () => {
  let assistantRequest: Parameters<NonNullable<Parameters<typeof createStudioPlannerPlanWithAssistant>[3]>['proposePlan']>[0] | undefined;
  const result = await createStudioPlannerPlanWithAssistant({
    goal: 'Update my Godot game and make a pixel sprite.', project, criteria,
  }, basePreferences, [spriteFusion, comfy], {
    proposePlan: async request => {
      assistantRequest = request;
      return {
        domains: ['assets', 'blender'],
        assets: [{ kind: 'pixel_sprite', operation: 'generate', prompt: 'A clear test sprite.' }],
      };
    },
  });

  assert.equal(result.source, 'assistant-assisted');
  assert.deepEqual(assistantRequest?.acceptanceCriteria, criteria);
  assert.deepEqual(assistantRequest?.project, { id: project.id, name: project.name });
  assert.equal('path' in (assistantRequest?.project ?? {}), false);
  assert.deepEqual(result.plan.finalAcceptanceCriteria, criteria);
  assert.deepEqual(result.plan.tasks.map(task => task.specialistId), ['foundry', 'blender-engine', 'flyrail', 'matterhorn']);
  const foundryTask = result.plan.tasks[0]!;
  assert.equal(foundryTask.taskSpec?.specialist, 'foundry');
  if (foundryTask.taskSpec?.specialist !== 'foundry') throw new Error('Expected a Foundry task spec.');
  assert.equal(foundryTask.taskSpec.allowNetwork, false);
  assert.equal(foundryTask.taskSpec.approveExternalCost, false);
  assert.equal(foundryTask.taskSpec.maxCost, undefined);
  assert.equal(foundryTask.disclosure?.explicitApprovalRequired, true);
  assert.deepEqual(result.plan.tasks.at(-1)?.dependsOn, ['foundry-assets-1', 'blender-work', 'flyrail-game-work']);
});

test('malformed or partial planner results fall back to the deterministic plan', async () => {
  for (const proposed of [null, 'not-json', {}, { domains: ['godot'], assets: [{ kind: 'pixel_sprite' }] }]) {
    const result = await createStudioPlannerPlanWithAssistant({ goal: 'Change gameplay in Godot.', project, criteria }, basePreferences, [], {
      proposePlan: async () => proposed,
    });
    assert.equal(result.source, 'deterministic');
    assert.equal(result.fallbackReason, 'invalid-assistant-result');
    assert.deepEqual(result.plan.tasks.map(task => task.specialistId), ['flyrail', 'matterhorn']);
    assert.deepEqual(result.plan.finalAcceptanceCriteria, criteria);
  }
});

test('assistant failure deterministically falls back without blocking plan creation', async () => {
  const result = await createStudioPlannerPlanWithAssistant({ goal: 'Change gameplay in Godot.', project, criteria }, basePreferences, [], {
    proposePlan: async () => { throw new Error('provider-specific transport failure'); },
  });
  assert.equal(result.source, 'deterministic');
  assert.equal(result.fallbackReason, 'assistant-failed');
  assert.deepEqual(result.plan.tasks.map(task => task.specialistId), ['flyrail', 'matterhorn']);
});

test('unsupported domains and model-supplied specialist assignments are rejected to deterministic routing', async () => {
  for (const proposed of [
    { domains: ['audio'] },
    { domains: ['blender'], specialists: ['unregistered-specialist'] },
    { domains: ['godot'], tasks: [{ domain: 'godot', specialistId: 'missing' }] },
  ]) {
    const result = await createStudioPlannerPlanWithAssistant({ goal: 'Change gameplay in Godot.', project, criteria }, basePreferences, [], {
      proposePlan: async () => proposed,
    });
    assert.equal(result.source, 'deterministic');
    assert.equal(result.fallbackReason, 'invalid-assistant-result');
    assert.equal(result.plan.tasks[0]?.specialistId, 'flyrail');
  }
});

test('assistant cannot replace final acceptance criteria or weaken invalid caller criteria', async () => {
  const changedCriteria = await createStudioPlannerPlanWithAssistant({ goal: 'Change gameplay in Godot.', project, criteria }, basePreferences, [], {
    proposePlan: async () => ({ domains: ['godot'], finalAcceptanceCriteria: ['Looks good'] }),
  });
  assert.equal(changedCriteria.fallbackReason, 'invalid-assistant-result');
  assert.deepEqual(changedCriteria.plan.finalAcceptanceCriteria, criteria);

  let assistantCalled = false;
  await assert.rejects(() => createStudioPlannerPlanWithAssistant({
    goal: 'Change gameplay in Godot.', project, criteria: ['  '],
  }, basePreferences, [], {
    proposePlan: async () => { assistantCalled = true; return { domains: ['godot'] }; },
  }), /Supply at most 20 nonempty acceptance criteria/);
  assert.equal(assistantCalled, false);
});

test('assistant cannot override server-selected provider or request-level approval policy', async () => {
  const result = await createStudioPlannerPlanWithAssistant({
    goal: 'Make a pixel sprite.', project, criteria,
  }, { ...basePreferences, assets: 'sprite-fusion' }, [spriteFusion, comfy], {
    proposePlan: async () => ({ domains: ['assets'], assets: [{
      kind: 'pixel_sprite', operation: 'generate', prompt: 'Sprite',
      providerId: 'comfyui-local', allowNetwork: true, approveExternalCost: true, maxCost: { currency: 'USD', amount: 100 },
    }] }),
  });
  assert.equal(result.source, 'deterministic');
  assert.equal(result.fallbackReason, 'invalid-assistant-result');
  const foundryTask = result.plan.tasks[0]!;
  assert.equal(foundryTask.taskSpec?.specialist, 'foundry');
  if (foundryTask.taskSpec?.specialist !== 'foundry') throw new Error('Expected a Foundry task spec.');
  assert.equal(foundryTask.taskSpec.providerId, 'sprite-fusion');
  assert.equal(foundryTask.taskSpec.allowNetwork, false);
  assert.equal(foundryTask.taskSpec.approveExternalCost, false);
  assert.equal(foundryTask.taskSpec.maxCost, undefined);
});

test('Foundry Studio adapter persists and verifies generated asset provenance before reporting completion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-adapter-'));
  try {
    const path = join(dir, 'hero.png');
    const bytes = Buffer.from('fixture image bytes');
    await writeFile(path, bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const manifest = {
      assetId: 'hero', type: 'concept_art', requestId: 'foundry-request',
      generationProvider: 'comfyui-local', contentHash: hash, localPath: path,
      sourceIds: [], createdAt: new Date().toISOString(),
      parentAsset: undefined, referenceAssets: [],
    };
    const generation = {
      providers: () => [comfy],
      execute: async (raw: Record<string, unknown>) => {
        assert.equal(raw.projectId, 'demo');
        assert.equal(raw.allowNetwork, false);
        assert.equal(raw.approveExternalCost, false);
        assert.equal(raw.requireCommercialUse, true);
        return {
          request: { requestId: 'foundry-request', assetId: 'hero', kind: 'concept_art', operation: 'generate' },
          provider: { id: 'comfyui-local', name: 'ComfyUI Local' },
          generated: { outputs: [] },
          manifests: [{ assetId: 'hero' }],
        };
      },
    } as never;
    const assets = { store: { get: (id: string) => id === 'hero' ? manifest : undefined } } as never;
    const adapter = new FoundryStudioAdapter(generation, assets);
    const criterion = foundryAssetOutputCriterion('hero');
    await adapter.submitTask({
      protocol: 'nss.studio-handoff.v1',
      id: 'handoff-hero',
      taskId: 'run-foundry-assets-1',
      from: 'matterhorn',
      to: 'foundry',
      goal: 'Generate concept art.',
      acceptanceCriteria: [criterion],
      inputArtifacts: [],
      taskSpec: {
        protocol: 'nss.studio-task-spec.v1', specialist: 'foundry', action: 'generate_asset',
        projectId: 'demo', assetId: 'hero', kind: 'concept_art', operation: 'generate',
        prompt: 'Hero concept', allowNetwork: false, approveExternalCost: false, requireCommercialUse: true,
      },
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await adapter.getTaskStatus('run-foundry-assets-1');
      if (status.phase === 'completed' || status.phase === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    const result = await adapter.getResult('run-foundry-assets-1');
    assert.equal(result.status, 'completed');
    assert.equal(result.specialistId, 'foundry');
    assert.equal(result.artifacts?.[0]?.assetId, 'hero');
    assert.equal(result.artifacts?.[0]?.provenance?.requestId, 'foundry-request');
    assert.equal(result.artifacts?.[0]?.provenance?.contentHash, hash);
    assert.equal(result.criterionResults?.[0]?.outcome, 'passed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('explicit routes are never silently substituted when the selected provider is unavailable', async () => {
  const tasks = taskSummary('Generate concept art.', { assets: [{ kind: 'concept_art' }] }, { ...basePreferences, assets: 'comfyui-local' }, [spriteFusion]);
  const registry = new StudioAdapterRegistry();
  const unavailable = stubAdapter('foundry', {
    health: async () => ({ available: true, specialistId: 'foundry' }),
    getCapabilities: async () => ({ specialistId: 'foundry', protocolVersion: 'test', capabilities: ['foundry.asset.generate'] }),
  });
  registry.register(unavailable);
  registry.register(new MatterhornQaAdapter());
  const run = await new StudioRunController({ registry, taskTimeoutMs: 200, requestTimeoutMs: 50, pollIntervalMs: 1 })
    .executeRun(createStudioPlan({ goal: 'Generate concept art.', tasks, finalAcceptanceCriteria: criteria }));
  assert.equal(run.status, 'blocked');
  assert.match(run.taskRuns['foundry-assets-1']?.error ?? '', /foundry\.provider\.comfyui-local/);
});

test('failed upstream specialist blocks Flyrail and QA dependencies', async () => {
  let flyrailSubmissions = 0;
  const registry = new StudioAdapterRegistry();
  registry.register(stubAdapter('foundry', {
    getCapabilities: async () => ({ specialistId: 'foundry', protocolVersion: 'test', capabilities: ['foundry.asset.generate'] }),
    getTaskStatus: async id => ({ taskId: id, specialistId: 'foundry', phase: 'failed' }),
    getResult: async id => ({ taskId: id, specialistId: 'foundry', status: 'failed', summary: 'provider failed' }),
  }));
  registry.register(stubAdapter('flyrail', {
    getCapabilities: async () => ({ specialistId: 'flyrail', protocolVersion: 'test', capabilities: ['godot.project.inspect', 'godot.project.run', 'godot.validation.run'] }),
    submitTask: async handoff => { flyrailSubmissions += 1; return { taskId: handoff.taskId, specialistId: 'flyrail', accepted: true }; },
  }));
  registry.register(new MatterhornQaAdapter());
  const plan = createStudioPlannerPlan({ goal: 'Create a pixel sprite for my Godot game scene.', project, criteria, assets: [{ kind: 'pixel_sprite', operation: 'generate' }] }, basePreferences, [spriteFusion]);
  const run = await new StudioRunController({ registry, taskTimeoutMs: 200, requestTimeoutMs: 50, pollIntervalMs: 1 }).executeRun(plan);
  assert.equal(run.status, 'failed');
  assert.equal(flyrailSubmissions, 0);
  assert.equal(run.taskRuns['flyrail-game-work']?.status, 'blocked');
  assert.equal(run.taskRuns['matterhorn-qa']?.status, 'blocked');
});

test('QA aggregation blocks when final criteria lack specialist evidence', async () => {
  const criterion = 'The attack animation plays without clipping.';
  const registry = new StudioAdapterRegistry();
  registry.register(stubAdapter('foundry', {
    getCapabilities: async () => ({ specialistId: 'foundry', protocolVersion: 'test', capabilities: ['foundry.asset.generate'] }),
    getResult: async id => {
      const outputCriterion = foundryAssetOutputCriterion('generated-art');
      return {
        taskId: id,
        specialistId: 'foundry',
        status: 'completed',
        summary: 'Generated artifact file and manifest verified.',
        artifacts: [{ kind: 'foundry-asset', uri: 'C:\\assets\\generated.png', assetId: 'generated-art', label: 'generated-art', producedBy: 'foundry' }],
        evidence: [{ kind: 'artifact', outcome: 'passed', summary: 'hash verified', uri: 'foundry://asset/generated-art' }],
        criterionResults: [{ criterion: outputCriterion, description: outputCriterion, outcome: 'passed', evidenceUri: 'foundry://asset/generated-art' }],
      };
    },
  }));
  registry.register(new MatterhornQaAdapter());
  const plan = createStudioPlannerPlan({ goal: 'Generate concept art.', project, criteria: [criterion], assets: [{ assetId: 'generated-art', kind: 'concept_art', operation: 'generate' }] }, basePreferences, [comfy]);
  const run = await new StudioRunController({ registry, taskTimeoutMs: 200, requestTimeoutMs: 50, pollIntervalMs: 1 }).executeRun(plan);
  assert.equal(run.status, 'blocked');
  assert.equal(run.taskRuns['matterhorn-qa']?.status, 'blocked');
  assert.match(run.taskRuns['matterhorn-qa']?.error ?? '', /lacks consistent, passing specialist evidence/);
});

test('QA accepts multiple consistent passing proofs and preserves every source execution ID', async () => {
  const criterion = 'The attack animation plays without clipping.';
  const result = await aggregateQa(criterion, [
    qaProof(criterion, 'run-blender-model', 'blender-engine', 'proof://blender', 'No clipping observed'),
    qaProof(criterion, 'run-flyrail-gameplay', 'flyrail', 'proof://flyrail', 'No clipping observed'),
  ]);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.criterionResults?.[0]?.sourceExecutionIds, ['run-blender-model', 'run-flyrail-gameplay']);
  assert.equal(result.criterionResults?.[0]?.sourceExecutionId, 'run-blender-model');
  assert.deepEqual(result.evidence?.map(item => item.uri), ['proof://blender', 'proof://flyrail']);
});

test('QA fails closed when a valid pass conflicts with failed evidence', async () => {
  const criterion = 'The attack animation plays without clipping.';
  const result = await aggregateQa(criterion, [
    qaProof(criterion, 'run-blender-model', 'blender-engine', 'proof://blender', 'No clipping observed'),
    qaProof(criterion, 'run-flyrail-gameplay', 'flyrail', 'proof://flyrail', 'Clipping observed', 'failed'),
  ]);
  assert.equal(result.status, 'failed');
  assert.equal(result.criterionResults?.[0]?.outcome, 'failed');
  assert.deepEqual(result.criterionResults?.[0]?.sourceExecutionIds, ['run-blender-model', 'run-flyrail-gameplay']);
  assert.deepEqual(result.evidence?.map(item => item.outcome), ['passed', 'failed']);
});

test('QA blocks when a passing proof conflicts with blocked evidence', async () => {
  const criterion = 'The attack animation plays without clipping.';
  const result = await aggregateQa(criterion, [
    qaProof(criterion, 'run-blender-model', 'blender-engine', 'proof://blender', 'No clipping observed'),
    qaProof(criterion, 'run-flyrail-gameplay', 'flyrail', 'proof://flyrail', 'Could not inspect animation', 'blocked'),
  ]);
  assert.equal(result.status, 'blocked');
  assert.equal(result.criterionResults?.[0]?.outcome, 'blocked');
  assert.deepEqual(result.criterionResults?.[0]?.sourceExecutionIds, ['run-blender-model', 'run-flyrail-gameplay']);
});

test('QA fails closed when passing proofs report contradictory actual values', async () => {
  const criterion = 'Player health remains 100 after the attack.';
  const result = await aggregateQa(criterion, [
    qaProof(criterion, 'run-blender-model', 'blender-engine', 'proof://blender', 100),
    qaProof(criterion, 'run-flyrail-gameplay', 'flyrail', 'proof://flyrail', 75),
  ]);
  assert.equal(result.status, 'failed');
  assert.equal(result.criterionResults?.[0]?.outcome, 'failed');
});

test('multi-specialist plan and structured task specifications survive Studio restart persistence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'matterhorn-planner-history-'));
  try {
    const plan = createStudioPlannerPlan({ goal: 'Make a 2D pixel-art farming scene with animated characters.', project, criteria, id: 'planner-history-plan' }, basePreferences, [spriteFusion, comfy]);
    const runId = 'planner-history-run';
    const now = new Date().toISOString();
    const run = {
      id: runId,
      status: 'blocked' as const,
      createdAt: now,
      updatedAt: now,
      plan,
      tasks: plan.tasks.map(task => ({ id: task.id, executionId: `${runId}-${task.id}`, status: 'blocked' as const })),
    };
    new StudioHistory(dir).persist(run);
    const recovered = new StudioHistory(dir).load()[0]!;
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.plan)), JSON.parse(JSON.stringify(plan)));
    assert.equal(recovered.plan.tasks[0]?.taskSpec?.specialist, 'foundry');
    assert.equal(recovered.plan.tasks.at(-1)?.specialistId, 'matterhorn');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function stubAdapter(
  specialistId: SpecialistAdapter['specialistId'],
  overrides: Partial<SpecialistAdapter> = {},
): SpecialistAdapter {
  const base: SpecialistAdapter = {
    specialistId,
    health: async () => ({ available: true, specialistId }),
    getCapabilities: async () => ({ specialistId, protocolVersion: 'test', capabilities: [] }),
    submitTask: async handoff => ({ taskId: handoff.taskId, specialistId, accepted: true }),
    getTaskStatus: async taskId => ({ taskId, specialistId, phase: 'completed' }),
    getResult: async taskId => genericPassedResult(taskId, specialistId),
    cancelTask: async taskId => ({ taskId, cancelled: false }),
  };
  return { ...base, ...overrides };
}

function genericPassedResult(taskId: string, specialistId: SpecialistAdapter['specialistId']): NssStudioExecutionResult {
  return {
    taskId,
    specialistId,
    status: 'completed',
    summary: 'Generated artifact file and manifest verified.',
    artifacts: [{ kind: 'foundry-asset', uri: 'C:\\assets\\generated.png', assetId: 'generated-art', label: 'generated-art', producedBy: 'foundry' }],
    evidence: [{ kind: 'artifact', outcome: 'passed', summary: 'hash verified', uri: 'foundry://asset/generated-art' }],
    criterionResults: [],
  };
}

async function aggregateQa(criterion: string, dependencyResults: readonly NssStudioExecutionResult[]): Promise<NssStudioExecutionResult> {
  const adapter = new MatterhornQaAdapter();
  const taskId = 'run-matterhorn-qa';
  await adapter.submitTask({
    protocol: 'nss.studio-handoff.v1',
    id: taskId,
    taskId,
    from: 'matterhorn',
    to: 'matterhorn',
    goal: 'Aggregate specialist evidence.',
    acceptanceCriteria: [criterion],
    inputArtifacts: [],
    taskSpec: {
      protocol: 'nss.studio-task-spec.v1',
      specialist: 'matterhorn',
      action: 'aggregate_evidence',
      dependencyTaskIds: ['blender-model', 'flyrail-gameplay'],
      criteria: [criterion],
    },
    dependencyResults,
  });
  return adapter.getResult(taskId);
}

function qaProof(
  criterion: string,
  taskId: string,
  specialistId: 'blender-engine' | 'flyrail',
  evidenceUri: string,
  actual: unknown,
  outcome: 'passed' | 'failed' | 'blocked' = 'passed',
): NssStudioExecutionResult {
  return {
    taskId,
    specialistId,
    status: 'completed',
    summary: 'Specialist criterion evidence.',
    evidence: [{ kind: 'test', summary: 'Criterion proof.', outcome: outcome === 'passed' ? 'passed' : outcome, uri: evidenceUri }],
    criterionResults: [{
      criterion,
      description: criterion,
      checkType: 'generic',
      expected: criterion.includes('health') ? 100 : 'No clipping observed',
      actual,
      outcome,
      evidenceUri,
    }],
  };
}


test('asset-only planning derives Foundry hash/provenance acceptance when the user supplies no extra criterion', () => {
  const plan = createStudioPlannerPlan({
    goal: 'Generate concept art for the project.',
    project,
    criteria: [],
    domains: ['assets'],
    assets: [{ assetId: 'concept-auto-proof', kind: 'concept_art', operation: 'generate', prompt: 'Project concept art' }],
  }, basePreferences, [comfy]);

  assert.deepEqual(plan.tasks.map(task => task.specialistId), ['foundry', 'matterhorn']);
  assert.deepEqual(plan.finalAcceptanceCriteria, [foundryAssetOutputCriterion('concept-auto-proof')]);
  assert.deepEqual(plan.tasks.at(-1)?.acceptanceCriteria, plan.finalAcceptanceCriteria);
});
