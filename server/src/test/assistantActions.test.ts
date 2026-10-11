import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { decideAction, runAction } from '../services/assistantActions.js';
import type { StudioService } from '../services/studioService.js';

function fakeService(routed?: Record<string, unknown>) {
  const submitted: Record<string, unknown>[] = [];
  const retried: { jobId: string; providerId?: unknown }[] = [];
  let routing = { assets: 'auto', allowNetworkProviders: false };
  let jsonCalls = 0;
  const assets = [
    { assetId: 'imp_lamp_ab12', displayName: 'Street lamp', type: 'mesh_3d', createdAt: 'x' },
    { assetId: 'imp_lamp_ab12_v2', displayName: 'Street lamp (v2)', type: 'mesh_3d', createdAt: 'x' },
    { assetId: 'jump', displayName: 'Jump', type: 'audio_sfx', createdAt: 'x' },
  ];
  const service = {
    projects: [{ id: 'yun', name: 'Yun', path: 'D:/games/Yun' }],
    foundryAssets: {
      get: (id: string) => assets.find((a) => a.assetId === id),
      list: () => assets,
    },
    foundryGeneration: {
      providers: () => [
        { id: 'blender-agent-claude', available: true, requiresNetwork: true },
        { id: 'blender-agent-local', available: true, requiresNetwork: false },
      ],
      submitJob: (body: Record<string, unknown>) => { submitted.push(body); return { jobId: 'j1', assetId: body.assetId }; },
      listJobs: () => [
        { jobId: 'f2', assetId: 'old', status: 'failed', displayName: 'Old' },
        { jobId: 'f1', assetId: 'barrel', status: 'failed', displayName: 'Barrel', retryOf: undefined },
      ],
      retryJob: (jobId: string, o: { providerId?: unknown }) => { retried.push({ jobId, providerId: o.providerId }); return { jobId: 'r1', assetId: 'barrel_r2' }; },
    },
    routingPreferences: {
      get: () => routing,
      update: (patch: Record<string, unknown>) => { routing = { ...routing, ...patch }; return routing; },
    },
    ai: { json: async () => { jsonCalls += 1; return routed; } },
    plan: async (payload: { goal: string }) => ({ goal: payload.goal, tasks: [{ title: 'Build in Godot' }, { title: 'Verify' }] }),
  } as unknown as StudioService;
  return { service, submitted, retried, routing: () => routing, jsonCalls: () => jsonCalls };
}

test('chat changes the asset you are looking at, with Claude when asked, as a new version', async () => {
  const fake = fakeService();
  const action = await decideAction('make it taller and paint it red with Claude', { kind: 'asset', id: 'imp_lamp_ab12_v2' }, fake.service);
  assert.equal(action.action, 'change_asset');
  assert.equal(fake.jsonCalls(), 0, 'clear requests do not need the model');
  const reply = await runAction(action as Exclude<typeof action, { action: 'answer' }>, fake.service);
  assert.equal(fake.submitted[0].parentAsset, 'imp_lamp_ab12_v2');
  assert.equal(fake.submitted[0].operation, 'edit');
  assert.equal(fake.submitted[0].assetId, 'imp_lamp_ab12_v3', 'next free version');
  assert.equal(fake.submitted[0].providerId, 'blender-agent-claude');
  assert.equal(fake.routing().allowNetworkProviders, true, 'asking for Claude by name allows online AI');
  assert.match(reply.reply, /version 3/);
  assert.equal(reply.job?.assetId, 'imp_lamp_ab12_v3');
});

test('chat builds new assets, retries failed ones, and plans game changes for approval', async () => {
  const make = fakeService({ action: 'make_asset', description: 'a wooden barrel with iron bands', name: 'Barrel' });
  const action = await decideAction('make a wooden barrel', {}, make.service);
  assert.equal(action.action, 'make_asset');
  await runAction(action as Exclude<typeof action, { action: 'answer' }>, make.service);
  assert.equal(make.submitted[0].prompt, 'a wooden barrel with iron bands');
  assert.equal(make.submitted[0].providerId, 'blender-agent-local', 'default builder is local first');

  const retry = fakeService();
  const again = await decideAction('try again with Claude', {}, retry.service);
  assert.equal(again.action, 'retry_build');
  await runAction(again as Exclude<typeof again, { action: 'answer' }>, retry.service);
  assert.deepEqual(retry.retried[0], { jobId: 'f2', providerId: 'blender-agent-claude' });

  const game = fakeService({ action: 'plan_game_change', goal: 'add a 3 minute match timer' });
  const planned = await decideAction('add a 3 minute match timer', {}, game.service);
  const reply = await runAction(planned as Exclude<typeof planned, { action: 'answer' }>, game.service);
  assert.deepEqual(reply.plan?.tasks, ['Build in Godot', 'Verify']);
  assert.match(reply.reply, /Nothing changes until you approve/);

  const sound = fakeService();
  const soundAction = await decideAction('make it louder', { kind: 'asset', id: 'jump' }, sound.service);
  const soundReply = await runAction(soundAction as Exclude<typeof soundAction, { action: 'answer' }>, sound.service);
  assert.match(soundReply.reply, /can change 3D models/);
  assert.equal(sound.submitted.length, 0);
});
