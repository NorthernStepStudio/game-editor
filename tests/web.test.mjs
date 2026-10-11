import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// ── Fixture API ─────────────────────────────────────────────────────
const yunArtifact = [{ kind: 'godot-project', uri: 'D:/games/Yun', label: 'Yun' }];
const runs = [
  {
    id: 'run-done', status: 'completed', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T10:20:00Z',
    plan: { goal: 'Make difficulty stars brighter', finalAcceptanceCriteria: ['Stars visible'],
      tasks: [{ id: 'build', title: 'Build in Flyrail', specialistId: 'flyrail', inputArtifacts: yunArtifact, acceptanceCriteria: ['Stars visible'] },
        { id: 'qa', title: 'Verify', specialistId: 'matterhorn', inputArtifacts: [], acceptanceCriteria: ['Stars visible'] }] },
    tasks: [
      { id: 'build', status: 'completed', result: { summary: 'Stars are now gold with an outline.', artifacts: [{ kind: 'file', uri: 'ui/difficulty.tscn' }],
        evidence: [{ kind: 'screenshot', summary: 'Menu screenshot', outcome: 'passed' }],
        criterionResults: [{ description: 'Stars visible', outcome: 'passed' }] } },
      { id: 'qa', status: 'completed' },
    ],
  },
  {
    id: 'run-active', status: 'running', createdAt: '2026-10-11T09:00:00Z', updatedAt: '2026-10-11T09:01:00Z',
    plan: { goal: 'Add a match timer', finalAcceptanceCriteria: [], tasks: [{ id: 'build', title: 'Build', specialistId: 'flyrail', inputArtifacts: yunArtifact, acceptanceCriteria: [] }] },
    tasks: [{ id: 'build', status: 'running' }],
  },
  {
    id: 'run-failed', status: 'failed', detail: 'Godot validation failed', createdAt: '2026-10-09T09:00:00Z', updatedAt: '2026-10-09T09:05:00Z',
    plan: { goal: 'Speed up enemies', finalAcceptanceCriteria: ['Enemies faster'], tasks: [{ id: 'build', title: 'Build', specialistId: 'flyrail', inputArtifacts: yunArtifact, acceptanceCriteria: [] }] },
    tasks: [{ id: 'build', status: 'failed', detail: 'Script error in enemy.gd' }],
  },
];
const file = (asset, name, role) => ({ name, role, url: `/api/foundry/assets/${asset}/files/${name}` });
const assets = [
  { assetId: 'crate_ab12', type: 'mesh_3d', displayName: 'Wooden crate', prompt: 'a sturdy wooden crate', generationProvider: 'blender-agent-local', model: 'Ollama:gemma4:12b',
    createdAt: '2026-10-10T08:00:00Z', previewUrl: '/api/foundry/assets/crate_ab12/preview',
    files: [file('crate_ab12', 'crate_ab12.glb', 'main'), file('crate_ab12', 'crate_ab12.blend', 'source'), file('crate_ab12', 'crate_ab12_script.py', 'script'),
      file('crate_ab12', 'render_front.png', 'render'), file('crate_ab12', 'render_three_quarter.png', 'render')] },
  { assetId: 'stall_x1_d1', type: 'mesh_3d', displayName: 'Market stall', prompt: 'market stall', draftGroup: 'stall_x1', createdAt: '2026-10-10T09:00:00Z', generationProvider: 'blender-agent-claude',
    files: [file('stall_x1_d1', 'stall_x1_d1.glb', 'main'), file('stall_x1_d1', 'stall_x1_d1_script.py', 'script'), file('stall_x1_d1', 'render_front.png', 'render')] },
  { assetId: 'imp_yun_cars_sedan_ab1234', type: 'mesh_3d', displayName: 'Sedan', generationProvider: 'imported', source: 'Yun game · kenney/cars', createdAt: '2026-09-01T08:00:00Z',
    previewUrl: '/api/foundry/assets/imp_yun_cars_sedan_ab1234/preview', files: [file('imp_yun_cars_sedan_ab1234', 'sedan.glb', 'main')] },
  { assetId: 'imp_yun_sfx_jump_cd5678', type: 'audio_sfx', displayName: 'Jump', generationProvider: 'imported', source: 'Yun game · sfx', createdAt: '2026-09-01T08:00:00Z',
    files: [file('imp_yun_sfx_jump_cd5678', 'jump.ogg', 'main')] },
  { assetId: 'stall_x1_d2', type: 'mesh_3d', displayName: 'Market stall', prompt: 'market stall', draftGroup: 'stall_x1', createdAt: '2026-10-10T09:10:00Z', generationProvider: 'blender-agent-claude',
    files: [file('stall_x1_d2', 'stall_x1_d2.glb', 'main')] },
];
const jobs = [
  { jobId: '11111111-1111-1111-1111-111111111111', assetId: 'barrel_q1', displayName: 'Barrel', kind: 'mesh_3d', status: 'running', prompt: 'a barrel',
    progress: [{ at: '2026-10-11T09:00:00Z', message: 'Attempt 1/3: building in Blender…' }], createdAt: '2026-10-11T09:00:00Z', providerId: 'blender-agent-local' },
  { jobId: '22222222-2222-2222-2222-222222222222', assetId: 'lamp_z9', displayName: 'Street lamp', kind: 'mesh_3d', status: 'failed', prompt: 'a street lamp',
    error: 'Blender Agent could not build "lamp_z9" after 3 attempt(s). Last: validate: The asset has 3 disconnected groups of parts.',
    progress: [], createdAt: '2026-10-10T07:00:00Z', providerId: 'blender-agent-local' },
];

const aiStatus = {
  ollama: { state: 'running', version: '0.40.2' },
  hardware: { gpu: 'AMD Radeon RX 7700 XT', vramGb: 12, ramGb: 32 },
  roles: { chat: 'qwen3:8b', assets: 'qwen2.5-coder:14b' },
  loaded: ['qwen3:8b'],
  models: [
    { name: 'qwen3:8b', title: 'Qwen 3 · 8B', downloadGb: 5.2, vramGb: 6.5, roles: ['chat'], good: 'Fast chat', installed: true, fit: 'gpu' },
    { name: 'qwen2.5-coder:14b', title: 'Qwen 2.5 Coder · 14B', downloadGb: 9, vramGb: 10.5, roles: ['assets', 'chat'], good: 'Code', installed: true, fit: 'gpu' },
    { name: 'qwen3:14b', title: 'Qwen 3 · 14B', downloadGb: 9.3, vramGb: 11, roles: ['chat'], good: 'Smarter', installed: false, fit: 'gpu' },
  ],
  claude: { state: 'not-signed-in', detail: 'Installed, not signed in.' },
};

function fixture(path, method, body) {
  const url = new URL(path, 'http://localhost');
  const p = url.pathname;
  if (p === '/health') return { mode: 'ollama' };
  if (p === '/providers') return { current: 'ollama', providers: [
    { id: 'mock', label: 'Mock', available: true }, { id: 'ollama', label: 'Ollama', available: true, model: 'gemma4:12b' },
    { id: 'anthropic', label: 'Claude', available: false }] };
  if (p === '/api/assistant') return /asset|sound|model/i.test(body?.message ?? '')
    ? { reply: 'Here is everything in your library: 5 assets.', answeredBy: 'library', assets: { total: 5, openHash: '#assets', shown: assets.map((a) => ({ assetId: a.assetId, name: a.displayName, type: a.type })) } }
    : { reply: 'Nothing is building right now.', answeredBy: 'model' };
  if (p === '/ask') return { title: 'Matterhorn', response: `Answer to: ${body?.prompt?.slice(-40)}` };
  if (p === '/api/projects' && method === 'GET') return [{ id: 'yun', name: 'Yun' }];
  if (p === '/api/projects') return { id: 'new-game', name: body.name };
  if (p === '/api/studio/health') return { available: true, version: '0.15.0', validatorAgent: 'sentinel', storage: 'disk',
    executionBackends: { codex: { configured: true }, codeAgent: { agent: 'claude', installed: true, signedIn: false, ready: false, note: 'not signed in' } } };
  if (p === '/api/studio/runtime') return [{ capability: 'project-memory', title: 'Project memory', state: 'ready' }];
  if (p === '/api/studio/routing') return { assets: 'auto', localFirst: true, requireCommercialUse: true, allowNetworkProviders: false, allowExternalCostProviders: false, ...(body ?? {}) };
  if (p === '/api/studio/completion') return { metric: 'Matterhorn 100', capabilityCoverage: 57.5, productionReadiness: 35.4, updatedAt: '2026-10-03' };
  if (p === '/api/studio/runs' && method === 'GET') return runs;
  if (p === '/api/studio/runs') return { ...runs[1], id: 'run-new' };
  if (p === '/api/studio/plan') return { goal: body.goal, tasks: [{ id: 't', title: 'Implement in Godot', acceptanceCriteria: ['Timer ends match'] }], finalAcceptanceCriteria: ['Timer ends match'] };
  if (/^\/api\/studio\/runs\/[^/]+\/promotion$/.test(p)) return { state: 'pending', detail: 'Approval required' };
  if (/^\/api\/studio\/runs\/[^/]+\/(promotion\/approve|promotion\/revoke|cancel)$/.test(p)) return { ok: true };
  if (p === '/api/studio/play') return { runtimeSessionId: 'rt-1' };
  if (p === '/api/studio/play/stop') return { stopped: true };
  if (p === '/api/foundry/assets') return { assets, count: assets.length };
  if (p === '/api/foundry/jobs' && method === 'GET') return { jobs };
  if (p === '/api/foundry/jobs') return { job: { ...jobs[0], jobId: '33333333-3333-3333-3333-333333333333', assetId: body.assetId, displayName: body.displayName, status: 'queued' } };
  if (/^\/api\/foundry\/jobs\/[^/]+\/(cancel|retry)$/.test(p)) return { job: { ...jobs[1], assetId: 'lamp_z9_r2', status: 'queued' } };
  if (p === '/api/foundry/packs') return { jobs: body.items.map((i) => ({ ...jobs[0], assetId: i.name })) };
  if (p === '/api/foundry/styles' && method === 'GET') return { styles: [{ id: '44444444-4444-4444-4444-444444444444', name: 'Calle', description: 'warm pastel street' }] };
  if (p === '/api/foundry/styles') return { style: { id: '55555555-5555-5555-5555-555555555555', ...body } };
  if (/^\/api\/foundry\/styles\/[^/]+\/delete$/.test(p)) return { deleted: true };
  if (p === '/api/foundry/import') return { scanning: false, lastScan: { at: '2026-10-11T10:00:00Z', added: 0, total: 5, roots: 2 }, previews: { queued: 0, done: 2, failed: 0 } };
  if (p === '/api/foundry/import/scan') return { scanning: false, lastScan: { at: '2026-10-11T10:00:00Z', added: 3, total: 8, roots: 2 }, previews: { queued: 1, done: 2, failed: 0 } };
  if (p === '/api/ai/status' || p === '/api/ai/roles' || p === '/api/ai/start') return aiStatus;
  if (p === '/api/ai/models/pull') return { started: true };
  if (p === '/api/ai/claude/check') return aiStatus.claude;
  if (p === '/api/foundry/projects') return { projects: [{ id: 'library', name: 'Asset Library' }, { id: 'yun', name: 'Yun' }] };
  if (p === '/api/foundry/providers') return { providers: [
    { id: 'blender-agent-claude', name: 'Blender Agent (Claude Code)', available: true, local: false, requiresNetwork: true, note: 'Uses Claude' },
    { id: 'blender-agent-local', name: 'Blender Agent (local gemma4:12b)', available: true, local: true, requiresNetwork: false, note: 'Local' },
    { id: 'comfyui-local', name: 'ComfyUI Local', available: false, note: 'Configure ComfyUI' }] };
  const assetAction = /^\/api\/foundry\/assets\/([^/]+)(?:\/(send|keep|hide|show|rename))?$/.exec(p);
  if (assetAction) {
    const asset = assets.find((a) => a.assetId === decodeURIComponent(assetAction[1]));
    if (!asset) return { __status: 404, error: 'Asset not found.' };
    if (assetAction[2] === 'send') return { projectId: body.projectId, folder: `assets/matterhorn/${asset.assetId}`, files: ['a.glb', 'b.png'] };
    if (assetAction[2]) return { asset, assets: [asset] };
    return { asset, lineage: [asset] };
  }
  if (p === '/api/workspace/files') return { files: ['project.godot', 'scripts/round_manager.gd', 'ui/difficulty.tscn'], truncated: false };
  if (p === '/api/workspace/file') return { path: url.searchParams.get('path'), version: 'v1', content: 'extends Node\n' };
  if (p === '/api/workspace/validations') return [{ id: 'gdlint', name: 'Lint scripts', projectId: 'yun', timeoutMs: 60000 }];
  if (p === '/api/workspace/validate') return { id: 'gdlint', name: 'Lint scripts', status: 'passed', exitCode: 0, durationMs: 1200, stdout: 'ok', stderr: '' };
  if (p === '/api/workspace/assist') return body.intent === 'propose'
    ? { response: 'Proposed', review: { id: 'rev-1', path: body.path, status: 'pending', before: 'extends Node\n', after: 'extends Node2D\n' } }
    : { response: 'This file sets up the round.' };
  if (/^\/api\/workspace\/(apply|reject|restore)$/.test(p)) return { id: 'rev-1', path: 'project.godot', status: p.endsWith('apply') ? 'applied' : p.endsWith('reject') ? 'rejected' : 'restored', before: 'a', after: 'b' };
  return { __status: 404, error: `No fixture for ${method} ${p}` };
}

test('every control in the new Matterhorn UI does something real', async () => {
  const dom = new JSDOM(await readFile(new URL('../web/index.html', import.meta.url), 'utf8'), { url: 'http://localhost/#studio', pretendToBeVisual: true });
  const { window } = dom;
  const calls = [];
  const missing = [];
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, localStorage: window.localStorage,
    Node: window.Node, HTMLElement: window.HTMLElement,
  });
  window.confirm = () => true;
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => undefined;
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  globalThis.fetch = async (path, options = {}) => {
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push(`${method} ${path}`);
    const data = fixture(String(path), method, body);
    if (data?.__status === 404 && /No fixture/.test(data.error)) missing.push(data.error);
    const status = data?.__status ?? (method === 'POST' && /\/(jobs|projects|styles|packs)$/.test(String(path)) ? 201 : 200);
    return { ok: status < 400, status, json: async () => data };
  };

  const flush = async (rounds = 12) => { for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 4)); };
  const go = async (hash) => {
    document.querySelector('#sheet').hidden = true;
    document.querySelector('#sheet').replaceChildren();
    document.querySelector('#assistant').hidden = true;
    if (location.hash === hash) window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    else location.hash = hash;
    await flush();
  };
  const visible = (el) => !el.closest('[hidden]') && !el.disabled;
  const controls = () => [...document.querySelectorAll('button, a[href], select, input[type="checkbox"]')].filter(visible)
    .filter((el) => el.getAttribute('aria-checked') !== 'true' && el.getAttribute('aria-pressed') !== 'true' && el.getAttribute('aria-current') !== 'page' && el.getAttribute('aria-current') !== 'true');
  const values = () => [...document.querySelectorAll('input, textarea, select')].map((el) => `${el.id}=${el.type === 'checkbox' ? el.checked : el.value}`).join('|');
  const snapshot = () => `${document.body.innerHTML.length}:${document.body.innerHTML}|${location.hash}|${calls.length}|${values()}`;
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
  const routeHeads = new Set(['studio', 'game', 'assets', 'settings']);
  const validHref = (href) => href === '#main' ? true : href.startsWith('#') ? routeHeads.has(href.slice(1).split('/')[0]) :/^\/api\/(foundry\/assets\/[^/]+\/files\/|studio\/runs\/[^/]+\/evidence)/.test(href);

  await import('../web/app.js');
  await flush(30);

  // Exactly four places in the main navigation.
  assert.deepEqual([...document.querySelectorAll('.sidebar a.nav')].map((a) => a.textContent.trim()), ['Studio', 'My Game', 'Assets', 'Settings']);

  const routes = ['#studio', '#game/changes', '#game/changes/run-failed', '#game/checks', '#game/files', '#assets', '#assets/crate_ab12', '#assets/stall_x1_d1',
    '#assets/build/22222222-2222-2222-2222-222222222222', '#assets/build/11111111-1111-1111-1111-111111111111', '#assets/imp_yun_sfx_jump_cd5678', '#assets/imp_yun_cars_sedan_ab1234', '#settings', '#settings/brand', '#settings/guide'];
  const dead = [];
  let clicked = 0;
  for (const route of routes) {
    await go(route);
    const total = controls().length;
    assert.ok(total > 0, `${route} rendered no controls`);
    for (let i = 0; i < total; i++) {
      await go(route);
      const list = controls();
      if (i >= list.length) break;
      const el = list[i];
      const name = `${route} → “${label(el)}”`;
      if (el.tagName === 'A') {
        assert.ok(validHref(el.getAttribute('href')), `${name} links nowhere real (${el.getAttribute('href')})`);
        continue;
      }
      const before = snapshot();
      if (el.tagName === 'SELECT') {
        if (el.options.length < 2) continue;
        el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
        el.dispatchEvent(new window.Event('change', { bubbles: true }));
      } else {
        el.click();
      }
      clicked += 1;
      await flush();
      if (snapshot() === before) dead.push(name);
    }
  }
  assert.deepEqual(dead, [], `Controls that did nothing:\n${dead.join('\n')}`);
  assert.ok(clicked > 60, `expected to exercise many controls, exercised ${clicked}`);

  // Studio routes each kind of request to the right real endpoint.
  const ask = async (text, target = 'Let Matterhorn decide') => {
    await go('#studio');
    [...document.querySelectorAll('#target-pills .pill')].find((p) => p.textContent === target).click();
    await flush();
    for (const dismiss of [...document.querySelectorAll('#studio-result button')].filter((b) => b.textContent === 'Dismiss')) dismiss.click();
    await flush();
    const box = document.querySelector('#studio-prompt');
    box.value = text;
    box.dispatchEvent(new window.Event('input'));
    calls.length = 0;
    document.querySelector('#studio-go').click();
    await flush(20);
    return `${calls.join('\n')}\n[go=${document.querySelector('#studio-go')?.textContent} toast=${document.querySelector('#toast').textContent}]`;
  };
  assert.match(await ask('a wooden market stall with an awning'), /POST \/api\/foundry\/jobs/);
  assert.match(await ask('add a 3 minute match timer to the game'), /POST \/api\/studio\/plan/);
  assert.match(document.querySelector('#studio-result').textContent, /nothing has changed yet/);
  assert.match(await ask('how does scoring work?'), /POST \/ask/);

  // Making two drafts submits two grouped builds.
  await go('#assets');
  [...document.querySelectorAll('button')].find((b) => b.textContent === '+ Make an asset').click();
  await flush(20);
  document.querySelector('#make-desc').value = 'a market stall';
  [...document.querySelectorAll('.sheet .pill')].find((p) => p.textContent === '2').click();
  await flush();
  calls.length = 0;
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => { if (options?.body) bodies.push(JSON.parse(options.body)); return realFetch(path, options); };
  [...document.querySelectorAll('.sheet button')].find((b) => b.textContent === 'Make it').click();
  await flush(20);
  globalThis.fetch = realFetch;
  const draftJobs = bodies.filter((b) => b.draftGroup);
  assert.equal(draftJobs.length, 2);
  assert.equal(new Set(draftJobs.map((b) => b.assetId)).size, 2);

  // Settings reports Claude honestly and the sidebar counts it.
  await go('#settings');
  await flush(20);
  assert.match(document.querySelector('#connections').textContent, /Claude Code\s*Installed, not signed in/);
  assert.match(document.querySelector('#ai-settings').textContent, /Local AI is ready/);
  assert.match(document.querySelector('#ai-settings').textContent, /RX 7700 XT with 12 GB/);
  assert.equal(document.querySelector('#role-chat').value, 'qwen3:8b');

  // The chat floats over every page, answers asset questions with real results and stays open across pages.
  await go('#studio');
  document.querySelector('#assistant-toggle').click();
  await flush();
  // The button toggles: if the crawler left the chat open, the first click minimized it.
  if (document.querySelector('#assistant').hidden) {
    document.querySelector('#assistant-toggle').click();
    await flush();
  }
  assert.equal(document.querySelector('#assistant').hidden, false);
  document.querySelector('#assistant-input').value = 'can you show me the assets?';
  document.querySelector('#assistant-send').click();
  await flush(20);
  assert.ok(document.querySelectorAll('#assistant-log .chat-asset').length >= 3, 'asset answers come back as clickable results');
  location.hash = '#assets';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await flush();
  assert.equal(document.querySelector('#assistant').hidden, false, 'chat stays open while moving around');
  assert.equal(document.querySelector('#assistant-toggle').textContent.trim(), 'Matterhorn');
  document.querySelector('#assistant-min').click();
  await flush();
  assert.equal(document.querySelector('#chat-pill').hidden, false, 'minimized to a pill');

  // The brand page shows both designs, and choosing one changes the sidebar logo.
  await go('#settings/brand');
  assert.match(document.querySelector('#main').textContent, /IDEAS UNDER CONTROL/);
  assert.equal(document.querySelectorAll('.version-card').length, 8);
  [...document.querySelectorAll('.choice')].find((b) => b.querySelector('strong')?.textContent === 'Summit').click();
  await flush();
  assert.equal(JSON.parse(localStorage.getItem('matterhorn.logo')).mark, 'summit');
  assert.ok(document.querySelector('.sidebar .brand svg'), 'sidebar shows the logo');

  // Every guide section renders, and imported assets say where they came from.
  await go('#settings/guide');
  for (const id of ['start', 'studio', 'game', 'assets', 'settings', 'howto', 'trouble', 'files']) {
    assert.ok(document.querySelector(`#guide-${id}`), `guide section ${id}`);
  }
  await go('#assets');
  const source = document.querySelector('#asset-source');
  source.value = 'all';
  source.dispatchEvent(new window.Event('change'));
  const search = document.querySelector('#asset-search');
  search.value = '';
  search.dispatchEvent(new window.Event('input'));
  [...document.querySelectorAll('#asset-filters .pill')].find((p) => p.textContent === 'All')?.click();
  await flush();
  assert.match(document.querySelector('#asset-grid').textContent, /In Yun/);
  await go('#assets/imp_yun_sfx_jump_cd5678');
  assert.ok(document.querySelector('audio'), 'sounds can be played');
  assert.match(document.querySelector('#setup-status').textContent, /need/);

  // No fake character/rig claims anywhere in the new UI.
  assert.doesNotMatch(document.body.textContent, /Humanoid \(18 bones\)|Landmark Match Score/);
  assert.deepEqual([...new Set(missing)], [], 'UI called endpoints the fixture does not know');
});
