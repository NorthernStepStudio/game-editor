import { api, h, clear, btn, action, pills, toast, timeAgo, slug, store, elapsed } from './ui.js';

const KIND_LABEL = {
  mesh_3d: '3D model', sprite_sheet: 'Sprite sheet', pixel_sprite: 'Pixel art', rig: 'Rig', animation: 'Animation',
  texture: 'Texture', ui_icon: 'Icon', concept_art: 'Concept art', background: 'Background', tile: 'Tile', tileset: 'Tileset',
};
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: '3d', label: '3D models' },
  { id: '2d', label: 'Images & sprites' },
  { id: 'audio', label: 'Sounds' },
  { id: 'attention', label: 'Needs attention' },
];
const AUDIO_KINDS = new Set(['audio_sfx', 'audio_music', 'audio_voice']);
const PAGE_SIZE = 120;
const RENDER_ORDER = ['render_front.png', 'render_three_quarter.png', 'render_side.png', 'render_back.png'];

const state = { filter: 'all', source: 'all', query: '', limit: PAGE_SIZE, data: null, poll: undefined };

/** Where an asset came from: made here, in one of the games, or a work file. */
function originOf(asset) {
  if (asset.generationProvider !== 'imported') return 'made';
  const game = state.data.games.find((g) => (asset.source ?? '').startsWith(`${g.name} game`));
  return game ? `game:${game.id}` : 'work';
}

async function loadData() {
  const [assets, jobs, styles, providers, projects, routing] = await Promise.all([
    api('/api/foundry/assets'),
    api('/api/foundry/jobs'),
    api('/api/foundry/styles'),
    api('/api/foundry/providers'),
    api('/api/foundry/projects'),
    api('/api/studio/routing'),
  ]);
  state.data = {
    assets: assets.assets ?? [],
    jobs: jobs.jobs ?? [],
    styles: styles.styles ?? [],
    builders: (providers.providers ?? []).filter((p) => p.id.startsWith('blender-agent') && p.available),
    meshy: (providers.providers ?? []).find((p) => p.id === 'meshy-image-to-3d'),
    games: (projects.projects ?? []).filter((p) => p.id !== 'library'),
    routing,
  };
  return state.data;
}

export function leave() {
  clearTimeout(state.poll);
}

export async function render(main, sub) {
  clearTimeout(state.poll);
  await loadData();
  if (sub.startsWith('build/')) return renderJob(main, sub.slice(6));
  if (sub.startsWith('search/')) {
    // Opened from the chat: show the library filtered by its search.
    const [query, filter] = sub.slice(7).split('/');
    state.query = decodeURIComponent(query ?? '').toLowerCase();
    state.filter = FILTERS.some((f) => f.id === filter) ? filter : 'all';
    state.source = 'all';
    state.limit = PAGE_SIZE;
    return renderGrid(main);
  }
  if (sub) return renderDetail(main, sub);
  renderGrid(main);
}

// ── Library grid ─────────────────────────────────────────────────────
function assetName(asset) {
  return asset.displayName || asset.assetId;
}

function matchesFilter(item) {
  const { filter, query } = state;
  const text = `${item.name} ${item.prompt ?? ''} ${item.asset?.source ?? ''}`.toLowerCase();
  if (query && !text.includes(query)) return false;
  if (state.source !== 'all' && (item.type !== 'asset' ? state.source !== 'made' : originOf(item.asset) !== state.source)) return false;
  if (filter === 'attention') return item.status === 'failed';
  if (filter === '3d') return item.kind === 'mesh_3d';
  if (filter === 'audio') return AUDIO_KINDS.has(item.kind);
  if (filter === '2d') return item.kind !== 'mesh_3d' && !AUDIO_KINDS.has(item.kind) && item.kind !== undefined;
  return true;
}

function libraryItems() {
  const { assets, jobs } = state.data;
  const retried = new Set(jobs.map((j) => j.retryOf).filter(Boolean));
  const items = [];
  for (const job of jobs) {
    if (job.status === 'queued' || job.status === 'running') {
      items.push({ type: 'job', status: 'building', job, name: job.displayName || job.assetId, kind: job.kind, prompt: job.prompt });
    } else if (job.status === 'failed' && !retried.has(job.jobId)) {
      items.push({ type: 'job', status: 'failed', job, name: job.displayName || job.assetId, kind: job.kind, prompt: job.prompt });
    }
  }
  const groups = new Map();
  // Numbered revisions of the same imported piece (…_r8, _r8b, _v02, _lod1) fold into one card.
  const revisions = new Map();
  for (const asset of assets) {
    if (asset.hidden || asset.generationProvider !== 'imported') continue;
    const key = revisionKey(asset);
    const list = revisions.get(key) ?? [];
    list.push(asset);
    revisions.set(key, list);
  }
  for (const list of revisions.values()) list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.assetId.localeCompare(a.assetId));
  for (const asset of assets) {
    if (asset.hidden) continue;
    if (asset.generationProvider === 'imported' && revisions.get(revisionKey(asset))?.[0] !== asset) continue;
    if (asset.draftGroup) {
      const group = groups.get(asset.draftGroup) ?? [];
      group.push(asset);
      groups.set(asset.draftGroup, group);
    }
    const older = asset.generationProvider === 'imported' ? revisions.get(revisionKey(asset)).length - 1 : 0;
    items.push({ type: 'asset', status: 'ready', asset, name: assetName(asset), kind: asset.type, prompt: asset.prompt, created: asset.createdAt, older });
  }
  for (const item of items) {
    if (item.type === 'asset' && item.asset.draftGroup) {
      const group = groups.get(item.asset.draftGroup);
      item.draft = { index: group.indexOf(item.asset) + 1, total: group.length };
    }
  }
  return items.sort((a, b) => rank(a) - rank(b) || String(b.created ?? b.job?.createdAt).localeCompare(String(a.created ?? a.job?.createdAt)));
}

function rank(item) {
  if (item.status === 'building') return 0;
  if (item.status === 'failed') return 1;
  const origin = originOf(item.asset);
  return origin === 'made' ? 2 : origin.startsWith('game:') ? 3 : 4;
}

/** Same folder + same name once revision markers are removed = the same piece. */
export function revisionKey(asset) {
  const name = (asset.displayName ?? asset.assetId).toLowerCase()
    .replace(/\b(v\d+|r\d+[a-z]?|lod\d+|scale|rev\d+|final|candidate)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return `${asset.source ?? ''}|${asset.type}|${name}`;
}

function renderGrid(main) {
  const search = h('input', {
    id: 'asset-search', class: 'field', type: 'search', placeholder: 'Search by name or description', value: state.query,
    oninput: (e) => { state.query = e.target.value.trim().toLowerCase(); paintGrid(); },
  });
  clear(main,
    h('header', { class: 'page-head' },
      h('h1', {}, 'Assets'),
      h('div', { class: 'row end' },
        action('Find new files', async () => {
          const result = await api('/api/foundry/import/scan', {});
          toast(result.lastScan?.added
            ? `Found ${result.lastScan.added} new file(s) in your game and work folders.`
            : 'No new files. Everything in your game and work folders is already here.');
          await refresh();
        }, 'quiet', { title: 'Look for models, images and sounds added to your game and work folders' }),
        btn('Styles', () => openStyles()),
        btn('+ Make an asset', () => openMake(), 'primary'))),
    h('div', { class: 'toolbar' },
      h('label', { for: 'asset-search', class: 'sr-only' }, 'Search assets'), search,
      h('label', { for: 'asset-source', class: 'sr-only' }, 'Where from'),
      h('select', { id: 'asset-source', class: 'field source-select', onchange: (e) => { state.source = e.target.value; state.limit = PAGE_SIZE; paintGrid(); } },
        h('option', { value: 'all', selected: state.source === 'all' }, 'From everywhere'),
        h('option', { value: 'made', selected: state.source === 'made' }, 'Made in Matterhorn'),
        state.data.games.map((g) => h('option', { value: `game:${g.id}`, selected: state.source === `game:${g.id}` }, `In ${g.name}`)),
        h('option', { value: 'work', selected: state.source === 'work' }, 'Work files (artifacts)')),
      h('div', { id: 'asset-filters' })),
    h('p', { id: 'asset-count', class: 'muted small' }),
    h('div', { id: 'asset-grid', class: 'grid', 'aria-live': 'polite' }),
  );
  paintGrid();
}

function paintGrid() {
  const grid = document.querySelector('#asset-grid');
  const filters = document.querySelector('#asset-filters');
  if (!grid || !filters) return;
  clear(filters, pills(FILTERS, state.filter, (id) => { state.filter = id; state.limit = PAGE_SIZE; paintGrid(); }, 'Filter assets'));
  const all = libraryItems();
  const items = all.filter(matchesFilter);
  const count = document.querySelector('#asset-count');
  if (count) count.textContent = `${items.length} of ${all.length} assets`;
  if (!all.length) {
    clear(grid, h('div', { class: 'empty wide' },
      h('p', {}, 'No assets yet. Describe one and Matterhorn builds it in Blender on this PC.'),
      btn('+ Make your first asset', () => openMake(), 'primary')));
  } else if (!items.length) {
    clear(grid, h('div', { class: 'empty wide' }, h('p', {}, 'Nothing matches.'), btn('Show all', () => { state.filter = 'all'; state.query = ''; render(document.querySelector('#main'), ''); })));
  } else {
    clear(grid, items.slice(0, state.limit).map(card),
      items.length > state.limit
        ? h('div', { class: 'empty wide' }, btn(`Show ${Math.min(PAGE_SIZE, items.length - state.limit)} more`, () => { state.limit += PAGE_SIZE; paintGrid(); }))
        : null);
  }
  schedulePoll();
}

function card(item) {
  const kind = KIND_LABEL[item.kind] ?? item.kind ?? 'Asset';
  if (item.type === 'job') {
    const job = item.job;
    const building = item.status === 'building';
    const last = job.progress?.at(-1)?.message ?? (job.status === 'queued' ? 'Waiting for the build before it.' : '');
    return h('article', { class: `asset-card ${item.status}` },
      h('a', { class: 'thumb placeholder', href: `#assets/build/${job.jobId}`, 'aria-label': `${item.name} — ${building ? 'building' : 'failed'}` },
        h('span', { class: 'tag' }, kind)),
      h('div', { class: 'asset-body' },
        h('strong', {}, item.name),
        h('span', { class: `status ${building ? 'warn' : 'bad'}` }, building ? (job.status === 'queued' ? 'Waiting…' : 'Building…') : 'Couldn’t build'),
        h('span', { class: 'muted small clamp' }, building ? last : firstSentence(job.error)),
        h('div', { class: 'row' },
          building
            ? action('Cancel', async () => { await api(`/api/foundry/jobs/${job.jobId}/cancel`, {}); toast(`Cancelled ${item.name}.`); await refresh(); }, 'small')
            : [h('a', { class: 'btn small', href: `#assets/build/${job.jobId}` }, 'See why'),
              action('Retry', async () => { await retry(job); }, 'small quiet')])));
  }
  const asset = item.asset;
  return h('article', { class: 'asset-card' },
    h('a', { class: 'thumb', href: `#assets/${encodeURIComponent(asset.assetId)}`, 'aria-label': `Open ${item.name}` },
      asset.previewUrl ? h('img', { src: asset.previewUrl, alt: '', loading: 'lazy' }) : null,
      h('span', { class: 'tag' }, kind)),
    h('div', { class: 'asset-body' },
      h('strong', {}, item.name),
      item.draft
        ? h('span', { class: 'status warn' }, `Draft ${item.draft.index} of ${item.draft.total} — pick one`)
        : h('span', { class: 'status ok' }, originLabel(asset)),
      h('span', { class: 'muted small clamp' }, asset.source ?? item.prompt ?? timeAgo(asset.createdAt)),
      item.older ? h('span', { class: 'muted small' }, `+${item.older} older version${item.older > 1 ? 's' : ''}`) : null,
      h('div', { class: 'row' }, h('a', { class: 'btn small', href: `#assets/${encodeURIComponent(asset.assetId)}` }, 'Open'))));
}

function originLabel(asset) {
  const origin = originOf(asset);
  if (origin === 'made') return 'Ready';
  if (origin === 'work') return 'Work file';
  return `In ${state.data.games.find((g) => origin === `game:${g.id}`)?.name ?? 'game'}`;
}

function firstSentence(text = '') {
  const clean = text.replace(/^Blender Agent could not build "[^"]+" after \d+ attempt\(s\)\. Last: /, '');
  return clean.split(/(?<=\.)\s/)[0].slice(0, 160);
}

function schedulePoll() {
  clearTimeout(state.poll);
  if (!state.data?.jobs.some((j) => j.status === 'queued' || j.status === 'running')) return;
  state.poll = setTimeout(refresh, 3000);
}

async function refresh() {
  if (!document.querySelector('#asset-grid')) return;
  try {
    await loadData();
    paintGrid();
  } catch {
    // The next action re-fetches; a missed poll is harmless.
  }
}

async function retry(job, providerId) {
  const result = await api(`/api/foundry/jobs/${job.jobId}/retry`, providerId ? { providerId } : {});
  toast(`Trying again as ${result.job.assetId}.`);
  location.hash = '#assets';
  await refresh();
}

// ── Failed / running build detail ────────────────────────────────────
function renderJob(main, jobId) {
  const job = state.data.jobs.find((j) => j.jobId === jobId);
  store.set({ ref: { kind: 'build', id: jobId } });
  if (!job) {
    clear(main, h('div', { class: 'empty' }, h('p', {}, 'That build is no longer in the history.'), h('a', { class: 'btn', href: '#assets' }, 'Back to assets')));
    return;
  }
  const claude = state.data.builders.find((b) => b.id === 'blender-agent-claude');
  const failed = job.status === 'failed' || job.status === 'cancelled';
  clear(main,
    h('a', { class: 'btn quiet', href: '#assets' }, '← All assets'),
    h('header', { class: 'page-head' },
      h('div', {}, h('h1', {}, job.displayName || job.assetId), h('p', { class: 'muted' }, job.prompt ?? '')),
      h('span', { class: `status ${failed ? 'bad' : job.status === 'succeeded' ? 'ok' : 'warn'}` },
        { failed: 'Couldn’t build', cancelled: 'Cancelled', succeeded: 'Built', queued: 'Waiting', running: 'Building…' }[job.status])),
    failed ? h('section', { class: 'card alert' },
      h('h2', {}, 'What went wrong'),
      h('p', { class: 'prewrap' }, job.error ?? 'No reason was recorded.'),
      h('div', { class: 'row' },
        claude && job.providerId !== 'blender-agent-claude'
          ? action('Retry with Claude', () => retry(job, 'blender-agent-claude'), 'primary') : null,
        action('Retry', () => retry(job), claude ? '' : 'primary'),
        btn('Change the description', () => openMake({ prompt: job.prompt, name: job.displayName })))) : null,
    job.status === 'running' || job.status === 'queued'
      ? h('div', { class: 'row' }, action('Cancel build', async () => { await api(`/api/foundry/jobs/${job.jobId}/cancel`, {}); toast('Cancelled.'); location.hash = '#assets'; }))
      : null,
    job.status === 'succeeded' && job.assetIds?.[0] ? h('a', { class: 'btn primary', href: `#assets/${encodeURIComponent(job.assetIds[0])}` }, 'Open the asset') : null,
    job.status === 'running' || job.status === 'queued'
      ? liveView(job)
      : h('section', { class: 'card' },
        h('h2', {}, 'Progress'),
        h('ol', { class: 'log' }, (job.progress ?? []).map((p) => h('li', {}, h('time', {}, new Date(p.at).toLocaleTimeString()), ' ', p.message)))),
  );
  if (job.status === 'running' || job.status === 'queued') followLive(main, job);
}

// ── Live view of a running build ─────────────────────────────────────
const live = { jobId: undefined, scriptLength: 0, frames: 0, shown: -1, player: undefined };

/** Plays every picture Blender made, in order, so you watch the model assemble and turn. */
function playFrames(jobId, name) {
  if (live.player || live.shown >= live.frames - 1) return;
  live.player = setInterval(() => {
    const picture = document.querySelector('#live-picture');
    if (!picture || live.jobId !== jobId || live.shown >= live.frames - 1) {
      clearInterval(live.player);
      live.player = undefined;
      return;
    }
    live.shown += 1;
    let img = picture.querySelector('img');
    if (!img) {
      img = h('img', { class: 'live-image', alt: '' });
      clear(picture, img);
    }
    img.src = `/api/foundry/jobs/${jobId}/live/image?i=${live.shown}`;
    img.alt = `${name} as it is being built (picture ${live.shown + 1})`;
  }, 260);
}

function liveView(job) {
  live.jobId = job.jobId;
  live.scriptLength = 0;
  live.frames = 0;
  live.shown = -1;
  clearInterval(live.player);
  live.player = undefined;
  return h('section', { class: 'card live-card', 'aria-label': 'Live view' },
    h('div', { class: 'live-head' },
      h('span', { class: 'pulse', 'aria-hidden': 'true' }),
      h('h2', {}, 'Live'),
      h('span', { class: 'elapsed', id: 'live-elapsed' }, job.startedAt ? elapsed(job.startedAt) : 'Waiting for its turn…')),
    h('div', { class: 'live' },
      h('div', { class: 'stack' },
        h('ol', { class: 'live-steps', id: 'live-steps', 'aria-live': 'polite' }),
        h('span', { class: 'label', id: 'live-script-label' }, 'The script, as it is written'),
        h('pre', { class: 'live-script', id: 'live-script' }, h('span', { class: 'muted' }, 'Nothing written yet.'))),
      h('div', { id: 'live-picture' },
        h('div', { class: 'live-wait' }, h('p', {}, 'The model appears here as soon as Blender renders it.')))));
}

function paintSteps(job) {
  const list = document.querySelector('#live-steps');
  if (!list) return;
  const steps = job.progress ?? [];
  clear(list, steps.length
    ? steps.slice(-12).map((p, i, all) => h('li', { class: i === all.length - 1 ? 'now' : '' },
      h('time', {}, new Date(p.at).toLocaleTimeString()), h('span', {}, p.message)))
    : h('li', { class: 'now' }, h('span', {}, job.status === 'queued' ? 'Waiting for the build before it to finish…' : 'Starting…')));
}

async function followLive(main, job) {
  paintSteps(job);
  const hash = `#assets/build/${job.jobId}`;
  const tick = async () => {
    if (location.hash !== hash || live.jobId !== job.jobId) return;
    let current;
    let view;
    try {
      [current, view] = await Promise.all([
        api(`/api/foundry/jobs/${job.jobId}`).then((r) => r.job),
        api(`/api/foundry/jobs/${job.jobId}/live`),
      ]);
    } catch {
      state.poll = setTimeout(tick, 3000);
      return;
    }
    if (location.hash !== hash) return;
    if (current.status !== 'running' && current.status !== 'queued') {
      if (view?.frames) live.frames = view.frames;
      // Let the assembly finish playing, then open the finished model so it can be turned around.
      const waitForPlayer = () => {
        if (location.hash !== hash) return;
        if (live.player && live.shown < live.frames - 1) {
          state.poll = setTimeout(waitForPlayer, 300);
          return;
        }
        if (current.status === 'succeeded' && current.assetIds?.[0]) {
          toast(`${current.displayName ?? current.assetId} is ready. Drag it to turn it around.`);
          location.hash = `#assets/${encodeURIComponent(current.assetIds[0])}`;
          return;
        }
        loadData().then(() => renderJob(main, job.jobId));
      };
      if (view?.frames) playFrames(job.jobId, job.displayName ?? job.assetId);
      waitForPlayer();
      return;
    }
    paintSteps(current);
    const clock = document.querySelector('#live-elapsed');
    if (clock && current.startedAt) clock.textContent = elapsed(current.startedAt);
    const pre = document.querySelector('#live-script');
    if (pre && typeof view.script === 'string' && view.script.length !== live.scriptLength) {
      const stuck = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
      if (view.script.length < live.scriptLength) {
        const label = document.querySelector('#live-script-label');
        if (label) label.textContent = 'The script, as it is written (new attempt)';
      }
      live.scriptLength = view.script.length;
      clear(pre, view.script, h('span', { class: 'caret', 'aria-hidden': 'true' }));
      if (stuck) pre.scrollTop = pre.scrollHeight;
    }
    if (view.frames > live.frames) {
      live.frames = view.frames;
      playFrames(job.jobId, job.displayName ?? job.assetId);
    }
    state.poll = setTimeout(tick, 1000);
  };
  clearTimeout(state.poll);
  state.poll = setTimeout(tick, 600);
}

// ── Asset page ───────────────────────────────────────────────────────
async function renderDetail(main, assetId) {
  let detail;
  try {
    detail = await api(`/api/foundry/assets/${encodeURIComponent(assetId)}`);
  } catch {
    clear(main, h('div', { class: 'empty' }, h('p', {}, 'That asset was not found.'), h('a', { class: 'btn', href: '#assets' }, 'Back to assets')));
    return;
  }
  const asset = detail.asset;
  const name = assetName(asset);
  store.set({ context: `Assets › ${name}`, ref: { kind: 'asset', id: asset.assetId } });
  const files = asset.files ?? [];
  const renders = files.filter((f) => f.role === 'render').sort((a, b) => RENDER_ORDER.indexOf(a.name) - RENDER_ORDER.indexOf(b.name));
  const frames = files.filter((f) => f.role === 'frame');
  const spin = files.filter((f) => f.role === 'spin').sort((a, b) => a.name.localeCompare(b.name));
  const buildUp = files.filter((f) => f.role === 'build').sort((a, b) => a.name.localeCompare(b.name));
  const views = renders.length ? renders : asset.previewUrl ? [{ name: 'preview', url: asset.previewUrl }] : [];
  const hasScript = files.some((f) => f.role === 'script');
  const big = h('img', { class: 'view-main', src: views[0]?.url ?? '', alt: `${name}, ${viewLabel(views[0]?.name)} view`, hidden: !views.length });
  const viewButtons = views.map((v, i) => h('button', {
    type: 'button', class: `view-btn${i === 0 ? ' active' : ''}`, 'aria-pressed': i === 0 ? 'true' : 'false',
    onclick: (e) => {
      big.src = v.url;
      big.alt = `${name}, ${viewLabel(v.name)} view`;
      for (const b of e.currentTarget.parentElement.children) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-pressed', 'true');
    },
  }, h('img', { src: v.url, alt: '' }), h('span', {}, viewLabel(v.name))));

  const kind = KIND_LABEL[asset.type] ?? asset.type;
  const meta = [kind, asset.source ? `from ${asset.source}` : asset.model ? `made with ${asset.model}` : null, timeAgo(asset.createdAt)].filter(Boolean).join(' · ');
  const audioFile = AUDIO_KINDS.has(asset.type) ? files.find((f) => f.role === 'main') : undefined;

  clear(main,
    h('a', { class: 'btn quiet', href: '#assets' }, '← All assets'),
    h('header', { class: 'page-head' },
      h('div', {}, h('h1', { id: 'asset-title' }, name), h('p', { class: 'muted' }, meta), asset.prompt ? h('p', { class: 'quote' }, `“${asset.prompt}”`) : null),
      h('div', { class: 'row end' }, btn('Rename', () => rename(asset), 'quiet'))),
    asset.draftGroup ? h('section', { class: 'card note' },
      h('p', {}, 'This is one of several drafts. Keep the one you like; the others are tucked away (not deleted).'),
      action('Keep this one', async () => {
        await api(`/api/foundry/assets/${encodeURIComponent(asset.assetId)}/keep`, {});
        toast(`Kept ${name}. The other drafts are hidden.`);
        await renderDetail(main, asset.assetId);
      }, 'primary')) : null,
    h('div', { class: 'split' },
      h('section', { class: 'viewer', 'aria-label': 'Views' },
        audioFile
          ? h('div', { class: 'card' }, h('span', { class: 'label' }, 'Listen'), h('audio', { controls: true, preload: 'none', src: audioFile.url, class: 'audio' }))
          : spin.length >= 4 ? spinViewer(spin, buildUp, name)
          : views.length ? big : h('div', { class: 'view-main placeholder' }, h('p', { class: 'muted' },
            asset.generationProvider === 'imported' && asset.type === 'mesh_3d'
              ? 'A preview is being rendered in Blender — check back in a minute.'
              : 'No preview image for this asset.')),
        views.length > 1 && spin.length < 4 ? h('div', { class: 'view-row' }, viewButtons) : null,
        frames.length ? h('details', { class: 'card' }, h('summary', {}, `All ${frames.length} sprite directions`),
          h('div', { class: 'frames' }, frames.map((f) => h('img', { src: f.url, alt: f.name })))) : null),
      h('aside', { class: 'side' },
        hasScript || canContinue(asset, files) ? changeCard(asset, hasScript) : null,
        IMAGE_KINDS.has(asset.type) ? imageTo3dCard(asset) : null,
        sendCard(asset),
        downloadCard(files),
        versionsCard(detail.lineage ?? [], asset.assetId),
        h('section', { class: 'card' },
          action('Remove from library', async () => {
            await api(`/api/foundry/assets/${encodeURIComponent(asset.assetId)}/hide`, {});
            toast(`${name} removed from the library. Its files are still on disk.`);
            location.hash = '#assets';
          }, 'quiet danger')))));
}

/** Drag (or use the arrow keys) to turn the model; Replay shows it being assembled part by part. */
function spinViewer(spin, buildUp, name) {
  let index = Math.round(spin.length * 35 / 360) % spin.length;
  let timer;
  for (const f of [...spin, ...buildUp]) new window.Image().src = f.url;
  const img = h('img', { class: 'view-main spin-img', src: spin[index].url, alt: `${name}, turned to ${index * Math.round(360 / spin.length)}°`, draggable: 'false' });
  const show = (i) => {
    index = (i + spin.length) % spin.length;
    img.src = spin[index].url;
    img.alt = `${name}, turned to ${index * Math.round(360 / spin.length)}°`;
  };
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    turnBtn.setAttribute('aria-pressed', 'false');
    turnBtn.textContent = 'Turn';
  };
  const stage = h('div', { class: 'spin', tabindex: '0', role: 'img', 'aria-label': `${name}. Drag or use the arrow keys to turn it.` }, img);
  let dragX;
  let dragFrom = 0;
  stage.addEventListener('pointerdown', (e) => {
    stop();
    dragX = e.clientX;
    dragFrom = index;
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (dragX === undefined) return;
    show(dragFrom - Math.round((e.clientX - dragX) / 14));
  });
  const release = () => { dragX = undefined; };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stop();
      show(index + (e.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  const turnBtn = h('button', { type: 'button', class: 'btn small', 'aria-pressed': 'false', onclick: () => {
    if (timer) return stop();
    turnBtn.setAttribute('aria-pressed', 'true');
    turnBtn.textContent = 'Stop turning';
    timer = setInterval(() => show(index + 1), 90);
  } }, 'Turn');
  const replayBtn = buildUp.length ? h('button', { type: 'button', class: 'btn small', onclick: () => {
    stop();
    let step = 0;
    img.src = buildUp[0].url;
    img.alt = `${name} being built, part 1 of ${buildUp.length}`;
    timer = setInterval(() => {
      step += 1;
      if (step < buildUp.length) {
        img.src = buildUp[step].url;
        img.alt = `${name} being built, part ${step + 1} of ${buildUp.length}`;
        return;
      }
      clearInterval(timer);
      timer = undefined;
      show(index);
    }, 280);
  } }, 'Replay the build') : null;
  return h('div', { class: 'stack' }, stage,
    h('div', { class: 'row wrap spin-tools' }, h('span', { class: 'muted small' }, 'Drag to turn it'), turnBtn, replayBtn));
}

function viewLabel(fileName = '') {
  return fileName.replace(/^render_/, '').replace(/\.png$/, '').replace('_', '-').replace('three-quarter', '3/4') || 'preview';
}

/** 3D assets without a Blender Agent script can still be continued from their own .glb/.blend file. */
function canContinue(asset, files) {
  return asset.type === 'mesh_3d' && files.some((f) => /\.(glb|gltf|blend)$/i.test(f.name));
}

function changeCard(asset, hasScript) {
  const input = h('textarea', { id: 'change-it', class: 'field', rows: 3, placeholder: 'e.g. make it taller, add rust to the metal, paint the awning red' });
  const builders = state.data.builders;
  let builderId = (builders.find((b) => b.id === 'blender-agent-claude') ?? builders.find((b) => b.id === asset.generationProvider) ?? defaultBuilder())?.id;
  const picker = h('div');
  const paintPicker = () => clear(picker, builders.length > 1
    ? pills(builders.map((b) => ({ id: b.id, label: b.id === 'blender-agent-claude' ? 'Claude · best' : 'Local · free' })), builderId,
      (id) => { builderId = id; paintPicker(); }, 'Who does the work')
    : null);
  paintPicker();
  return h('section', { class: 'card form' },
    h('label', { for: 'change-it', class: 'label' }, hasScript ? 'Change it' : 'Keep working on it'),
    hasScript ? null : h('p', { class: 'muted small' }, 'Matterhorn opens this model in Blender and the AI changes it. The original stays as it is.'),
    input,
    picker,
    action('Make new version', async () => {
      const change = input.value.trim();
      if (!change) {
        input.focus();
        throw new Error('Describe what to change first.');
      }
      const builder = builders.find((b) => b.id === builderId) ?? defaultBuilder();
      if (!builder) throw new Error('No asset builder is available. Check Blender in Settings.');
      if (builder.requiresNetwork && !state.data.routing.allowNetworkProviders) {
        state.data.routing = await api('/api/studio/routing', { allowNetworkProviders: true }, 'PUT');
        toast('Online AI switched on so Claude can work. You can turn it off in Settings › Advanced.');
      }
      const base = asset.assetId.replace(/_v\d+$/, '');
      let version = Number(/_v(\d+)$/.exec(asset.assetId)?.[1] ?? 1) + 1;
      while (state.data.assets.some((a) => a.assetId === `${base}_v${version}`)) version += 1;
      await api('/api/foundry/jobs', {
        projectId: 'library', assetId: `${base}_v${version}`, kind: asset.type, operation: 'edit',
        prompt: change, parentAsset: asset.assetId, providerId: builder.id, allowNetwork: Boolean(builder.requiresNetwork),
        displayName: `${assetName(asset).replace(/ \(v\d+\)$/, '')} (v${version})`,
      });
      toast(`Making version ${version}. The current version stays in Versions.`);
      location.hash = '#assets';
    }, 'primary'));
}

const IMAGE_KINDS = new Set(['concept_art', 'texture', 'background', 'pixel_sprite']);
const VIEW_ORDER = ['front', 'left', 'side', 'right', 'back', 'three_quarter', '3_4', 'a_pose'];

function viewRank(asset) {
  const text = `${asset.displayName ?? ''} ${asset.assetId}`.toLowerCase().replace(/[\s-]+/g, '_');
  const index = VIEW_ORDER.findIndex((v) => text.includes(v));
  return index < 0 ? VIEW_ORDER.length : index;
}

/** Image-to-3D: this image (and other views from the same folder) become a textured 3D model. */
function imageTo3dCard(asset) {
  const meshy = state.data.meshy;
  const head = h('span', { class: 'label' }, 'Make a 3D model from this');
  if (!meshy?.available) {
    return h('section', { class: 'card' }, head,
      h('p', { class: 'muted small' }, 'Image-to-3D uses Meshy, a paid online service. Create a Meshy account, copy your API key, add MESHY_API_KEY=your-key to the .env file in the Matterhorn folder, and restart Matterhorn.'),
      h('a', { class: 'btn small', href: '#settings/guide' }, 'How to set it up'));
  }
  const siblings = state.data.assets
    .filter((a) => !a.hidden && IMAGE_KINDS.has(a.type) && a.source && a.source === asset.source)
    .sort((a, b) => viewRank(a) - viewRank(b) || a.assetId.localeCompare(b.assetId));
  const pool = [asset, ...siblings.filter((a) => a.assetId !== asset.assetId)].slice(0, 8);
  // Named views (front, left, back, 3/4) are picked for you; otherwise just this image.
  const named = pool.filter((a) => viewRank(a) < VIEW_ORDER.length && !/right|a_pose/.test(`${a.displayName} ${a.assetId}`.toLowerCase().replace(/[\s-]+/g, '_')));
  const chosen = new Set((named.length >= 2 ? named : [asset]).slice(0, 4).map((a) => a.assetId));
  const cost = meshy.estimatedCost?.amount ?? 30;
  const status = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const paintStatus = () => { status.textContent = `${chosen.size} of 4 views chosen. The first is used as the front.`; };
  const list = h('div', { class: 'list' }, pool.map((a) => {
    const box = h('input', { type: 'checkbox', checked: chosen.has(a.assetId), onchange: (e) => {
      if (e.currentTarget.checked && chosen.size >= 4) {
        e.currentTarget.checked = false;
        toast('Meshy takes up to 4 views.', 'error');
        return;
      }
      if (e.currentTarget.checked) chosen.add(a.assetId); else chosen.delete(a.assetId);
      paintStatus();
    } });
    return h('label', { class: 'check' }, box, a.previewUrl ? h('img', { class: 'thumb-xs', src: a.previewUrl, alt: '' }) : null, assetName(a));
  }));
  paintStatus();
  const nameInput = h('input', { id: 'i23-name', class: 'field', maxlength: 60, value: `${assetName(asset).replace(/\b(front|left|right|back|three quarter|a pose)\b/gi, '').trim() || 'Character'} 3D` });
  const approve = h('input', { type: 'checkbox', id: 'i23-approve' });
  return h('section', { class: 'card form' }, head,
    h('p', { class: 'muted small' }, 'Meshy builds a textured 3D model from up to 4 views of the same character (front, side, back, 3/4) in a relaxed A-pose. Afterwards you can keep working on it here with Blender.'),
    list, status,
    h('label', { for: 'i23-name', class: 'label' }, 'Name'), nameInput,
    h('label', { class: 'check' }, approve, ` Spend up to ${cost} Meshy credits (failed builds are refunded)`),
    action('Make 3D model', async () => {
      if (!chosen.size) throw new Error('Choose at least one view.');
      if (!approve.checked) {
        approve.focus();
        throw new Error('Tick the box to approve the Meshy credits first.');
      }
      const routing = state.data.routing;
      if (!routing.allowNetworkProviders || !routing.allowExternalCostProviders) {
        state.data.routing = await api('/api/studio/routing', { allowNetworkProviders: true, allowExternalCostProviders: true }, 'PUT');
        toast('Online and paid tools switched on for this build. You can turn them off in Settings › Advanced.');
      }
      const ordered = pool.filter((a) => chosen.has(a.assetId)).map((a) => a.assetId);
      const name = nameInput.value.trim() || '3D model';
      let assetId = `${slug(name)}_meshy`;
      for (let n = 2; state.data.assets.some((a) => a.assetId === assetId); n++) assetId = `${slug(name)}_meshy${n}`;
      const { job } = await api('/api/foundry/jobs', {
        projectId: 'library', assetId, kind: 'mesh_3d', operation: 'image_to_3d', referenceAssets: ordered,
        providerId: meshy.id, allowNetwork: true, approveExternalCost: true,
        maxCost: { currency: meshy.estimatedCost?.currency ?? 'MESHY_CREDITS', amount: cost },
        displayName: name,
      });
      toast(`Meshy is building “${name}”. This usually takes a few minutes.`);
      location.hash = `#assets/build/${encodeURIComponent(job.jobId)}`;
    }, 'primary'));
}

function sendCard(asset) {
  const origin = originOf(asset);
  const games = state.data.games.filter((g) => origin !== `game:${g.id}`);
  if (origin.startsWith('game:') && !games.length) {
    return h('section', { class: 'card' }, h('span', { class: 'label' }, 'Use it in a game'),
      h('p', { class: 'muted' }, `Already in ${state.data.games.find((g) => origin === `game:${g.id}`)?.name ?? 'your game'}.`));
  }
  if (!games.length) {
    return h('section', { class: 'card' }, h('span', { class: 'label' }, 'Use it in a game'),
      h('p', { class: 'muted' }, 'No game is set up yet.'), h('a', { class: 'btn', href: '#game' }, 'Set up a game'));
  }
  const select = h('select', { id: 'send-to', class: 'field' }, games.map((g) => h('option', { value: g.id, selected: g.id === store.gameId }, g.name)));
  return h('section', { class: 'card form' },
    h('label', { for: 'send-to', class: 'label' }, 'Use it in a game'),
    h('div', { class: 'row' }, select,
      action('Send', async () => {
        const sent = await api(`/api/foundry/assets/${encodeURIComponent(asset.assetId)}/send`, { projectId: select.value });
        toast(`Copied ${sent.files.length} file(s) to ${sent.folder} in ${select.selectedOptions[0].textContent}.`);
      })));
}

function downloadCard(files) {
  const wanted = files.filter((f) => ['main', 'source', 'script'].includes(f.role) || f.name.endsWith('.glb'));
  if (!wanted.length) return null;
  const label = (f) => f.name.endsWith('.glb') ? 'Model (.glb)' : f.name.endsWith('.blend') ? 'Blender file' : f.role === 'script' ? 'Build script' : f.name.endsWith('.png') ? 'Image (.png)' : f.name;
  const seen = new Set();
  return h('section', { class: 'card' },
    h('span', { class: 'label' }, 'Download'),
    h('div', { class: 'row wrap' }, wanted.filter((f) => !seen.has(f.name) && seen.add(f.name)).map((f) =>
      h('a', { class: 'btn small', href: f.url, download: f.name }, label(f)))));
}

function versionsCard(lineage, currentId) {
  const current = state.data.assets.find((a) => a.assetId === currentId);
  const chain = [...lineage].reverse();
  const children = state.data.assets.filter((a) => a.parentAsset === currentId && !a.hidden);
  const siblings = current?.generationProvider === 'imported'
    ? state.data.assets.filter((a) => !a.hidden && a.generationProvider === 'imported' && revisionKey(a) === revisionKey(current))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.assetId.localeCompare(a.assetId))
    : [];
  const items = siblings.length ? siblings : [...chain, ...children];
  if (items.length <= 1) return null;
  return h('section', { class: 'card' },
    h('span', { class: 'label' }, 'Versions'),
    h('div', { class: 'list' }, items.map((a) => a.assetId === currentId
      ? h('span', { class: 'version current', 'aria-current': 'true' }, `${assetName(a)} (this one)`)
      : h('a', { class: 'version', href: `#assets/${encodeURIComponent(a.assetId)}` }, assetName(a)))));
}

function rename(asset) {
  const title = document.querySelector('#asset-title');
  const input = h('input', { class: 'field title-input', value: assetName(asset), 'aria-label': 'Asset name', maxlength: 80 });
  const save = async () => {
    const value = input.value.trim();
    if (!value || value === assetName(asset)) return renderDetail(document.querySelector('#main'), asset.assetId);
    try {
      await api(`/api/foundry/assets/${encodeURIComponent(asset.assetId)}/rename`, { displayName: value });
      toast('Renamed.');
    } catch (error) {
      toast(error.message, 'error');
    }
    await loadData();
    renderDetail(document.querySelector('#main'), asset.assetId);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderDetail(document.querySelector('#main'), asset.assetId); });
  input.addEventListener('blur', save);
  title.replaceWith(input);
  input.focus();
  input.select();
}

// ── Make an asset ────────────────────────────────────────────────────
function defaultBuilder() {
  const { builders, routing } = state.data;
  return builders.find((b) => b.id === routing.assets) ?? builders.find((b) => b.local) ?? builders[0];
}

export async function openMake(prefill = {}) {
  if (!state.data) await loadData();
  const sheet = document.querySelector('#sheet');
  const form = { kind: 'mesh_3d', drafts: 1, builder: defaultBuilder()?.id, set: false };
  const desc = h('textarea', { id: 'make-desc', class: 'field', rows: 4, placeholder: 'a wooden market stall with a striped awning', value: prefill.prompt ?? '' });
  const name = h('input', { id: 'make-name', class: 'field', maxlength: 60, placeholder: 'Optional — e.g. Market stall', value: prefill.name ?? '' });
  const items = h('textarea', { id: 'make-items', class: 'field', rows: 4, placeholder: 'barrel\ntable: round wooden table with four legs\nstool' });
  const styleSelect = h('select', { id: 'make-style', class: 'field' },
    h('option', { value: '' }, 'No style'),
    state.data.styles.map((s) => h('option', { value: s.id }, s.name)));
  const dynamic = h('div', { class: 'form' });

  const paint = () => {
    const builder = state.data.builders.find((b) => b.id === form.builder);
    const needsNetwork = builder?.requiresNetwork && !state.data.routing.allowNetworkProviders;
    clear(dynamic,
      h('span', { class: 'label' }, 'Type'),
      pills([{ id: 'mesh_3d', label: '3D model' }, { id: 'sprite_sheet', label: 'Sprite sheet (8 directions)' }, { id: 'pixel_sprite', label: 'Pixel art' }],
        form.kind, (id) => { form.kind = id; paint(); }, 'Asset type'),
      h('span', { class: 'label' }, 'Who builds it'),
      state.data.builders.length
        ? pills(state.data.builders.map((b) => ({ id: b.id, label: b.id === 'blender-agent-claude' ? 'Claude · best quality' : 'Local · free' })),
          form.builder, (id) => { form.builder = id; paint(); }, 'Builder')
        : h('p', { class: 'error-text' }, 'No builder available — check Blender in Settings.'),
      h('p', { class: 'muted small' }, builder?.id === 'blender-agent-claude'
        ? 'Uses your Claude subscription. Handles multi-part objects well.'
        : 'Runs on this PC for free. Good for simple, single-shape props.'),
      needsNetwork ? h('div', { class: 'note row' }, h('span', {}, 'Claude runs online, which your safety settings currently block.'),
        action('Allow online AI', async () => {
          state.data.routing = await api('/api/studio/routing', { allowNetworkProviders: true }, 'PUT');
          toast('Online AI allowed. You can turn this off in Settings › Advanced.');
          paint();
        })) : null,
      form.set ? null : [h('span', { class: 'label' }, 'Drafts to choose from'),
        pills([1, 2, 4].map((n) => ({ id: n, label: String(n) })), form.drafts, (n) => { form.drafts = n; paint(); }, 'Number of drafts'),
        form.drafts > 1 ? h('p', { class: 'muted small' }, `${form.drafts} versions are built one after another; you keep the best.`) : null],
      h('label', { class: 'check', for: 'make-set' },
        h('input', { id: 'make-set', type: 'checkbox', checked: form.set, onchange: (e) => { form.set = e.target.checked; paint(); } }),
        h('span', {}, 'Make a matching set instead')),
      form.set ? [h('label', { for: 'make-items', class: 'label' }, 'Items, one per line (name: details)'), items,
        h('p', { class: 'muted small' }, 'The description above becomes the shared look for every item.')] : null,
    );
  };
  paint();

  const submit = action('Make it', async () => {
    const prompt = desc.value.trim();
    const builder = state.data.builders.find((b) => b.id === form.builder);
    if (!prompt) { desc.focus(); throw new Error('Describe the asset first.'); }
    if (!builder) throw new Error('No asset builder is available.');
    const base = slug(name.value.trim() || prompt);
    const suffix = Date.now().toString(36).slice(-4);
    const common = { projectId: 'library', kind: form.kind, operation: 'generate', providerId: builder.id, allowNetwork: Boolean(builder.requiresNetwork) };
    if (form.set) {
      const list = items.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
        const i = line.indexOf(':');
        return i > 0 ? { name: line.slice(0, i).trim(), prompt: line.slice(i + 1).trim() } : { name: line };
      });
      if (!list.length) { items.focus(); throw new Error('List at least one item.'); }
      const style = state.data.styles.find((s) => s.id === styleSelect.value);
      await api('/api/foundry/packs', { ...common, packId: `${base}_${suffix}`, style: style ? `${prompt}. ${style.description}` : prompt, items: list });
      toast(`Building a set of ${list.length}. Watch them appear in Assets.`);
    } else {
      const displayName = name.value.trim() || prompt.charAt(0).toUpperCase() + prompt.slice(1, 48);
      for (let n = 1; n <= form.drafts; n++) {
        await api('/api/foundry/jobs', {
          ...common,
          assetId: form.drafts > 1 ? `${base}_${suffix}_d${n}` : `${base}_${suffix}`,
          prompt, displayName,
          ...(form.drafts > 1 ? { draftGroup: `${base}_${suffix}` } : {}),
          ...(styleSelect.value ? { styleId: styleSelect.value } : {}),
        });
      }
      toast(form.drafts > 1 ? `Building ${form.drafts} drafts of ${displayName}.` : `Building ${displayName}.`);
    }
    closeSheet();
    location.hash = '#assets';
    if (document.querySelector('#asset-grid')) await refresh();
  }, 'primary wide');

  openSheet('Make an asset',
    h('div', { class: 'form' },
      h('label', { for: 'make-desc', class: 'label' }, 'Describe it'), desc,
      h('label', { for: 'make-name', class: 'label' }, 'Name'), name,
      h('label', { for: 'make-style', class: 'label' }, 'Style'),
      h('div', { class: 'row' }, styleSelect, btn('Manage styles', () => openStyles(), 'quiet small'))),
    dynamic,
    submit);
  desc.focus();
}

// ── Styles ───────────────────────────────────────────────────────────
async function openStyles() {
  const { styles } = await api('/api/foundry/styles');
  const nameInput = h('input', { id: 'style-name', class: 'field', maxlength: 60, placeholder: 'e.g. Calle' });
  const descInput = h('textarea', { id: 'style-desc', class: 'field', rows: 3, placeholder: 'e.g. Dominican street: warm pastel paint, weathered wood, chunky low-poly shapes' });
  openSheet('Styles',
    h('p', { class: 'muted' }, 'A style is a short description added to every asset that uses it, so things match.'),
    h('div', { class: 'list' }, styles.length ? styles.map((s) => h('div', { class: 'style-row' },
      h('div', {}, h('strong', {}, s.name), h('p', { class: 'muted small' }, s.description)),
      action('Delete', async () => {
        await api(`/api/foundry/styles/${s.id}/delete`, {});
        toast(`Deleted style ${s.name}.`);
        await loadData();
        openStyles();
      }, 'quiet small danger'))) : h('p', { class: 'muted' }, 'No styles yet.')),
    h('h3', {}, 'New style'),
    h('div', { class: 'form' },
      h('label', { for: 'style-name', class: 'label' }, 'Name'), nameInput,
      h('label', { for: 'style-desc', class: 'label' }, 'Look'), descInput,
      action('Save style', async () => {
        await api('/api/foundry/styles', { name: nameInput.value, description: descInput.value });
        toast('Style saved.');
        await loadData();
        openStyles();
      }, 'primary')));
}

// ── Side sheet ───────────────────────────────────────────────────────
export function openSheet(title, ...content) {
  const sheet = document.querySelector('#sheet');
  const panel = h('section', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
    h('div', { class: 'sheet-head' }, h('h2', { id: 'sheet-title' }, title), btn('✕', closeSheet, 'quiet', { 'aria-label': 'Close' })),
    content);
  clear(sheet, panel);
  sheet.hidden = false;
  sheet.onclick = (e) => { if (e.target === sheet) closeSheet(); };
  sheet.onkeydown = (e) => { if (e.key === 'Escape') closeSheet(); };
}

export function closeSheet() {
  const sheet = document.querySelector('#sheet');
  sheet.hidden = true;
  sheet.replaceChildren();
}
