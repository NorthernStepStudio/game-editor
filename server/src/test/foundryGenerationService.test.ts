import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type {
  FoundryAssetProvider,
  FoundryAssetProviderDescriptor,
} from '../../../core/out/index.js';
import { FoundryAssetService } from '../services/foundryAssetService.js';
import { FoundryGenerationService } from '../services/foundryGenerationService.js';

const license = {
  name: 'MIT',
  spdxId: 'MIT',
  classification: 'permissive' as const,
  reusePolicy: 'direct' as const,
};

function provider(
  descriptorOverrides: Partial<FoundryAssetProviderDescriptor> = {},
  onExecute: () => void = () => undefined,
): FoundryAssetProvider {
  return {
    descriptor: {
      id: 'local-test',
      name: 'Local Test',
      operations: ['generate'],
      kinds: ['pixel_sprite'],
      local: true,
      requiresNetwork: false,
      externalCost: false,
      supportsSeed: false,
      supportsReferences: false,
      outputLicense: license,
      commercialUseAllowed: true,
      ...descriptorOverrides,
    },
    async execute(request, context) {
      onExecute();
      return {
        outputs: [
          {
            providerId: this.descriptor.id,
            requestId: request.requestId,
            outputIndex: 0,
            localPath: join(context?.outputRoot ?? '', 'hero.png'),
            contentHash: 'generated-hash',
          },
        ],
        ...(this.descriptor.externalCost
          ? { cost: { currency: 'CREDITS', amount: 2 } }
          : {}),
      };
    },
  };
}

test('Foundry generation service persists successful executions automatically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-generation-'));
  const project = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-project-'));
  try {
    const assets = new FoundryAssetService(root, [
      { id: 'demo', name: 'Demo', path: project },
    ]);
    const generation = new FoundryGenerationService(
      [{ id: 'demo', name: 'Demo', path: project }],
      assets,
      { providers: [provider()] },
    );

    const result = await generation.execute({
      projectId: 'demo',
      assetId: 'hero',
      kind: 'pixel_sprite',
      operation: 'generate',
      providerId: 'local-test',
    });

    assert.equal(result.provider.id, 'local-test');
    assert.equal(assets.store.require('hero').contentHash, 'generated-hash');
    assert.equal(
      assets.store.require('hero').localPath,
      join(project, 'assets', 'generated', 'foundry', 'hero.png'),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});

test('Foundry generation service requires approval and budget for paid providers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-generation-'));
  const project = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-project-'));
  try {
    const assets = new FoundryAssetService(root, [
      { id: 'demo', name: 'Demo', path: project },
    ]);
    const paid = provider({
      id: 'paid-test',
      name: 'Paid Test',
      local: false,
      requiresNetwork: true,
      externalCost: true,
    });
    const generation = new FoundryGenerationService(
      [{ id: 'demo', name: 'Demo', path: project }],
      assets,
      { providers: [paid] },
    );

    await assert.rejects(
      () =>
        generation.execute({
          projectId: 'demo',
          assetId: 'hero',
          kind: 'pixel_sprite',
          operation: 'generate',
          providerId: 'paid-test',
          allowNetwork: true,
        }),
      /external-cost approval|explicit cost budget/i,
    );

    const result = await generation.execute({
      projectId: 'demo',
      assetId: 'hero',
      kind: 'pixel_sprite',
      operation: 'generate',
      providerId: 'paid-test',
      allowNetwork: true,
      approveExternalCost: true,
      maxCost: { currency: 'CREDITS', amount: 3 },
    });
    assert.equal(result.generated.cost?.amount, 2);
    assert.equal(assets.store.require('hero').generationProvider, 'paid-test');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});


test('Foundry generation rejects asset ID collisions before calling a paid provider', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-generation-'));
  const project = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-project-'));
  try {
    const assets = new FoundryAssetService(root, [
      { id: 'demo', name: 'Demo', path: project },
    ]);
    assets.store.register({
      assetId: 'hero-01',
      type: 'pixel_sprite',
      sourceIds: ['provider:test'],
      createdAt: '2026-09-25T10:00:00.000Z',
    });

    let calls = 0;
    const paid = provider(
      {
        id: 'paid-test',
        name: 'Paid Test',
        local: false,
        requiresNetwork: true,
        externalCost: true,
      },
      () => {
        calls += 1;
      },
    );
    const generation = new FoundryGenerationService(
      [{ id: 'demo', name: 'Demo', path: project }],
      assets,
      { providers: [paid] },
    );

    await assert.rejects(
      () =>
        generation.execute({
          projectId: 'demo',
          assetId: 'hero',
          kind: 'pixel_sprite',
          operation: 'generate',
          providerId: 'paid-test',
          allowNetwork: true,
          approveExternalCost: true,
          maxCost: { currency: 'CREDITS', amount: 3 },
        }),
      /would collide with existing asset hero-01/i,
    );
    assert.equal(calls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});

test('Foundry generation rejects missing project output roots before provider execution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-generation-'));
  const missingProject = join(root, 'missing-project');
  let calls = 0;
  try {
    const assets = new FoundryAssetService(root, [
      { id: 'demo', name: 'Demo', path: missingProject },
    ]);
    const generation = new FoundryGenerationService(
      [{ id: 'demo', name: 'Demo', path: missingProject }],
      assets,
      {
        providers: [
          provider({}, () => {
            calls += 1;
          }),
        ],
      },
    );

    await assert.rejects(
      () =>
        generation.execute({
          projectId: 'demo',
          assetId: 'hero',
          kind: 'pixel_sprite',
          operation: 'generate',
          providerId: 'local-test',
        }),
      /project path does not exist/i,
    );
    assert.equal(calls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
