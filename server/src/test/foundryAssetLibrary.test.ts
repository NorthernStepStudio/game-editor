import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FoundryAssetProvider } from '../../../core/out/index.js';
import { FoundryAssetService } from '../services/foundryAssetService.js';
import { FoundryGenerationService } from '../services/foundryGenerationService.js';

/** Stands in for Blender Agent: writes a GLB, a render and a script, reports progress. */
function fakeBlenderAgent(prompts: string[] = []): FoundryAssetProvider {
  return {
    descriptor: {
      id: 'blender-agent-local',
      name: 'Blender Agent (test)',
      operations: ['generate', 'edit'],
      kinds: ['mesh_3d'],
      local: true,
      requiresNetwork: false,
      externalCost: false,
      supportsSeed: false,
      supportsReferences: false,
      outputLicense: { name: 'Owner-generated', classification: 'permissive', reusePolicy: 'direct' },
      commercialUseAllowed: true,
    },
    async execute(request, context) {
      prompts.push(request.prompt ?? '');
      context?.onProgress?.('writing script');
      const dir = join(context!.outputRoot!, request.assetId);
      await mkdir(dir, { recursive: true });
      const glb = join(dir, `${request.assetId}.glb`);
      const render = join(dir, 'render_three_quarter.png');
      const script = join(dir, `${request.assetId}_script.py`);
      await writeFile(glb, 'glTF-binary');
      await writeFile(render, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await writeFile(script, 'import bpy\n');
      context?.onProgress?.('rendered');
      return {
        outputs: [{
          providerId: 'blender-agent-local',
          requestId: request.requestId,
          outputIndex: 0,
          localPath: glb,
          previewPath: render,
          companionFiles: [render, script],
          contentHash: 'hash',
        }],
      };
    },
  };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(check(), 'condition not reached');
}

test('Asset Library jobs build without a game, expose files, and send to a game project', async () => {
  const data = await mkdtemp(join(tmpdir(), 'matterhorn-library-data-'));
  const library = await mkdtemp(join(tmpdir(), 'matterhorn-library-'));
  const game = await mkdtemp(join(tmpdir(), 'matterhorn-game-'));
  const projects = [
    { id: 'library', name: 'Asset Library', path: library },
    { id: 'game', name: 'Game', path: game },
  ];
  try {
    const assets = new FoundryAssetService(data, projects);
    const generation = new FoundryGenerationService(projects, assets, { providers: [fakeBlenderAgent()] });

    const queued = generation.submitJob({
      projectId: 'library', assetId: 'crate_v1', kind: 'mesh_3d', operation: 'generate',
      prompt: 'a crate', providerId: 'blender-agent-local',
    });
    assert.equal(queued.status, 'queued');
    assert.throws(() => generation.submitJob({
      projectId: 'library', assetId: 'crate_v1', kind: 'mesh_3d', operation: 'generate', providerId: 'blender-agent-local',
    }), /already queued/);

    await waitFor(() => generation.getJob(queued.jobId)?.status === 'succeeded');
    const job = generation.getJob(queued.jobId)!;
    assert.deepEqual(job.assetIds, ['crate_v1']);
    assert.deepEqual(job.progress.map((p) => p.message), ['writing script', 'rendered']);

    const view = assets.get('crate_v1')!;
    assert.match(view.previewUrl ?? '', /\/preview$/);
    assert.deepEqual(view.files?.map((f) => [f.name, f.role]), [
      ['crate_v1.glb', 'main'],
      ['render_three_quarter.png', 'render'],
      ['crate_v1_script.py', 'script'],
    ]);
    assert.equal(assets.file('crate_v1', 'crate_v1.glb')?.contentType, 'model/gltf-binary');
    assert.equal(assets.file('crate_v1', '..\\..\\secrets.txt'), undefined);
    assert.equal(assets.preview('crate_v1')?.contentType, 'image/png');

    const sent = assets.sendToProject('crate_v1', 'game');
    assert.equal(sent.folder, 'assets/matterhorn/crate_v1');
    assert.ok(sent.files.includes('assets/matterhorn/crate_v1/crate_v1.glb'));
    const provenance = JSON.parse(readFileSync(join(game, 'assets', 'matterhorn', 'crate_v1', 'matterhorn-provenance.json'), 'utf8'));
    assert.equal(provenance.assetId, 'crate_v1');
    assert.throws(() => assets.sendToProject('crate_v1', 'missing'), /configured project/);
  } finally {
    await Promise.all([data, library, game].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })));
  }
});

test('Packs queue one style-matched job per item and failed builds are reported, not hidden', async () => {
  const data = await mkdtemp(join(tmpdir(), 'matterhorn-pack-data-'));
  const library = await mkdtemp(join(tmpdir(), 'matterhorn-pack-lib-'));
  const projects = [{ id: 'library', name: 'Asset Library', path: library }];
  const prompts: string[] = [];
  try {
    const assets = new FoundryAssetService(data, projects);
    const generation = new FoundryGenerationService(projects, assets, { providers: [fakeBlenderAgent(prompts)] });

    const jobs = generation.submitPack({
      projectId: 'library', packId: 'tavern', style: 'chunky low-poly, warm wood',
      kind: 'mesh_3d', operation: 'generate', providerId: 'blender-agent-local',
      items: [{ name: 'Barrel' }, { name: 'Round Table', prompt: 'round table with four legs' }],
    });
    assert.deepEqual(jobs.map((j) => j.assetId), ['tavern_barrel', 'tavern_round_table']);
    await waitFor(() => generation.listJobs().every((j) => j.status === 'succeeded'));
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every((p) => p.includes('chunky low-poly, warm wood')));
    assert.ok(prompts[1].startsWith('round table with four legs'));

    assert.throws(() => generation.submitPack({
      projectId: 'library', packId: 'x', style: 's', kind: 'mesh_3d', operation: 'generate', items: [],
    }), /between 1 and 12/);

    const failing = generation.submitJob({
      projectId: 'library', assetId: 'tavern_barrel', kind: 'mesh_3d', operation: 'generate', providerId: 'blender-agent-local',
    });
    await waitFor(() => generation.getJob(failing.jobId)?.status === 'failed');
    assert.match(generation.getJob(failing.jobId)!.error ?? '', /collide/);
    assert.ok(!existsSync(join(library, 'assets', 'generated', 'foundry', 'tavern_barrel', 'extra')));
  } finally {
    await Promise.all([data, library].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })));
  }
});

test('Builds can be cancelled and retried, history survives a restart, drafts and styles work', async () => {
  const data = await mkdtemp(join(tmpdir(), 'matterhorn-jobs-data-'));
  const library = await mkdtemp(join(tmpdir(), 'matterhorn-jobs-lib-'));
  const projects = [{ id: 'library', name: 'Asset Library', path: library }];
  const prompts: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const slow = fakeBlenderAgent(prompts);
  const slowProvider: FoundryAssetProvider = {
    descriptor: slow.descriptor,
    async execute(request, context) {
      if (request.assetId === 'blocker') {
        await Promise.race([gate, new Promise((_, reject) => context?.signal?.addEventListener('abort', () => reject(new Error('Cancelled.'))))]);
      }
      return slow.execute(request, context);
    },
  };
  try {
    const { FoundryStyleStore } = await import('../services/foundryStyles.js');
    const styles = new FoundryStyleStore(data);
    const style = styles.create({ name: 'Calle', description: 'Dominican street, warm pastel paint, weathered wood' });
    assert.throws(() => styles.create({ name: 'calle', description: 'dupe' }), /already exists/);

    const assets = new FoundryAssetService(data, projects);
    const generation = new FoundryGenerationService(projects, assets, { providers: [slowProvider], styles });
    const base = { projectId: 'library', kind: 'mesh_3d', operation: 'generate', providerId: 'blender-agent-local' };

    const blocker = generation.submitJob({ ...base, assetId: 'blocker', prompt: 'slow' });
    const queued = generation.submitJob({ ...base, assetId: 'queued_one', prompt: 'never runs' });
    await waitFor(() => generation.getJob(blocker.jobId)?.status === 'running');
    assert.equal(generation.cancelJob(queued.jobId).status, 'cancelled');
    generation.cancelJob(blocker.jobId);
    await waitFor(() => generation.getJob(blocker.jobId)?.status === 'cancelled');
    release();

    const retried = generation.retryJob(blocker.jobId);
    assert.equal(retried.assetId, 'blocker_r2');
    assert.equal(retried.retryOf, blocker.jobId);
    await waitFor(() => generation.getJob(retried.jobId)?.status === 'succeeded');

    const drafts = [1, 2].map((n) => generation.submitJob({
      ...base, assetId: `stall_d${n}`, prompt: 'market stall', displayName: 'Market stall', draftGroup: 'stall', styleId: style.id,
    }));
    await waitFor(() => drafts.every((d) => generation.getJob(d.jobId)?.status === 'succeeded'));
    assert.ok(prompts.at(-1)!.includes('Dominican street'), 'style text reaches the builder');
    assert.equal(assets.get('stall_d1')?.prompt, 'market stall', 'original description is kept for display');
    assert.equal(assets.get('stall_d1')?.displayName, 'Market stall');
    assets.keepDraft('stall_d2');
    assert.equal(assets.get('stall_d1')?.hidden, true);
    assert.equal(assets.get('stall_d2')?.hidden, undefined);
    assert.equal(assets.get('stall_d2')?.draftGroup, undefined);

    // A fresh service (as after a restart) sees the history, never resubmits, and keeps metadata.
    const running = generation.submitJob({ ...base, assetId: 'interrupted', prompt: 'x' });
    const reloaded = new FoundryGenerationService(projects, new FoundryAssetService(data, projects), { providers: [slowProvider], styles });
    const restored = reloaded.getJob(running.jobId);
    assert.ok(restored);
    assert.ok(restored.status === 'failed' || restored.status === 'succeeded');
    if (restored.status === 'failed') assert.match(restored.error ?? '', /restarted/);
    assert.equal(reloaded.getJob(queued.jobId)?.status, 'cancelled');
    assert.equal(new FoundryAssetService(data, projects).get('stall_d2')?.displayName, 'Market stall');
    assert.ok(!('input' in (reloaded.getJob(running.jobId) as object)), 'request body is not exposed');
  } finally {
    release();
    await Promise.all([data, library].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })));
  }
});

test('Library categories, bulk actions and a restorable Trash keep game files safe', async () => {
  const data = await mkdtemp(join(tmpdir(), 'matterhorn-trash-data-'));
  const game = await mkdtemp(join(tmpdir(), 'matterhorn-trash-game-'));
  try {
    const made = join(data, 'library', 'assets', 'generated', 'foundry');
    const file = async (path: string) => { await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, 'x'); return path; };
    const lamp = await file(join(made, 'street_lamp', 'street_lamp.glb'));
    const lampRender = await file(join(made, 'street_lamp', 'render_front.png'));
    const lampV2 = await file(join(made, 'street_lamp_v2', 'street_lamp_v2.glb'));
    const car = await file(join(game, 'assets', 'cars', 'sedan.glb'));
    const service = new FoundryAssetService(data, [{ id: 'library', name: 'Library', path: join(data, 'library') }, { id: 'yun', name: 'Yun', path: game }] as never);
    service.store.registerMany([
      { assetId: 'street_lamp', type: 'mesh_3d', generationProvider: 'blender-agent-local', createdAt: '2026-10-11T00:00:00Z', localPath: lamp, companionFiles: [lampRender] },
      { assetId: 'street_lamp_v2', type: 'mesh_3d', generationProvider: 'blender-agent-local', parentAsset: 'street_lamp', createdAt: '2026-10-11T00:00:00Z', localPath: lampV2 },
      { assetId: 'imp_yun_sedan', type: 'mesh_3d', generationProvider: 'imported', createdAt: '2026-10-11T00:00:00Z', localPath: car },
      { assetId: 'hero_kai', type: 'mesh_3d', generationProvider: 'blender-agent-local', createdAt: '2026-10-11T00:00:00Z' },
    ] as never);
    service.setMeta('hero_kai', { displayName: 'Kai mini character' });

    // Categories come from what things are, and the owner can move anything.
    assert.equal(service.get('imp_yun_sedan')?.category, 'vehicles');
    assert.equal(service.get('hero_kai')?.category, 'characters');
    assert.equal(service.get('street_lamp')?.category, 'props');
    service.bulk('category', ['street_lamp'], 'buildings');
    assert.equal(service.get('street_lamp')?.category, 'buildings');
    assert.equal(service.get('street_lamp')?.categorySetByOwner, true);
    service.bulk('category', ['street_lamp'], 'auto');
    assert.equal(service.get('street_lamp')?.category, 'props');

    // A parent cannot go without the versions made from it.
    assert.throws(() => service.bulk('delete', ['street_lamp']), /made from these/);

    // Deleting: made-in-Matterhorn files go to the Trash; game files are never touched.
    const result = service.bulk('delete', ['street_lamp', 'street_lamp_v2', 'imp_yun_sedan']);
    assert.deepEqual([...result.trashed].sort(), ['street_lamp', 'street_lamp_v2']);
    assert.deepEqual(result.removedFromLibrary, ['imp_yun_sedan']);
    assert.ok(!existsSync(lamp) && !existsSync(lampRender), 'made files left their folder');
    assert.ok(existsSync(car), 'the game file is still there');
    assert.equal(service.get('street_lamp'), undefined);
    assert.equal(service.get('imp_yun_sedan')?.hidden, true);
    assert.equal(service.trash().length, 2);

    // Restore puts files and asset back (the parent first).
    const entries = service.trash();
    const v2 = entries.find((e) => e.assetId === 'street_lamp_v2')!;
    assert.throws(() => service.restore(v2.trashId), /Restore "street_lamp" first/);
    service.restore(entries.find((e) => e.assetId === 'street_lamp')!.trashId);
    service.restore(v2.trashId);
    assert.ok(existsSync(lamp) && existsSync(lampRender) && existsSync(lampV2));
    assert.ok(service.get('street_lamp_v2'));
    service.bulk('show', ['imp_yun_sedan']);
    assert.equal(service.get('imp_yun_sedan')?.hidden, undefined);

    // Emptying the Trash is permanent and only removes what is in it.
    service.bulk('delete', ['hero_kai']);
    assert.equal(service.emptyTrash(), 1);
    assert.equal(service.trash().length, 0);
    assert.ok(existsSync(lamp) && existsSync(car));
  } finally {
    await Promise.all([data, game].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })));
  }
});
