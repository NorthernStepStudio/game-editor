import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { getServerConfig } from '../config/env.js';
import { startNssWorkspaceAiServer } from '../server.js';
import { FoundryAssetStore } from '../services/foundryAssetStore.js';

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

let testDataDir = '';
let previousDataDir: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.MATTERHORN_DATA_DIR;
  testDataDir = await mkdtemp(join(tmpdir(), 'matterhorn-data-'));
  process.env.MATTERHORN_DATA_DIR = testDataDir;
});

afterEach(async () => {
  if (previousDataDir === undefined) delete process.env.MATTERHORN_DATA_DIR;
  else process.env.MATTERHORN_DATA_DIR = previousDataDir;
  await rm(testDataDir, { recursive: true, force: true });
});

test('default provider without credentials is honest mock mode', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const emptyDir = await mkdtemp(join(tmpdir(), 'matterhorn-env-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(emptyDir);
    const config = getServerConfig({ PATH: process.env.PATH } as NodeJS.ProcessEnv);
    assert.equal(config.mCore.providerMode, 'mock');
    const withMock = getServerConfig({
      PATH: process.env.PATH,
      M_CORE_PROVIDER_MODE: 'mock',
    } as NodeJS.ProcessEnv);
    assert.equal(withMock.mCore.providerMode, 'mock');
  } finally {
    process.chdir(previousCwd);
    await rm(emptyDir, { recursive: true, force: true });
  }
});

test('standalone APIs enforce local origin, body limits and static boundaries', async () => {
  const app = await startNssWorkspaceAiServer(
    { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
    { portStateFilePath: false },
  );
  const base = `http://127.0.0.1:${app.port}`;
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/api/projects')).status, 200);
    const specialists = await readJson<Array<{ id: string; availability: string }>>(
      await fetch(base + '/api/studio/specialists'),
    );
    assert.deepEqual(
      specialists.map((specialist) => specialist.id),
      ['matterhorn', 'flyrail', 'blender-engine'],
    );
    assert(specialists.every((specialist) => specialist.availability === 'available'));
    assert(!JSON.stringify(specialists).includes('apiKey'));
    const routingDefaults = await readJson<{
      game: string;
      threeD: string;
      assets: string;
      localFirst: boolean;
      requireCommercialUse: boolean;
      allowNetworkProviders: boolean;
      allowExternalCostProviders: boolean;
    }>(await fetch(base + '/api/studio/routing'));
    assert.deepEqual(
      {
        game: routingDefaults.game,
        threeD: routingDefaults.threeD,
        assets: routingDefaults.assets,
        localFirst: routingDefaults.localFirst,
        requireCommercialUse: routingDefaults.requireCommercialUse,
        allowNetworkProviders: routingDefaults.allowNetworkProviders,
        allowExternalCostProviders: routingDefaults.allowExternalCostProviders,
      },
      {
        game: 'auto',
        threeD: 'auto',
        assets: 'auto',
        localFirst: true,
        requireCommercialUse: true,
        allowNetworkProviders: false,
        allowExternalCostProviders: false,
      },
    );

    const updatedRouting = await readJson<{
      game: string;
      threeD: string;
      assets: string;
      requireCommercialUse: boolean;
      allowNetworkProviders: boolean;
      allowExternalCostProviders: boolean;
    }>(
      await fetch(base + '/api/studio/routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'flyrail',
          threeD: 'blender-engine',
          assets: 'comfyui-local',
          localFirst: true,
          requireCommercialUse: false,
          allowNetworkProviders: true,
          allowExternalCostProviders: false,
        }),
      }),
    );
    assert.equal(updatedRouting.game, 'flyrail');
    assert.equal(updatedRouting.threeD, 'blender-engine');
    assert.equal(updatedRouting.assets, 'comfyui-local');
    assert.equal(updatedRouting.requireCommercialUse, false);
    assert.equal(updatedRouting.allowNetworkProviders, true);
    assert.equal(updatedRouting.allowExternalCostProviders, false);

    assert.equal(
      (
        await fetch(base + '/api/studio/routing', {
          method: 'PUT',
          body: JSON.stringify({ assets: 'sprite-fusion' }),
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await fetch(base + '/api/studio/routing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: 'unknown-provider' }),
        })
      ).status,
      400,
    );
    assert.deepEqual(await (await fetch(base + '/api/studio/runs')).json(), []);
    assert.equal((await fetch(base + '/api/studio/runs/missing')).status, 404);
    assert.equal((await fetch(base + '/api/studio/runs', { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(base + '/api/studio/runs', { method: 'POST', body: '{}' })).status, 415);
    assert.equal(
      (
        await fetch(base + '/api/studio/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: 'Hello', projectId: 'unknown', criteria: ['Works'] }),
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base + '/api/studio/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(70000) }))
        .status,
      400,
    );
    assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
    const page = await fetch(base + '/');
    assert(page.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    assert(!page.headers.has('access-control-allow-origin'));
    const health = await readJson<{ mode: string }>(await fetch(base + '/health'));
    assert.equal(health.mode, 'mock');
    const providers = await readJson<{ current: string; providers: Array<{ id: string }> }>(await fetch(base + '/providers'));
    assert.equal(providers.current, 'mock');
    assert(providers.providers.some((p) => p.id === 'mock'));
    assert(!JSON.stringify(providers).includes('apiKey'));
    const foundryProvidersResponse = await fetch(base + '/api/foundry/providers');
    assert.equal(foundryProvidersResponse.status, 200);
    const foundryProvidersText = await foundryProvidersResponse.text();
    const foundryProviders = JSON.parse(foundryProvidersText) as {
      providers: Array<{ id: string; available: boolean; estimatedCost?: { amount: number; currency: string } }>;
    };
    assert(foundryProviders.providers.some((provider) => provider.id === 'sprite-fusion'));
    assert(foundryProviders.providers.some((provider) => provider.id === 'comfyui-local'));
    assert(!foundryProvidersText.includes('apiKey'));
    assert(!foundryProvidersText.includes('SPRITE_FUSION_API_KEY'));
    assert(!foundryProvidersText.includes('localPath'));
  } finally {
    await app.close();
  }
});

test('studio plan/run APIs reject malformed bodies and support cancel + events', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'matterhorn-api-'));
  const previousProjects = process.env.MATTERHORN_PROJECTS;
  try {
    await writeFile(join(projectRoot, 'project.godot'), '; stub\n', 'utf8');
    process.env.MATTERHORN_PROJECTS = JSON.stringify([
      { id: 'demo', name: 'Demo Game', path: projectRoot },
    ]);

    const app = await startNssWorkspaceAiServer(
      { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
      { portStateFilePath: false },
    );
    const base = `http://127.0.0.1:${app.port}`;
    const jsonHeaders = { 'Content-Type': 'application/json' };

    try {
      const badGoal = await fetch(base + '/api/studio/plan', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ goal: 'no', projectId: 'demo', criteria: ['Godot validation passes'] }),
      });
      assert.equal(badGoal.status, 400);

      const badCriteria = await fetch(base + '/api/studio/plan', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ goal: 'Validate the disposable project', projectId: 'demo', criteria: [] }),
      });
      assert.equal(badCriteria.status, 400);

      const unknownProject = await fetch(base + '/api/studio/plan', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          goal: 'Validate the disposable project',
          projectId: 'missing',
          criteria: ['Godot validation passes'],
        }),
      });
      assert.equal(unknownProject.status, 400);

      const planResponse = await fetch(base + '/api/studio/plan', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          goal: 'Validate the disposable project',
          projectId: 'demo',
          criteria: ['Godot validation passes', 'Scenario checks pass', 'QA checks pass'],
        }),
      });
      assert.equal(planResponse.status, 200);
      const plan = await readJson<{ tasks: Array<{ domain: string }> }>(planResponse);
      assert.equal(plan.tasks.length, 1);
      assert.equal(plan.tasks[0].domain, 'godot');

      const create = await fetch(base + '/api/studio/runs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          goal: 'Validate the disposable project',
          projectId: 'demo',
          criteria: ['Godot validation passes', 'Scenario checks pass', 'QA checks pass'],
        }),
      });
      assert.equal(create.status, 202);
      const run = await readJson<{ id: string; createdAt: string; status: string }>(create);
      assert.ok(run.id);
      assert.ok(run.createdAt);
      assert.notEqual(run.status, 'completed');

      const listed = await readJson<Array<{ id: string }>>(await fetch(base + '/api/studio/runs'));
      assert.equal(listed.length, 1);
      assert.equal(listed[0].id, run.id);

      const detail = await readJson<{ id: string }>(await fetch(base + `/api/studio/runs/${run.id}`));
      assert.equal(detail.id, run.id);

      const cancel = await fetch(base + `/api/studio/runs/${run.id}/cancel`, { method: 'POST', headers: jsonHeaders, body: '{}' });
      assert.equal(cancel.status, 202);
      const cancelled = await readJson<{ status: string }>(cancel);
      assert.ok(['cancel-requested', 'cancelled', 'failed', 'blocked', 'running', 'queued'].includes(cancelled.status));

      const events = await fetch(base + `/api/studio/runs/${run.id}/events`);
      assert.equal(events.status, 200);
      assert.equal(events.headers.get('content-type')?.startsWith('text/event-stream'), true);
      events.body?.cancel();

      const evidence = await readJson<{ runId: string; tasks: unknown[] }>(await fetch(base + `/api/studio/runs/${run.id}/evidence`));
      assert.equal(evidence.runId, run.id);
      assert.ok(Array.isArray(evidence.tasks));

      const second = await fetch(base + '/api/studio/runs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          goal: 'Second overlapping run must be rejected while first is active',
          projectId: 'demo',
          criteria: ['Godot validation passes'],
        }),
      });
      // Either rejected for concurrency or accepted if first already terminal; never invent completed.
      if (second.status === 202) {
        const secondRun = await readJson<{ status: string }>(second);
        assert.notEqual(secondRun.status, 'completed');
      } else {
        assert.equal(second.status, 400);
      }
    } finally {
      await app.close();
    }
  } finally {
    if (previousProjects === undefined) delete process.env.MATTERHORN_PROJECTS;
    else process.env.MATTERHORN_PROJECTS = previousProjects;
    await rm(projectRoot, { recursive: true, force: true });
  }
});


test('Foundry asset browser exposes sanitized lineage and safe local previews', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-project-'));
  const outsideRoot = await mkdtemp(join(tmpdir(), 'matterhorn-foundry-outside-'));
  const previousProjects = process.env.MATTERHORN_PROJECTS;
  try {
    await writeFile(join(projectRoot, 'project.godot'), '; stub\n', 'utf8');
    const previewPath = join(projectRoot, 'hero.png');
    const previewBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    await writeFile(previewPath, previewBytes);
    const outsidePath = join(outsideRoot, 'secret.png');
    await writeFile(outsidePath, Buffer.from([1, 2, 3, 4]));

    process.env.MATTERHORN_PROJECTS = JSON.stringify([
      { id: 'demo', name: 'Demo Game', path: projectRoot },
    ]);

    const assets = new FoundryAssetStore(testDataDir);
    assets.registerMany([
      {
        assetId: 'hero-base',
        type: 'pixel_sprite',
        operation: 'generate',
        sourceIds: ['provider:sprite-fusion'],
        sourceLicenseIds: ['Provider commercial license'],
        generationProvider: 'sprite-fusion',
        providerAssetId: 'remote-hero',
        sourceUrl: 'https://provider.example/private?token=do-not-expose',
        createdAt: '2026-09-25T10:00:00.000Z',
        contentHash: 'abc123',
        localPath: previewPath,
        width: 32,
        height: 32,
      },
      {
        assetId: 'hero-run',
        type: 'sprite_sheet',
        operation: 'animate',
        sourceIds: ['provider:sprite-fusion'],
        sourceLicenseIds: ['Provider commercial license'],
        generationProvider: 'sprite-fusion',
        createdAt: '2026-09-25T10:01:00.000Z',
        parentAsset: 'hero-base',
        referenceAssets: ['hero-base'],
      },
      {
        assetId: 'outside',
        type: 'concept_art',
        sourceIds: ['provider:test'],
        createdAt: '2026-09-25T10:02:00.000Z',
        localPath: outsidePath,
      },
    ]);

    const app = await startNssWorkspaceAiServer(
      { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
      { portStateFilePath: false },
    );
    const base = `http://127.0.0.1:${app.port}`;

    try {
      const listResponse = await fetch(base + '/api/foundry/assets');
      assert.equal(listResponse.status, 200);
      const listText = await listResponse.text();
      const list = JSON.parse(listText) as {
        assets: Array<{ assetId: string; previewUrl?: string }>;
        count: number;
      };
      assert.equal(list.count, 3);
      assert.equal(
        list.assets.find((asset) => asset.assetId === 'hero-base')?.previewUrl,
        '/api/foundry/assets/hero-base/preview',
      );
      assert.equal(
        list.assets.find((asset) => asset.assetId === 'outside')?.previewUrl,
        undefined,
      );
      assert(!listText.includes(projectRoot));
      assert(!listText.includes(outsideRoot));
      assert(!listText.includes('do-not-expose'));
      assert(!listText.includes('localPath'));
      assert(!listText.includes('sourceUrl'));

      const detail = await readJson<{
        asset: { assetId: string };
        lineage: Array<{ assetId: string }>;
      }>(await fetch(base + '/api/foundry/assets/hero-run'));
      assert.equal(detail.asset.assetId, 'hero-run');
      assert.deepEqual(
        detail.lineage.map((asset) => asset.assetId),
        ['hero-base', 'hero-run'],
      );

      const lineage = await readJson<{
        lineage: Array<{ assetId: string }>;
      }>(await fetch(base + '/api/foundry/assets/hero-run/lineage'));
      assert.deepEqual(
        lineage.lineage.map((asset) => asset.assetId),
        ['hero-base', 'hero-run'],
      );

      const preview = await fetch(base + '/api/foundry/assets/hero-base/preview');
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get('content-type'), 'image/png');
      assert.deepEqual(
        [...new Uint8Array(await preview.arrayBuffer())],
        [...previewBytes],
      );

      assert.equal(
        (await fetch(base + '/api/foundry/assets/outside/preview')).status,
        404,
      );

      assert.equal(
        (
          await fetch(base + '/api/foundry/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
        405,
      );
    } finally {
      await app.close();
    }
  } finally {
    if (previousProjects === undefined) delete process.env.MATTERHORN_PROJECTS;
    else process.env.MATTERHORN_PROJECTS = previousProjects;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test('projects without project.godot are rejected at plan time', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'matterhorn-nogodot-'));
  const previousProjects = process.env.MATTERHORN_PROJECTS;
  try {
    await mkdir(join(projectRoot, 'empty'), { recursive: true });
    process.env.MATTERHORN_PROJECTS = JSON.stringify([
      { id: 'broken', name: 'Broken', path: join(projectRoot, 'empty') },
    ]);
    const app = await startNssWorkspaceAiServer(
      { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
      { portStateFilePath: false },
    );
    try {
      const response = await fetch(`http://127.0.0.1:${app.port}/api/studio/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: 'Should fail without Godot project',
          projectId: 'broken',
          criteria: ['Godot validation passes'],
        }),
      });
      assert.equal(response.status, 400);
    } finally {
      await app.close();
    }
  } finally {
    if (previousProjects === undefined) delete process.env.MATTERHORN_PROJECTS;
    else process.env.MATTERHORN_PROJECTS = previousProjects;
    await rm(projectRoot, { recursive: true, force: true });
  }
});
