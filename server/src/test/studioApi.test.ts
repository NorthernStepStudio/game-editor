import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { getServerConfig } from '../config/env.js';
import { startNssWorkspaceAiServer } from '../server.js';

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

let testDataDir = '';
let previousDataDir: string | undefined;
let previousFlyrailUrl: string | undefined;
let previousFlyrailToken: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.MATTERHORN_DATA_DIR;
  testDataDir = await mkdtemp(join(tmpdir(), 'matterhorn-data-'));
  process.env.MATTERHORN_DATA_DIR = testDataDir;
  // Deterministic API tests must never reach a live Flyrail daemon running on this PC.
  previousFlyrailUrl = process.env.FLYRAIL_DAEMON_URL;
  previousFlyrailToken = process.env.FLYRAIL_DAEMON_TOKEN;
  process.env.FLYRAIL_DAEMON_URL = 'ws://127.0.0.1:9';
  process.env.FLYRAIL_DAEMON_TOKEN = 'test-isolated';
});

afterEach(async () => {
  if (previousDataDir === undefined) delete process.env.MATTERHORN_DATA_DIR;
  else process.env.MATTERHORN_DATA_DIR = previousDataDir;
  if (previousFlyrailUrl === undefined) delete process.env.FLYRAIL_DAEMON_URL;
  else process.env.FLYRAIL_DAEMON_URL = previousFlyrailUrl;
  if (previousFlyrailToken === undefined) delete process.env.FLYRAIL_DAEMON_TOKEN;
  else process.env.FLYRAIL_DAEMON_TOKEN = previousFlyrailToken;
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
    assert.deepEqual(await (await fetch(base + '/api/studio/runs')).json(), []);
    const runtime = await readJson<Array<{ capability: string; title: string; state: string }>>(
      await fetch(base + '/api/studio/runtime'),
    );
    const browser = runtime.find(item => item.capability === 'browser-control');
    assert.equal(browser?.title, 'Local browser');
    assert.ok(['ready', 'degraded', 'unavailable'].includes(browser?.state ?? ''));
    assert(!JSON.stringify(runtime).includes('Browser Harness'));
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

      const automaticCriteria = await fetch(base + '/api/studio/plan', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ goal: 'Validate the disposable project', projectId: 'demo', criteria: [] }),
      });
      assert.equal(automaticCriteria.status, 200);
      const automaticPlan = await readJson<{ finalAcceptanceCriteria: string[] }>(automaticCriteria);
      assert.deepEqual(automaticPlan.finalAcceptanceCriteria, [
        'Godot validation passes',
        'Scenario checks pass',
        'QA checks pass',
      ]);

      const agents = await readJson<Array<{ id: string; kind: string }>>(await fetch(base + '/api/studio/agents'));
      assert.equal(agents.find(agent => agent.id === 'matterhorn')?.kind, 'orchestrator');
      assert.equal(agents.find(agent => agent.id === 'sentinel')?.kind, 'validator');

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
      const plan = await readJson<{ tasks: Array<{ domain: string; specialistId: string }> }>(planResponse);
      assert.equal(plan.tasks.length, 2);
      assert.deepEqual(plan.tasks.map(task => task.specialistId), ['flyrail', 'matterhorn']);
      assert.deepEqual(plan.tasks.map(task => task.domain), ['godot', 'qa']);

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
      const queue = await readJson<Array<{ runId: string; position: number }>>(await fetch(base + '/api/studio/queue'));
      assert.ok(Array.isArray(queue));

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
          goal: 'Second overlapping run should queue safely while first is active',
          projectId: 'demo',
          criteria: ['Godot validation passes'],
        }),
      });
      assert.equal(second.status, 202);
      const secondRun = await readJson<{ status: string }>(second);
      assert.notEqual(secondRun.status, 'completed');
    } finally {
      await app.close();
    }
  } finally {
    if (previousProjects === undefined) delete process.env.MATTERHORN_PROJECTS;
    else process.env.MATTERHORN_PROJECTS = previousProjects;
    await rm(projectRoot, { recursive: true, force: true });
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


test('promotion approval is explicit and survives a standalone server restart', async () => {
  const runsDir = join(testDataDir, 'studio-runs');
  await mkdir(runsDir, { recursive: true });
  const createdAt = '2026-10-03T18:00:00.000Z';
  const completedRun = {
    id: 'promotion-run',
    status: 'completed',
    createdAt,
    updatedAt: '2026-10-03T18:10:00.000Z',
    detail: 'All task and final acceptance checks passed.',
    plan: {
      id: 'promotion-plan',
      goal: 'Verified release candidate',
      createdAt,
      tasks: [{
        id: 'work',
        title: 'Implement',
        goal: 'Implement and verify',
        domain: 'godot',
        specialistId: 'flyrail',
        status: 'planned',
        dependsOn: [],
        acceptanceCriteria: ['Godot validation passes'],
      }],
      finalAcceptanceCriteria: ['Godot validation passes'],
    },
    tasks: [{
      id: 'work',
      executionId: 'promotion-run-work',
      status: 'completed',
      startedAt: '2026-10-03T18:01:00.000Z',
      finishedAt: '2026-10-03T18:09:00.000Z',
      detail: 'Accepted by Sentinel.',
      result: {
        taskId: 'promotion-run-work',
        specialistId: 'flyrail',
        status: 'completed',
        summary: 'Verified',
        criterionResults: [{
          criterionId: 'criterion-1',
          criterion: 'Godot validation passes',
          outcome: 'passed',
          executionId: 'promotion-run-work',
        }],
      },
    }],
  };
  await writeFile(join(runsDir, 'promotion-run.json'), JSON.stringify(completedRun), 'utf8');

  const jsonHeaders = { 'Content-Type': 'application/json' };
  const first = await startNssWorkspaceAiServer(
    { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
    { portStateFilePath: false },
  );
  try {
    const base = `http://127.0.0.1:${first.port}`;
    const initial = await readJson<{ state: string; eligible: boolean }>(
      await fetch(base + '/api/studio/runs/promotion-run/promotion'),
    );
    assert.equal(initial.state, 'approval-required');
    assert.equal(initial.eligible, true);

    const bad = await fetch(base + '/api/studio/runs/promotion-run/promotion/approve', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ confirmation: 'yes' }),
    });
    assert.equal(bad.status, 400);

    const approved = await readJson<{ runId: string; runSnapshotHash: string }>(
      await fetch(base + '/api/studio/runs/promotion-run/promotion/approve', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ confirmation: 'APPROVE', note: 'Human-reviewed release candidate.' }),
      }),
    );
    assert.equal(approved.runId, 'promotion-run');
    assert.match(approved.runSnapshotHash, /^[0-9a-f]{64}$/);

    const status = await readJson<{ state: string }>(
      await fetch(base + '/api/studio/runs/promotion-run/promotion'),
    );
    assert.equal(status.state, 'approved');
  } finally {
    await first.close();
  }

  const second = await startNssWorkspaceAiServer(
    { port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } },
    { portStateFilePath: false },
  );
  try {
    const base = `http://127.0.0.1:${second.port}`;
    const recovered = await readJson<{ state: string }>(
      await fetch(base + '/api/studio/runs/promotion-run/promotion'),
    );
    assert.equal(recovered.state, 'approved');

    const revoked = await readJson<{ state: string }>(
      await fetch(base + '/api/studio/runs/promotion-run/promotion/revoke', {
        method: 'POST',
        headers: jsonHeaders,
        body: '{}',
      }),
    );
    assert.equal(revoked.state, 'approval-required');
  } finally {
    await second.close();
  }
});
