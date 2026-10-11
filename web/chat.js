import { api, h, clear, store, toast } from './ui.js';

/**
 * Matterhorn chat: a floating window that stays open while you move around the app.
 * Drag it by its title bar, resize it from the corner, minimize it to a pill.
 * Asset questions come back as clickable results from the real library.
 */

const LOG_KEY = 'matterhorn.chat.log';
const UI_KEY = 'matterhorn.chat.ui';
const MAX_SAVED = 60;

let messages = [];
let ui = { open: false, minimized: false, dock: null, dockWidth: 400, left: null, top: null, width: null, height: null };

function load() {
  try {
    messages = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]');
    if (!Array.isArray(messages)) messages = [];
  } catch {
    messages = [];
  }
  try {
    ui = { ...ui, ...(JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') ?? {}) };
  } catch {
    // Defaults are fine.
  }
}

function save() {
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(messages.slice(-MAX_SAVED)));
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    // Storage may be unavailable; the chat still works for this page.
  }
}

const $ = (id) => document.querySelector(id);

/** Docked = a column at the right that the page makes room for; otherwise it floats. */
function docked() {
  return ui.dock ?? window.innerWidth >= 1100;
}

function apply() {
  const panel = $('#assistant');
  const pill = $('#chat-pill');
  panel.hidden = !ui.open || ui.minimized;
  pill.hidden = !ui.open || !ui.minimized;
  pill.classList.toggle('unread', Boolean(ui.minimized && ui.unread));
  const isDocked = docked() && !narrow();
  document.body.classList.toggle('chat-docked', isDocked && !panel.hidden);
  panel.classList.toggle('docked', isDocked);
  document.documentElement.style.setProperty('--chat-w', `${clamp(ui.dockWidth ?? 400, 300, Math.round(window.innerWidth * 0.5))}px`);
  const dockButton = $('#assistant-dock');
  dockButton.textContent = isDocked ? '⧉' : '⇥';
  dockButton.title = isDocked ? 'Float over the page' : 'Dock to the side';
  dockButton.setAttribute('aria-label', isDocked ? 'Float the chat over the page' : 'Dock the chat to the side');
  dockButton.hidden = narrow();
  if (isDocked) {
    for (const prop of ['left', 'top', 'right', 'bottom', 'width', 'height']) panel.style[prop] = '';
    return;
  }
  if (!narrow() && ui.left !== null && ui.top !== null) {
    panel.style.left = `${clamp(ui.left, 0, window.innerWidth - 120)}px`;
    panel.style.top = `${clamp(ui.top, 0, window.innerHeight - 60)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  } else {
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
  }
  if (!narrow() && ui.width && ui.height) {
    panel.style.width = `${ui.width}px`;
    panel.style.height = `${ui.height}px`;
  }
}

function narrow() {
  return window.innerWidth < 760;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function openChat() {
  ui.open = true;
  ui.minimized = false;
  ui.unread = false;
  save();
  apply();
  $('#assistant-input')?.focus();
}

function renderLog() {
  const log = $('#assistant-log');
  $('#assistant-clear').hidden = !messages.length;
  clear(log, messages.length
    ? messages.map(renderMessage)
    : h('div', { class: 'msg' },
      h('p', {}, 'Ask about anything in Matterhorn. Try:'),
      h('div', { class: 'suggestions' },
        ['Show me all my assets', 'Show the sounds in Yun', 'What is building right now?', 'How do I add a new game?']
          .map((text) => h('button', { type: 'button', class: 'chip-btn', onclick: () => send(text) }, text)))));
  log.scrollTop = log.scrollHeight;
}

function renderMessage(message) {
  if (message.role === 'user') return h('div', { class: 'msg me' }, message.text);
  const node = h('div', { class: `msg${message.error ? ' error' : ''}` }, h('p', {}, message.text));
  if (message.assets?.shown?.length) {
    node.append(h('div', { class: 'chat-assets' }, message.assets.shown.map((a) => h('a', {
      class: 'chat-asset', href: `#assets/${encodeURIComponent(a.assetId)}`, title: a.source ? `${a.name} — ${a.source}` : a.name,
    },
    a.previewUrl ? h('img', { src: a.previewUrl, alt: '', loading: 'lazy' }) : h('span', { class: 'chat-asset-kind' }, kindLabel(a.type)),
    h('span', { class: 'chat-asset-name' }, a.name)))));
  }
  if (message.job) node.append(jobCard(message));
  if (message.plan) node.append(planCard(message));
  if (message.needsDirtyConfirm) {
    node.append(h('button', { type: 'button', class: 'btn small', onclick: () => send(`plan anyway: ${message.needsDirtyConfirm.goal}`, { allowDirty: true, goal: message.needsDirtyConfirm.goal }) },
      'Plan anyway (my game has unsaved changes)'));
  }
  if (message.assets) {
    node.append(h('a', { class: 'btn small', href: message.assets.openHash },
      message.assets.total > (message.assets.shown?.length ?? 0) ? `Open all ${message.assets.total} in Assets` : 'Open in Assets'));
  }
  return node;
}

const STATUS_TEXT = { queued: 'Waiting…', running: 'Working…', succeeded: 'Done', failed: 'Couldn’t finish', cancelled: 'Cancelled' };

function jobCard(message) {
  const job = message.job;
  const status = job.status ?? 'queued';
  const card = h('div', { class: `chat-job ${status}` },
    h('div', { class: 'row spread' }, h('strong', {}, job.displayName ?? job.assetId), h('span', { class: `status ${status === 'succeeded' ? 'ok' : status === 'failed' ? 'bad' : 'active'}` }, STATUS_TEXT[status] ?? status)),
    job.progress ? h('span', { class: 'muted small' }, job.progress) : null,
    job.error ? h('span', { class: 'error-text small' }, job.error) : null,
    status === 'succeeded' && job.previewUrl ? h('a', { href: `#assets/${encodeURIComponent(job.assetId)}`, class: 'chat-job-preview' }, h('img', { src: job.previewUrl, alt: job.displayName ?? '' })) : null,
    h('div', { class: 'row' },
      status === 'succeeded'
        ? h('a', { class: 'btn small primary', href: `#assets/${encodeURIComponent(job.assetId)}` }, 'Open it')
        : h('a', { class: 'btn small', href: `#assets/build/${job.jobId}` }, status === 'failed' ? 'See why' : 'Watch'),
      status === 'queued' || status === 'running'
        ? h('button', { type: 'button', class: 'btn small quiet', onclick: async () => {
          try { await api(`/api/foundry/jobs/${job.jobId}/cancel`, {}); toast('Cancelled.'); } catch (error) { toast(error.message, 'error'); }
          followJobs();
        } }, 'Cancel')
        : null,
      status === 'failed' ? h('button', { type: 'button', class: 'btn small quiet', onclick: () => send('try again with Claude') }, 'Try again with Claude') : null));
  return card;
}

function planCard(message) {
  const plan = message.plan;
  return h('div', { class: 'chat-plan' },
    h('span', { class: 'label' }, `Plan for ${plan.game}`),
    h('ol', {}, plan.tasks.map((t) => h('li', {}, t))),
    plan.started
      ? h('a', { class: 'btn small', href: '#game/changes' }, 'Follow it in My Game')
      : h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small primary', onclick: async (event) => {
          event.currentTarget.disabled = true;
          try {
            await api('/api/studio/runs', plan.payload);
            plan.started = true;
            save();
            renderLog();
            toast(`Approved. Building in ${plan.game}.`);
          } catch (error) {
            event.currentTarget.disabled = false;
            toast(error.message, 'error');
          }
        } }, 'Approve & build'),
        h('a', { class: 'btn small quiet', href: '#studio' }, 'Change it in Studio')));
}

let followTimer;

/** Keeps build cards in the chat up to date until they finish. */
async function followJobs() {
  clearTimeout(followTimer);
  const open = messages.filter((m) => m.job && !['succeeded', 'failed', 'cancelled'].includes(m.job.status ?? 'queued'));
  if (!open.length) return;
  let changed = false;
  for (const message of open) {
    try {
      const { job } = await api(`/api/foundry/jobs/${message.job.jobId}`);
      const progress = job.progress?.at(-1)?.message;
      if (job.status !== message.job.status || progress !== message.job.progress) {
        message.job = { ...message.job, status: job.status, progress, ...(job.error ? { error: job.error.split('. Last: ').pop().slice(0, 240) } : {}) };
        if (job.status === 'succeeded') {
          const assetId = job.assetIds?.[0] ?? message.job.assetId;
          const detail = await api(`/api/foundry/assets/${encodeURIComponent(assetId)}`).catch(() => undefined);
          message.job = { ...message.job, assetId, ...(detail?.asset?.previewUrl ? { previewUrl: detail.asset.previewUrl } : {}) };
          if (ui.minimized) ui.unread = true;
          toast(`${message.job.displayName ?? 'Your asset'} is ready.`);
        }
        changed = true;
      }
    } catch {
      // Try again on the next tick.
    }
  }
  if (changed) {
    save();
    renderLog();
    apply();
  }
  followTimer = setTimeout(followJobs, 3000);
}

function kindLabel(type) {
  if (type?.startsWith('audio_')) return '♪';
  if (type === 'mesh_3d') return '3D';
  return 'IMG';
}

let busy = false;

async function send(text, extra = {}) {
  const input = $('#assistant-input');
  const message = (text ?? input.value).trim();
  if (busy) return;
  if (!message) {
    input.focus();
    toast('Type a message first.');
    return;
  }
  busy = true;
  $('#assistant-send').disabled = true;
  input.value = '';
  messages.push({ role: 'user', text: message });
  messages.push({ role: 'assistant', text: 'Thinking…', pending: true });
  renderLog();
  try {
    const history = messages.filter((m) => !m.pending && !m.error).slice(-12)
      .map((m) => ({ role: m.role, content: m.text }));
    const answer = extra.allowDirty
      ? await planAnyway(extra.goal)
      : await api('/api/assistant', { message, page: store.context, history, ...(store.ref ? { ref: store.ref } : {}) });
    messages[messages.length - 1] = {
      role: 'assistant', text: answer.reply,
      ...(answer.assets ? { assets: answer.assets } : {}),
      ...(answer.job ? { job: { ...answer.job, status: 'queued' } } : {}),
      ...(answer.plan ? { plan: answer.plan } : {}),
      ...(answer.needsDirtyConfirm ? { needsDirtyConfirm: answer.needsDirtyConfirm } : {}),
    };
    if (answer.job) followJobs();
    if (ui.minimized) ui.unread = true;
  } catch (error) {
    messages[messages.length - 1] = { role: 'assistant', text: `I couldn't answer: ${error?.message || error}. Your message is back in the box.`, error: true };
    input.value = message;
  } finally {
    busy = false;
    $('#assistant-send').disabled = false;
    save();
    renderLog();
    apply();
  }
}

async function planAnyway(goal) {
  const game = store.games.find((g) => g.id === store.gameId) ?? store.games[0];
  const payload = { projectId: game.id, goal, criteria: [], allowDirty: true };
  const plan = await api('/api/studio/plan', payload);
  return { reply: `Here's the plan for ${game.name}. Nothing changes until you approve it.`, plan: { goal: plan.goal, game: game.name, tasks: plan.tasks.map((t) => t.title), payload } };
}

function enableDrag(panel, handle) {
  let start;
  handle.addEventListener('pointerdown', (event) => {
    if (narrow() || docked() || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!start) return;
    ui.left = clamp(start.left + event.clientX - start.x, 0, window.innerWidth - 120);
    ui.top = clamp(start.top + event.clientY - start.y, 0, window.innerHeight - 60);
    apply();
  });
  const end = () => {
    if (!start) return;
    start = undefined;
    save();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    ui.left = null;
    ui.top = null;
    ui.width = null;
    ui.height = null;
    panel.style.width = '';
    panel.style.height = '';
    save();
    apply();
  });
  // Remember the size after the user resizes from the corner.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (panel.hidden || narrow()) return;
      const rect = panel.getBoundingClientRect();
      if (Math.abs((ui.width ?? 0) - rect.width) > 4 || Math.abs((ui.height ?? 0) - rect.height) > 4) {
        ui.width = Math.round(rect.width);
        ui.height = Math.round(rect.height);
        save();
      }
    }).observe(panel);
  }
}

export function initChat() {
  load();
  const panel = $('#assistant');
  const context = $('#assistant-context');
  store.listeners.add((state) => { context.textContent = state.context; });
  context.textContent = store.context;

  $('#assistant-toggle').addEventListener('click', () => {
    if (ui.open && !ui.minimized) {
      ui.minimized = true;
      save();
      apply();
    } else {
      openChat();
    }
  });
  $('#assistant-close').addEventListener('click', () => { ui.open = false; save(); apply(); });
  $('#assistant-min').addEventListener('click', () => { ui.minimized = true; save(); apply(); });
  $('#chat-pill').addEventListener('click', openChat);
  $('#assistant-dock').addEventListener('click', () => { ui.dock = !docked(); save(); apply(); });
  // Docked: drag the left edge to make the chat wider or narrower.
  const grip = $('#chat-grip');
  let gripStart;
  grip.addEventListener('pointerdown', (event) => {
    if (!docked()) return;
    gripStart = { x: event.clientX, width: ui.dockWidth ?? 400 };
    grip.setPointerCapture?.(event.pointerId);
  });
  grip.addEventListener('pointermove', (event) => {
    if (!gripStart) return;
    ui.dockWidth = clamp(gripStart.width + gripStart.x - event.clientX, 300, Math.round(window.innerWidth * 0.5));
    apply();
  });
  const gripEnd = () => { if (gripStart) { gripStart = undefined; save(); } };
  grip.addEventListener('pointerup', gripEnd);
  grip.addEventListener('pointercancel', gripEnd);
  $('#assistant-clear').addEventListener('click', () => { messages = []; save(); renderLog(); });
  $('#assistant-send').addEventListener('click', () => send());
  $('#assistant-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
    if (event.key === 'Escape') { ui.minimized = true; save(); apply(); }
  });
  enableDrag(panel, $('#chat-head'));
  window.addEventListener('resize', apply);
  renderLog();
  apply();
  followJobs();
}
