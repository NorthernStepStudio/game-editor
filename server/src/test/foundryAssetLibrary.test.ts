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
    await Promise.all([data, library, game].map((dir) => rm(dir, { recursive: true, force: true })));
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
    await Promise.all([data, library].map((dir) => rm(dir, { recursive: true, force: true })));
  }
});
