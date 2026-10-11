import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isAssetQuestion, searchAssets } from '../services/assistant.js';

const asset = (assetId: string, displayName: string, type: string, source?: string) => ({ assetId, displayName, type, createdAt: '2026-10-01T00:00:00Z', ...(source ? { source } : {}) });
const library = [
  asset('a1', 'V02 structure r6 motorconcho', 'mesh_3d', 'Environment · kit'),
  asset('a2', 'V02 structure r8 controls', 'mesh_3d', 'Environment · kit'),
  asset('a3', 'Colmado awning', 'mesh_3d', 'Yun game · environment'),
  asset('a4', 'Jump', 'audio_sfx', 'Yun game · sfx'),
  asset('a5', 'Menu theme', 'audio_music', 'Yun game · music'),
  asset('a6', 'Hidden thing', 'mesh_3d'),
].map((a, i) => (i === 5 ? { ...a, hidden: true } : a));

test('the chat answers asset questions from the real library', () => {
  assert.ok(isAssetQuestion('can you show me the assets we still have in v02?'));
  assert.ok(isAssetQuestion('show me the assets'));
  assert.ok(!isAssetQuestion('how do I add a new game?'));

  const v02 = searchAssets('can you show me the assets we still have in v02?', library, ['Yun']);
  assert.equal(v02.answeredBy, 'library');
  assert.deepEqual(v02.assets?.shown.map((a) => a.assetId), ['a1', 'a2']);
  assert.equal(v02.assets?.openHash, '#assets/search/v02/all');

  const all = searchAssets('show me the assets', library, ['Yun']);
  assert.equal(all.assets?.total, 5, 'no name means everything (hidden assets excluded)');
  assert.match(all.reply, /everything in your library: 5/);

  const sounds = searchAssets('show the sounds in Yun', library, ['Yun']);
  assert.deepEqual(sounds.assets?.shown.map((a) => a.name).sort(), ['Jump', 'Menu theme']);
  assert.equal(sounds.assets?.openHash, '#assets/search/Yun/audio');

  const none = searchAssets('show me assets called dragon', library, ['Yun']);
  assert.equal(none.assets?.total, 0);
  assert.match(none.reply, /found no/);
});
