import { api, tryApi, h, clear, btn, action, pills, toast, timeAgo, slug, store } from './ui.js';

const TARGETS = [
  { id: 'auto', label: 'Let Matterhorn decide' },
  { id: 'asset', label: 'An asset' },
  { id: 'game', label: 'A game change' },
  { id: 'ask', label: 'A question' },
];
const GO_LABEL = { auto: 'Go', asset: 'Make it', game: 'Plan the change', ask: 'Ask' };
const CHIPS = [
  { label: '3D prop', target: 'asset', text: 'A 3D prop: ' },
  { label: 'Sprite sheet', target: 'asset', text: 'An 8-direction sprite sheet of ' },
  { label: 'Gameplay change', target: 'game', text: 'Change the gameplay so that ' },
  { label: 'Fix a bug', target: 'game', text: 'Fix this bug: ' },
  { label: 'Question', target: 'ask', text: 'How does ' },
];
const GAME_WORDS = /\b(game|level|player|enemy|enemies|score|timer|match|round|menu|hud|bug|crash|fix|gameplay|difficulty|spawn|scene|ui|button|controls?|multiplayer|yun)\b/i;

const state = { prompt: '', target: 'auto', result: null, allowDirty: false, poll: undefined };

export function leave() {
  clearTimeout(state.poll);
}

function resolveTarget(text) {
  if (state.target !== 'auto') return state.target;
  const trimmed = text.trim();
  if (/\?$/.test(trimmed) || /^(what|how|why|where|when|which|who|can|does|is|are|should)\b/i.test(trimmed)) return 'ask';
  if (GAME_WORDS.test(trimmed)) return 'game';
  return 'asset';
}

export async function render(main) {
  clearTimeout(state.poll);
  const box = h('textarea', {
    id: 'studio-prompt', class: 'field big', rows: 4, value: state.prompt,
    placeholder: 'e.g. a wooden market stall with a striped awning — or — add a 3-minute match timer',
    oninput: (e) => { state.prompt = e.target.value; paintTargets(); },
    onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); },
  });
  clear(main,
    h('header', { class: 'page-head stack' },
      h('h1', {}, 'What do you want to make or change?'),
      h('p', { class: 'muted' }, 'Describe it in your own words. Matterhorn builds the asset, plans the game change, or answers.')),
    h('section', { class: 'card composer', 'aria-label': 'Your request' },
      h('label', { for: 'studio-prompt', class: 'label' }, 'Your request'),
      box,
      h('div', { class: 'row wrap' },
        h('span', { class: 'label inline' }, 'This is'),
        h('div', { id: 'target-pills' }),
        h('span', { class: 'spacer' }),
        h('div', { id: 'go-slot' })),
      h('div', { class: 'row wrap' },
        h('span', { class: 'muted' }, 'Start from:'),
        CHIPS.map((chip) => btn(chip.label, () => {
          state.target = chip.target;
          state.prompt = chip.text;
          box.value = chip.text;
          box.focus();
          box.setSelectionRange(chip.text.length, chip.text.length);
          paintTargets();
        }, 'chip')))),
    h('div', { id: 'studio-result' }),
    h('div', { class: 'feed', id: 'feed' }, h('p', { class: 'muted' }, 'Loading…')),
  );
  paintTargets();
  paintResult();
  await paintFeed();
}

function paintTargets() {
  const host = document.querySelector('#target-pills');
  const slot = document.querySelector('#go-slot');
  if (!host || !slot) return;
  clear(host, pills(TARGETS, state.target, (id) => { state.target = id; paintTargets(); }, 'Request type'));
  const resolved = state.prompt.trim() ? resolveTarget(state.prompt) : state.target;
  const label = state.target === 'auto' && state.prompt.trim() ? `${GO_LABEL[resolved]} →` : GO_LABEL[state.target];
  clear(slot, action(label, go, 'primary', { id: 'studio-go' }));
}

async function go() {
  const text = state.prompt.trim();
  if (!text) {
    document.querySelector('#studio-prompt')?.focus();
    toast('Describe what you want first.');
    return;
  }
  const target = resolveTarget(text);
  if (target === 'asset') return makeAsset(text);
  if (target === 'game') return planChange(text);
  return ask(text);
}

async function makeAsset(text) {
  const [providers, routing] = await Promise.all([api('/api/foundry/providers'), api('/api/studio/routing')]);
  const builders = providers.providers.filter((p) => p.id.startsWith('blender-agent') && p.available);
  const builder = builders.find((b) => b.id === routing.assets) ?? builders.find((b) => b.local) ?? builders[0];
  if (!builder) {
    state.result = { kind: 'error', text: 'No asset builder is available. Blender must be installed — see Settings › Connections.', fix: '#settings' };
    return paintResult();
  }
  if (builder.requiresNetwork && !routing.allowNetworkProviders) {
    state.result = { kind: 'error', text: 'Assets are set to be built with Claude, which runs online, but online AI is blocked in Settings.', fix: '#settings' };
    return paintResult();
  }
  const displayName = text.charAt(0).toUpperCase() + text.slice(1, 48);
  const assetId = `${slug(text)}_${Date.now().toString(36).slice(-4)}`;
  const { job } = await api('/api/foundry/jobs', {
    projectId: 'library', assetId, kind: /sprite sheet/i.test(text) ? 'sprite_sheet' : /pixel/i.test(text) ? 'pixel_sprite' : 'mesh_3d',
    operation: 'generate', prompt: text, displayName, providerId: builder.id, allowNetwork: Boolean(builder.requiresNetwork),
  });
  state.result = { kind: 'asset', job, builder: builder.id === 'blender-agent-claude' ? 'Claude' : 'the local model' };
  state.prompt = '';
  const box = document.querySelector('#studio-prompt');
  if (box) box.value = '';
  paintTargets();
  paintResult();
  paintFeed();
}

async function planChange(text) {
  if (!store.games.length) {
    state.result = { kind: 'error', text: 'Set up a game first, then Matterhorn can plan changes to it.', fix: '#game' };
    return paintResult();
  }
  const game = store.games.find((g) => g.id === store.gameId) ?? store.games[0];
  const payload = { projectId: game.id, goal: text, criteria: [], allowDirty: state.allowDirty };
  try {
    const plan = await api('/api/studio/plan', payload);
    state.result = { kind: 'plan', plan, payload, game };
  } catch (error) {
    const dirty = /uncommitted|dirty/i.test(error.message);
    state.result = { kind: 'error', text: error.message, dirty, retry: () => planChange(text) };
  }
  paintResult();
}

async function ask(text) {
  state.result = { kind: 'answer', question: text, answer: null };
  paintResult();
  try {
    const answer = await api('/ask', { prompt: text, intent: 'ask', workspace: { name: 'Matterhorn' } });
    state.result = { kind: 'answer', question: text, answer: answer.response };
  } catch (error) {
    state.result = { kind: 'error', text: `Couldn't answer: ${error.message}` };
  }
  paintResult();
}

function paintResult() {
  const host = document.querySelector('#studio-result');
  if (!host) return;
  const r = state.result;
  const dismiss = btn('Dismiss', () => { state.result = null; paintResult(); }, 'quiet');
  if (!r) return clear(host);
  if (r.kind === 'error') {
    return clear(host, h('section', { class: 'card alert', role: 'alert' },
      h('p', {}, r.text),
      h('div', { class: 'row wrap' },
        r.dirty ? action('Plan anyway (my game has unsaved changes)', async () => { state.allowDirty = true; await r.retry(); }, 'primary') : null,
        r.fix ? h('a', { class: 'btn', href: r.fix }, 'Fix it') : null,
        dismiss)));
  }
  if (r.kind === 'asset') {
    return clear(host, h('section', { class: 'card note' },
      h('span', { class: 'label' }, 'Building'),
      h('h2', {}, r.job.displayName ?? r.job.assetId),
      h('p', { class: 'muted' }, `${r.builder} is writing the Blender script. It usually takes a few minutes; you can keep working.`),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: `#assets/build/${r.job.jobId}` }, 'Watch progress'), dismiss)));
  }
  if (r.kind === 'answer') {
    return clear(host, h('section', { class: 'card' },
      h('span', { class: 'label' }, 'Answer'),
      h('p', { class: 'prewrap' }, r.answer ?? 'Thinking…'),
      r.answer ? h('div', { class: 'row' },
        btn('Plan a change from this', () => { state.target = 'game'; state.prompt = r.question; render(document.querySelector('#main')); }),
        dismiss) : null));
  }
  const { plan, payload, game } = r;
  return clear(host, h('section', { class: 'card plan' },
    h('span', { class: 'label accent' }, `Plan for ${game.name} — nothing has changed yet`),
    h('h2', {}, plan.goal),
    h('ol', { class: 'plan-steps' }, plan.tasks.map((task) => h('li', {},
      h('strong', {}, task.title),
      task.acceptanceCriteria?.length ? h('ul', {}, task.acceptanceCriteria.map((c) => h('li', { class: 'muted' }, c))) : null))),
    h('div', { class: 'row wrap' },
      action('Approve plan & build', async () => {
        await api('/api/studio/runs', payload);
        state.result = null;
        state.prompt = '';
        toast(`Approved. Building in ${game.name} — follow it in My Game.`);
        location.hash = '#game/changes';
      }, 'primary'),
      btn('Change the plan', () => {
        const box = document.querySelector('#studio-prompt');
        state.prompt = plan.goal;
        box.value = plan.goal;
        box.focus();
        toast('Edit the request, then press Plan the change again.');
      }),
      dismiss)));
}

// ── Feed: needs you / in progress / recent ───────────────────────────
async function paintFeed() {
  const host = document.querySelector('#feed');
  if (!host) return;
  const [runs, jobsData, assetsData] = await Promise.all([tryApi('/api/studio/runs'), tryApi('/api/foundry/jobs'), tryApi('/api/foundry/assets')]);
  const runList = Array.isArray(runs) ? runs : [];
  const jobs = jobsData?.jobs ?? [];
  const assets = (assetsData?.assets ?? []).filter((a) => !a.hidden);
  const retried = new Set(jobs.map((j) => j.retryOf).filter(Boolean));
  const activeRun = (r) => !['completed', 'failed', 'blocked', 'cancelled'].includes(r.status);

  const completed = runList.filter((r) => r.status === 'completed').slice(0, 5);
  const promotions = await Promise.all(completed.map((r) => tryApi(`/api/studio/runs/${r.id}/promotion`)));

  const needs = [];
  completed.forEach((run, i) => {
    if (promotions[i] && promotions[i].state !== 'approved') {
      needs.push(item('warn', `Approve: ${run.plan.goal}`, 'Built and checked. Keep it?', h('a', { class: 'btn small', href: `#game/changes/${run.id}` }, 'Review')));
    }
  });
  for (const run of runList.filter((r) => r.status === 'failed' || r.status === 'blocked').slice(0, 3)) {
    needs.push(item('bad', `Couldn’t finish: ${run.plan.goal}`, run.detail ?? 'See what happened.', h('a', { class: 'btn small', href: `#game/changes/${run.id}` }, 'See why')));
  }
  for (const job of jobs.filter((j) => j.status === 'failed' && !retried.has(j.jobId)).slice(0, 3)) {
    needs.push(item('bad', `Couldn’t build ${job.displayName ?? job.assetId}`, (job.error ?? '').split('. ')[0].slice(0, 120),
      h('a', { class: 'btn small', href: `#assets/build/${job.jobId}` }, 'See why')));
  }
  const draftGroups = [...new Set(assets.filter((a) => a.draftGroup).map((a) => a.draftGroup))];
  for (const group of draftGroups.slice(0, 3)) {
    const first = assets.find((a) => a.draftGroup === group);
    needs.push(item('warn', `Pick a draft: ${first.displayName ?? group}`, 'Several versions are ready.', h('a', { class: 'btn small', href: `#assets/${encodeURIComponent(first.assetId)}` }, 'Choose')));
  }

  const progress = [];
  for (const run of runList.filter(activeRun)) {
    const done = run.tasks.filter((t) => t.status === 'completed').length;
    progress.push(item('active', run.plan.goal, `Step ${Math.min(done + 1, run.tasks.length)} of ${run.tasks.length} · ${run.status}`,
      h('a', { class: 'btn small', href: `#game/changes/${run.id}` }, 'Open'),
      action('Cancel', async () => { await api(`/api/studio/runs/${run.id}/cancel`, {}); toast('Cancel requested.'); paintFeed(); }, 'small quiet')));
  }
  for (const job of jobs.filter((j) => j.status === 'queued' || j.status === 'running')) {
    progress.push(item('active', job.displayName ?? job.assetId, job.progress?.at(-1)?.message ?? 'Waiting for the build before it.',
      h('a', { class: 'btn small', href: `#assets/build/${job.jobId}` }, 'Open'),
      action('Cancel', async () => { await api(`/api/foundry/jobs/${job.jobId}/cancel`, {}); toast('Cancelled.'); paintFeed(); }, 'small quiet')));
  }

  const recent = [
    ...assets.map((a) => ({ at: a.createdAt, node: item('ok', a.displayName ?? a.assetId, `Asset · ${timeAgo(a.createdAt)}`, h('a', { class: 'btn small', href: `#assets/${encodeURIComponent(a.assetId)}` }, 'Open')) })),
    ...runList.filter((r) => r.status === 'completed').map((r) => ({ at: r.updatedAt, node: item('ok', r.plan.goal, `Game change · ${timeAgo(r.updatedAt)}`, h('a', { class: 'btn small', href: `#game/changes/${r.id}` }, 'Open')) })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5).map((x) => x.node);

  clear(host,
    column('Needs you', needs, 'Nothing needs you right now.'),
    column('In progress', progress, 'Nothing is running.'),
    column('Recent', recent, 'Nothing made yet — describe something above.'));

  clearTimeout(state.poll);
  if (progress.length) state.poll = setTimeout(() => { if (document.querySelector('#feed')) paintFeed(); }, 4000);
}

function item(tone, title, detail, ...actions) {
  return h('div', { class: `feed-item ${tone}` },
    h('strong', {}, title),
    detail ? h('span', { class: 'muted small' }, detail) : null,
    h('div', { class: 'row' }, actions));
}

function column(title, items, emptyText) {
  return h('section', { class: 'card feed-col', 'aria-label': title },
    h('h2', {}, title),
    items.length ? items : h('p', { class: 'muted' }, emptyText));
}
