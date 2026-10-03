import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  StudioRoutingPreferencesStore,
  validateStudioRoutingPreferences,
} from '../services/studioRoutingPreferences.js';

test('Studio routing preferences default fail-closed for network and cost', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-routing-'));
  try {
    const store = new StudioRoutingPreferencesStore(root);
    const prefs = store.get();
    assert.equal(prefs.game, 'auto');
    assert.equal(prefs.threeD, 'auto');
    assert.equal(prefs.assets, 'auto');
    assert.equal(prefs.localFirst, true);
    assert.equal(prefs.requireCommercialUse, true);
    assert.equal(prefs.allowNetworkProviders, false);
    assert.equal(prefs.allowExternalCostProviders, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Studio routing preferences persist validated selections', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-routing-'));
  try {
    const store = new StudioRoutingPreferencesStore(root);
    const updated = store.update({
      game: 'flyrail',
      threeD: 'blender-engine',
      assets: 'comfyui-local',
      localFirst: true,
      requireCommercialUse: false,
      allowNetworkProviders: true,
      allowExternalCostProviders: false,
    });
    assert.equal(updated.game, 'flyrail');
    assert.equal(updated.threeD, 'blender-engine');
    assert.equal(updated.assets, 'comfyui-local');

    const reloaded = new StudioRoutingPreferencesStore(root).get();
    assert.equal(reloaded.game, 'flyrail');
    assert.equal(reloaded.threeD, 'blender-engine');
    assert.equal(reloaded.assets, 'comfyui-local');
    assert.equal(reloaded.allowNetworkProviders, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Studio routing preferences reject unknown routes and non-boolean policies', () => {
  assert.throws(
    () => validateStudioRoutingPreferences({ game: 'unknown' }),
    /unsupported route/i,
  );
  assert.throws(
    () => validateStudioRoutingPreferences({ localFirst: 'yes' }),
    /must be true or false/i,
  );
});
