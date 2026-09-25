import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FoundryAssetManifest } from '../../../core/out/index.js';
import { FoundryAssetStore } from '../services/foundryAssetStore.js';

function manifest(
  assetId: string,
  overrides: Partial<FoundryAssetManifest> = {},
): FoundryAssetManifest {
  return {
    assetId,
    type: 'pixel_sprite',
    sourceIds: ['provider:test'],
    sourceLicenseIds: ['MIT'],
    generationProvider: 'test-provider',
    createdAt: '2026-09-25T10:00:00.000Z',
    ...overrides,
  };
}

test('Foundry asset store persists assets and lineage across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-store-'));
  try {
    const store = new FoundryAssetStore(root);
    store.registerMany([
      manifest('hero-base'),
      manifest('hero-run', {
        parentAsset: 'hero-base',
        operation: 'animate',
      }),
    ]);

    const reloaded = new FoundryAssetStore(root);
    assert.deepEqual(
      reloaded.list().map((asset) => asset.assetId),
      ['hero-base', 'hero-run'],
    );
    assert.deepEqual(
      reloaded.lineage('hero-run').map((asset) => asset.assetId),
      ['hero-base', 'hero-run'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Foundry asset store rejects duplicate IDs without corrupting disk state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-store-'));
  try {
    const store = new FoundryAssetStore(root);
    store.register(manifest('hero'));
    assert.throws(
      () => store.register(manifest('hero', { type: 'sprite_sheet' })),
      /duplicate assetId|already contains assetId/i,
    );

    const reloaded = new FoundryAssetStore(root);
    assert.equal(reloaded.list().length, 1);
    assert.equal(reloaded.require('hero').type, 'pixel_sprite');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
