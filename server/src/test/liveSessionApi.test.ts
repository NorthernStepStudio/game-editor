import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { startNssWorkspaceAiServer } from '../server.js';

let testDataDir = '';
let previousDataDir: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.MATTERHORN_DATA_DIR;
  testDataDir = await mkdtemp(join(tmpdir(), 'm-live-api-'));
  process.env.MATTERHORN_DATA_DIR = testDataDir;
});

afterEach(async () => {
  if (previousDataDir === undefined) delete process.env.MATTERHORN_DATA_DIR;
  else process.env.MATTERHORN_DATA_DIR = previousDataDir;
  await rm(testDataDir, { recursive: true, force: true });
});

test('LiveSession API provides characters list, session control and SSE events', async () => {
  const app = await startNssWorkspaceAiServer(
    { port: 0 },
    { portStateFilePath: false },
  );

  try {
    const origin = `http://127.0.0.1:${app.port}`;

    // 1. GET /api/characters
    const charRes = await fetch(`${origin}/api/characters`);
    assert.equal(charRes.status, 200);
    const charData = (await charRes.json()) as any;
    assert.equal(charData.characters[0].assetId, 'yun_urban_adventurer');
    assert.equal(charData.tombstones.length >= 2, true);

    // 2. GET /api/characters/yun_urban_adventurer
    const singleCharRes = await fetch(`${origin}/api/characters/yun_urban_adventurer`);
    assert.equal(singleCharRes.status, 200);
    const singleCharData = (await singleCharRes.json()) as any;
    assert.equal(singleCharData.character.assetId, 'yun_urban_adventurer');
    assert.ok(singleCharData.character.referenceImages.front);

    // 3. GET /api/live-sessions
    const listRes = await fetch(`${origin}/api/live-sessions`);
    assert.equal(listRes.status, 200);
    const listData = (await listRes.json()) as any;
    assert.ok(listData.sessions.length >= 1);
    const defaultSessionId = listData.sessions[0].sessionId;

    // 4. POST /api/live-sessions/:id/pause
    const pauseRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(pauseRes.status, 200);
    const pauseData = (await pauseRes.json()) as any;
    assert.equal(pauseData.session.status, 'paused');

    // 5. POST /api/live-sessions/:id/correct
    const correctRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback: 'Shoulders slightly too wide. Reduce jacket volume by 15%.',
        region: 'shoulders',
      }),
    });
    assert.equal(correctRes.status, 200);
    const correctData = (await correctRes.json()) as any;
    assert.equal(correctData.session.status, 'waiting-for-review');
    assert.match(correctData.session.characterRevision, /mesh-v/);

    // 6. POST /api/live-sessions/:id/revert
    const revertRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revisionId: 'mesh-v12',
      }),
    });
    assert.equal(revertRes.status, 200);
    const revertData = (await revertRes.json()) as any;
    assert.equal(revertData.session.characterRevision, 'mesh-v12');

    // 7. POST /api/live-sessions/:id/approve
    const approveRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Approved silhouette for rigging' }),
    });
    assert.equal(approveRes.status, 200);

    // 8. POST /api/live-sessions/:id/part
    const partRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/part`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId: 'head' }),
    });
    assert.equal(partRes.status, 200);
    const partData = (await partRes.json()) as any;
    assert.equal(partData.session.activePart, 'head');

    // 9. POST /api/live-sessions/:id/approve-part
    const approvePartRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/approve-part`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Head & Face passed review' }),
    });
    assert.equal(approvePartRes.status, 200);
    const approvePartData = (await approvePartRes.json()) as any;
    assert.equal(approvePartData.session.activePart, 'torso');

    // 10. Test SSE stream: /api/live-sessions/:id/events
    const controller = new AbortController();
    const eventRes = await fetch(`${origin}/api/live-sessions/${defaultSessionId}/events`, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' },
    });
    assert.equal(eventRes.status, 200);
    assert.match(eventRes.headers.get('content-type') ?? '', /text\/event-stream/);
    controller.abort();
    await new Promise(resolve => setTimeout(resolve, 50));
  } finally {
    await app.close();
  }
});
