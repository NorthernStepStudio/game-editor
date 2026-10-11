import { api, tryApi, h, clear, btn, action, steps, toast, timeAgo, store } from './ui.js';
import { openSheet, closeSheet } from './pageAssets.js';

const TABS = [
  { id: 'changes', label: 'Changes' },
  { id: 'checks', label: 'Checks' },
  { id: 'files', label: 'Files' },
];
const VALIDATE_GOAL = 'Check the project: open it in Godot, compile the scripts, run its scenarios and a playtest. Change nothing.';
const VALIDATE_CRITERIA = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass'];

const state = { tab: 'changes', runId: undefined, play: undefined, poll: undefined, file: undefined, fileQuery: '' };

export function leave() {
  clearTimeout(state.poll);
}

function game() {
  return store.games.find((g) => g.id === store.gameId) ?? store.games[0];
}

export async function render(main, sub = '') {
  clearTimeout(state.poll);
  const [tab, runId] = sub.split('/');
  state.tab = TABS.some((t) => t.id === tab) ? tab : 'changes';
  state.runId = runId;
  const current = game();
  if (!current) return renderNoGame(main);
  store.set({ context: `My Game › ${current.name}` });

  const picker = h('select', { id: 'game-pick', class: 'field title-select', 'aria-label': 'Game', onchange: (e) => {
    if (e.target.value === '__add') {
      e.target.value = current.id;
      return openAddGame();
    }
    localStorage.setItem('matterhorn.game', e.target.value);
    store.set({ gameId: e.target.value });
    render(main, state.tab);
  } },
  store.games.map((g) => h('option', { value: g.id, selected: g.id === current.id }, g.name)),
  h('option', { value: '__add' }, '+ Add a game…'));

  clear(main,
    h('header', { class: 'page-head' },
      h('div', { class: 'stack' }, h('label', { for: 'game-pick', class: 'label' }, 'Game'), picker),
      h('div', { class: 'row end wrap', id: 'game-actions' })),
    h('nav', { class: 'tabs', 'aria-label': 'Game sections' },
      TABS.map((t) => h('a', { href: `#game/${t.id}`, class: `tab${t.id === state.tab ? ' active' : ''}`, 'aria-current': t.id === state.tab ? 'page' : undefined }, t.label))),
    h('div', { id: 'game-body' }, h('p', { class: 'muted' }, 'Loading…')));
  paintActions(current);
  if (state.tab === 'changes') await renderChanges(current);
  else if (state.tab === 'checks') await renderChecks(current);
  else await renderFiles(current);
}

function renderNoGame(main) {
  clear(main,
    h('header', { class: 'page-head stack' }, h('h1', {}, 'My Game'),
      h('p', { class: 'muted' }, 'Matterhorn changes, checks and plays Godot projects. Add yours to get started.')),
    h('div', { class: 'empty' }, h('p', {}, 'No game is set up yet.'), btn('+ Add a game', openAddGame, 'primary')));
}

function paintActions(current) {
  const host = document.querySelector('#game-actions');
  if (!host) return;
  clear(host,
    state.play
      ? action('Stop the game', async () => {
        await api('/api/studio/play/stop', { runtimeSessionId: state.play });
        state.play = undefined;
        toast('Game stopped.');
        paintActions(current);
      })
      : action('▶ Play in Godot', async () => {
        const result = await api('/api/studio/play', { projectId: current.id });
        state.play = result.runtimeSessionId;
        toast(`${current.name} is opening in a Godot window.`);
        paintActions(current);
      }, 'primary'),
    action('Run checks', async () => {
      const run = await api('/api/studio/runs', { projectId: current.id, goal: VALIDATE_GOAL, criteria: VALIDATE_CRITERIA });
      toast('Checking the game in Godot. Results appear under Changes and Checks.');
      location.hash = `#game/changes/${run.id}`;
    }));
}

// ── Changes ─────────────────────────────────────────────────────────
function belongsTo(run, current) {
  const artifacts = run.plan.tasks.flatMap((t) => t.inputArtifacts ?? []);
  const project = artifacts.find((a) => a.kind === 'godot-project');
  return !project || project.label === current.name;
}

const STATUS_TEXT = {
  queued: 'Waiting', running: 'Building', validating: 'Checking', 'cancel-requested': 'Cancelling',
  cancelled: 'Cancelled', failed: 'Failed', blocked: 'Blocked',
};

async function renderChanges(current) {
  const body = document.querySelector('#game-body');
  const runs = ((await tryApi('/api/studio/runs')) ?? []).filter((r) => belongsTo(r, current));
  if (!runs.length) {
    clear(body, h('div', { class: 'empty' },
      h('p', {}, `No changes to ${current.name} yet. Describe one in Studio — you approve the plan before anything changes.`),
      h('a', { class: 'btn primary', href: '#studio' }, 'Describe a change')));
    return;
  }
  const focus = runs.find((r) => r.id === state.runId) ?? runs[0];
  const promotions = new Map(await Promise.all(runs.filter((r) => r.status === 'completed').slice(0, 10)
    .map(async (r) => [r.id, await tryApi(`/api/studio/runs/${r.id}/promotion`)])));
  clear(body, h('div', { class: 'list gap' }, runs.slice(0, 20).map((run) => changeCard(run, run.id === focus.id, promotions.get(run.id), current))));
  if (runs.some((r) => !['completed', 'failed', 'blocked', 'cancelled'].includes(r.status))) {
    state.poll = setTimeout(() => { if (document.querySelector('#game-body') && state.tab === 'changes') renderChanges(current); }, 4000);
  }
}

function changeCard(run, open, promotion, current) {
  const approved = promotion?.state === 'approved';
  const bad = run.status === 'failed' || run.status === 'blocked';
  const done = { queued: 1, running: 1, 'cancel-requested': 1, validating: 2, completed: approved ? 4 : 3, failed: 1, blocked: 1, cancelled: 1 }[run.status] ?? 1;
  const statusText = run.status === 'completed' ? (approved ? 'Kept' : 'Waiting for your OK') : STATUS_TEXT[run.status] ?? run.status;
  const details = h('div', { class: 'change-details', hidden: !open });
  if (open) fillDetails(details, run);
  const toggle = btn(open ? 'Hide details' : 'What changed', () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? 'What changed' : 'Hide details';
    if (!details.hidden && !details.childElementCount) fillDetails(details, run);
  });

  return h('article', { class: `card change${bad ? ' bad' : ''}`, id: `run-${run.id}` },
    h('div', { class: 'row spread wrap' },
      h('h2', {}, run.plan.goal),
      h('span', { class: `status ${bad ? 'bad' : run.status === 'completed' ? (approved ? 'ok' : 'warn') : 'active'}` }, statusText)),
    steps(['Plan', 'Build', 'Check', 'Your OK'], done, bad ? 'bad' : run.status === 'completed' && !approved ? 'warn' : 'active'),
    h('p', { class: 'muted small' }, `Started ${timeAgo(run.createdAt)}${run.detail ? ` · ${run.detail}` : ''}`),
    details,
    h('div', { class: 'row wrap' },
      run.status === 'completed' && !approved && promotion
        ? action('Approve & keep', async () => {
          if (!window.confirm(`Keep “${run.plan.goal}” in ${current.name}?`)) return;
          await api(`/api/studio/runs/${run.id}/promotion/approve`, { confirmation: 'APPROVE' });
          toast('Kept. It is approved for release.');
          renderChanges(current);
        }, 'primary') : null,
      approved ? action('Withdraw approval', async () => {
        await api(`/api/studio/runs/${run.id}/promotion/revoke`, {});
        toast('Approval withdrawn.');
        renderChanges(current);
      }, 'quiet') : null,
      toggle,
      !['completed', 'failed', 'blocked', 'cancelled'].includes(run.status)
        ? action('Cancel', async () => { await api(`/api/studio/runs/${run.id}/cancel`, {}); toast('Cancel requested.'); renderChanges(current); }, 'quiet')
        : null,
      bad || run.status === 'cancelled' ? action('Try again', async () => {
        const again = await api('/api/studio/runs', { projectId: current.id, goal: run.plan.goal, criteria: [...(run.plan.finalAcceptanceCriteria ?? [])] });
        toast('Started again.');
        location.hash = `#game/changes/${again.id}`;
      }) : null,
      run.status === 'completed' ? h('a', { class: 'btn quiet', href: `/api/studio/runs/${run.id}/evidence`, download: `evidence-${run.id.slice(0, 8)}.json` }, 'Download proof') : null));
}

function fillDetails(host, run) {
  const results = run.tasks.map((t) => ({ task: run.plan.tasks.find((p) => p.id === t.id), run: t })).filter((x) => x.task);
  const summaries = results.map((x) => x.run.result?.summary ?? x.run.detail).filter(Boolean);
  const criteria = results.flatMap((x) => x.run.result?.criterionResults ?? []);
  const evidence = results.flatMap((x) => x.run.result?.evidence ?? []);
  const files = results.flatMap((x) => x.run.result?.artifacts ?? []).filter((a) => a.uri);
  clear(host,
    h('div', { class: 'explain' },
      h('span', { class: 'label' }, 'What changed and why'),
      summaries.length ? summaries.map((s) => h('p', {}, s)) : h('p', { class: 'muted' }, 'No summary yet — it appears when the build finishes.')),
    criteria.length ? h('div', {}, h('span', { class: 'label' }, 'Checks'),
      h('ul', { class: 'checks' }, criteria.map((c) => h('li', { class: c.outcome }, h('span', { class: 'outcome' }, outcomeText(c.outcome)), c.description ?? c.criterionId ?? 'Check')))) : null,
    evidence.length ? h('details', {}, h('summary', {}, `Evidence (${evidence.length})`),
      h('ul', { class: 'checks' }, evidence.map((e) => h('li', { class: e.outcome ?? 'unknown' }, h('span', { class: 'outcome' }, outcomeText(e.outcome)), e.summary)))) : null,
    files.length ? h('details', {}, h('summary', {}, `Files and artifacts (${files.length})`),
      h('ul', {}, files.map((f) => h('li', { class: 'mono small' }, f.label ? `${f.label} — ${f.uri}` : f.uri)))) : null);
}

function outcomeText(outcome) {
  return { passed: 'Passed', failed: 'Failed', blocked: 'Blocked' }[outcome] ?? 'Unknown';
}

// ── Checks ──────────────────────────────────────────────────────────
async function renderChecks(current) {
  const body = document.querySelector('#game-body');
  const [runs, validations] = await Promise.all([
    tryApi('/api/studio/runs'),
    tryApi(`/api/workspace/validations?${new URLSearchParams({ projectId: current.id })}`),
  ]);
  const checked = (runs ?? []).filter((r) => belongsTo(r, current) && r.tasks.some((t) => t.result?.criterionResults?.length));
  const latest = checked[0];
  const criteria = latest ? latest.tasks.flatMap((t) => t.result?.criterionResults ?? []) : [];
  const tasks = Array.isArray(validations) ? validations : [];
  clear(body,
    h('section', { class: 'card' },
      h('div', { class: 'row spread wrap' },
        h('h2', {}, latest ? `Last check · ${timeAgo(latest.updatedAt)}` : 'No checks yet'),
        action('Run checks now', async () => {
          const run = await api('/api/studio/runs', { projectId: current.id, goal: VALIDATE_GOAL, criteria: VALIDATE_CRITERIA });
          toast('Checking in Godot…');
          location.hash = `#game/changes/${run.id}`;
        }, 'primary')),
      criteria.length
        ? h('ul', { class: 'checks big' }, criteria.map((c) => h('li', { class: c.outcome }, h('span', { class: 'outcome' }, outcomeText(c.outcome)), c.description ?? c.criterionId ?? 'Check')))
        : h('p', { class: 'muted' }, 'Run checks to open the game in Godot, compile scripts, run scenarios and play a round.')),
    tasks.length ? h('section', { class: 'card' },
      h('h2', {}, 'Project checks'),
      h('p', { class: 'muted' }, 'Checks configured for this project. They run on this PC and report their real output.'),
      h('div', { class: 'list' }, tasks.map((task) => {
        const out = h('pre', { class: 'output', hidden: true });
        return h('div', { class: 'check-row' },
          h('div', { class: 'row spread wrap' },
            h('strong', {}, task.name ?? task.id),
            action('Run', async () => {
              out.hidden = false;
              out.textContent = 'Running…';
              const result = await api('/api/workspace/validate', { projectId: current.id, id: task.id });
              const verdict = { passed: 'Passed', failed: 'Failed', 'timed-out': 'Timed out' }[result.status] ?? result.status;
              out.textContent = [`${verdict} in ${(result.durationMs / 1000).toFixed(1)} s${result.exitCode !== null ? ` (exit ${result.exitCode})` : ''}`,
                result.detail, result.stdout, result.stderr].filter(Boolean).join('\n').trim();
            }, 'small')),
          out);
      }))) : null);
}

// ── Files ───────────────────────────────────────────────────────────
async function renderFiles(current) {
  const body = document.querySelector('#game-body');
  const q = (params) => new URLSearchParams({ projectId: current.id, ...params }).toString();
  const listing = await api(`/api/workspace/files?${q({})}`);
  const all = listing.files ?? [];
  const filter = h('input', { id: 'file-filter', class: 'field', type: 'search', placeholder: 'Filter files', value: state.fileQuery,
    oninput: (e) => { state.fileQuery = e.target.value.toLowerCase(); paintList(); } });
  const list = h('nav', { class: 'file-list', 'aria-label': 'Files' });
  const viewer = h('section', { class: 'card file-view', 'aria-live': 'polite' }, h('p', { class: 'muted' }, 'Choose a file to read it, have it explained, or ask for an edit.'));

  const paintList = () => {
    const shown = all.filter((p) => p.toLowerCase().includes(state.fileQuery)).slice(0, 400);
    clear(list, shown.map((path) => h('button', { type: 'button', class: `file${path === state.file ? ' active' : ''}`, onclick: () => openFile(path) }, path)),
      all.length > shown.length && !state.fileQuery ? h('p', { class: 'muted small' }, `Showing ${shown.length} of ${all.length}. Filter to find more.`) : null);
  };

  const openFile = async (path) => {
    state.file = path;
    paintList();
    const file = await api(`/api/workspace/file?${q({ path })}`);
    const answer = h('div', { class: 'explain', hidden: true });
    const request = h('textarea', { id: 'edit-request', class: 'field', rows: 2, placeholder: 'What should change in this file?' });
    clear(viewer,
      h('div', { class: 'row spread wrap' }, h('strong', { class: 'mono' }, file.path),
        h('div', { class: 'row' },
          action('Explain', async () => {
            answer.hidden = false;
            answer.textContent = 'Reading the file…';
            const result = await api('/api/workspace/assist', { projectId: current.id, path: file.path, version: file.version, intent: 'explain', prompt: '' });
            answer.textContent = result.response;
          }))),
      h('pre', { class: 'code' }, file.content),
      answer,
      h('div', { class: 'form' },
        h('label', { for: 'edit-request', class: 'label' }, 'Suggest an edit'), request,
        action('Propose the edit', async () => {
          if (!request.value.trim()) { request.focus(); throw new Error('Describe the edit first.'); }
          answer.hidden = false;
          answer.textContent = 'Writing a proposal — nothing changes until you apply it…';
          const result = await api('/api/workspace/assist', { projectId: current.id, path: file.path, version: file.version, intent: 'propose', prompt: request.value });
          if (!result.review) {
            answer.textContent = `${result.response}\n\nNo concrete edit was returned. Nothing was changed.`;
            return;
          }
          showReview(result.review, answer);
        })));
  };

  const showReview = (review, host) => {
    clear(host,
      h('span', { class: 'label' }, review.status === 'pending' ? 'Proposed edit — not applied yet' : `Edit ${review.status}`),
      h('div', { class: 'diff' },
        h('div', {}, h('span', { class: 'label' }, 'Before'), h('pre', { class: 'code' }, review.before)),
        h('div', {}, h('span', { class: 'label' }, 'After'), h('pre', { class: 'code' }, review.after))),
      h('div', { class: 'row' },
        review.status === 'pending' ? [
          action('Apply', async () => { const r = await api('/api/workspace/apply', { id: review.id }); toast('Applied.'); showReview(r, host); }, 'primary'),
          action('Discard', async () => { const r = await api('/api/workspace/reject', { id: review.id }); toast('Discarded.'); showReview(r, host); }, 'quiet')]
          : review.status === 'applied' ? action('Undo this edit', async () => { const r = await api('/api/workspace/restore', { id: review.id }); toast('Original file restored.'); showReview(r, host); }) : null));
  };

  clear(body, h('div', { class: 'files' }, h('div', { class: 'file-side' }, h('label', { for: 'file-filter', class: 'sr-only' }, 'Filter files'), filter, list), viewer));
  paintList();
  if (state.file && all.includes(state.file)) openFile(state.file);
}

// ── Add a game ──────────────────────────────────────────────────────
function openAddGame() {
  const name = h('input', { id: 'game-name', class: 'field', maxlength: 60, placeholder: 'e.g. Yun' });
  const path = h('input', { id: 'game-path', class: 'field', placeholder: 'e.g. D:\\dev\\MyGame (the folder with project.godot)' });
  openSheet('Add a game',
    h('div', { class: 'form' },
      h('label', { for: 'game-name', class: 'label' }, 'Name'), name,
      h('label', { for: 'game-path', class: 'label' }, 'Godot project folder'), path,
      h('p', { class: 'muted small' }, 'Tip: in Explorer, open the folder, click the address bar and copy the path.'),
      action('Add game', async () => {
        const added = await api('/api/projects', { name: name.value, path: path.value });
        const games = await api('/api/projects');
        localStorage.setItem('matterhorn.game', added.id);
        store.set({ games, gameId: added.id });
        closeSheet();
        toast(`${added.name} added.`);
        render(document.querySelector('#main'), 'changes');
      }, 'primary')));
  name.focus();
}
