import { api, h, clear, btn, toast, store } from './ui.js';
import * as studioPage from './pageStudio.js';
import * as gamePage from './pageGame.js';
import * as assetsPage from './pageAssets.js';
import * as settingsPage from './pageSettings.js';

const pages = {
  studio: { title: 'Studio', module: studioPage },
  game: { title: 'My Game', module: gamePage },
  assets: { title: 'Assets', module: assetsPage },
  settings: { title: 'Settings', module: settingsPage },
};

// Old links keep working.
const legacy = {
  home: 'studio', create: 'assets', runs: 'game', pipeline: 'game', output: 'game',
  projects: 'game/files', validation: 'game/checks', evidence: 'game/checks', specialists: 'settings',
};

let current;

function parseRoute() {
  let hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'chat') {
    openAssistant();
    hash = '';
  }
  const [head, ...rest] = hash.split('/');
  if (legacy[head]) {
    location.replace(`#${legacy[head]}`);
    return null;
  }
  const page = pages[head] ? head : 'studio';
  return { page, sub: rest.map(decodeURIComponent).join('/') };
}

async function route() {
  const parsed = parseRoute();
  if (!parsed) return;
  const { page, sub } = parsed;
  for (const link of document.querySelectorAll('[data-nav]')) {
    const active = link.dataset.nav === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (current && current.page !== page) current.module.leave?.();
  current = { page, module: pages[page].module };
  document.title = `${pages[page].title} · Matterhorn`;
  store.set({ context: pages[page].title });
  const main = document.querySelector('#main');
  main.focus({ preventScroll: true });
  try {
    await pages[page].module.render(main, sub);
  } catch (error) {
    clear(main, h('div', { class: 'empty' }, h('p', {}, `This page could not load: ${error?.message || error}`), btn('Try again', route)));
  }
}

// ── Assistant ───────────────────────────────────────────────────────
const history = [];

function openAssistant() {
  document.querySelector('#assistant').hidden = false;
  document.querySelector('#assistant-input').focus();
}

function initAssistant() {
  const panel = document.querySelector('#assistant');
  const log = document.querySelector('#assistant-log');
  const input = document.querySelector('#assistant-input');
  const context = document.querySelector('#assistant-context');
  const send = document.querySelector('#assistant-send');
  store.listeners.add((state) => { context.textContent = `Looking at: ${state.context}`; });
  context.textContent = `Looking at: ${store.context}`;

  document.querySelector('#assistant-toggle').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  document.querySelector('#assistant-close').addEventListener('click', () => { panel.hidden = true; });

  const submit = async () => {
    const text = input.value.trim();
    if (!text || send.disabled) return;
    send.disabled = true;
    log.append(h('p', { class: 'msg me' }, text));
    const pending = h('p', { class: 'msg' }, 'Thinking…');
    log.append(pending);
    log.scrollTop = log.scrollHeight;
    input.value = '';
    try {
      const provider = localStorage.getItem('matterhorn.chatProvider') || undefined;
      const answer = await api('/ask', {
        prompt: `[The user is looking at: ${store.context}]\n${text}`,
        intent: 'ask',
        workspace: { name: 'Matterhorn' },
        history: history.slice(-12),
        ...(provider ? { _provider: provider } : {}),
      });
      pending.textContent = answer.response;
      history.push({ role: 'user', content: text }, { role: 'assistant', content: answer.response });
    } catch (error) {
      pending.textContent = `I couldn't answer: ${error?.message || error}. Your message is back in the box.`;
      pending.classList.add('error');
      input.value = text;
    } finally {
      send.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  };
  send.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
}

// ── Setup status in the sidebar ───────────────────────────────────────
async function refreshSetupStatus() {
  const target = document.querySelector('#setup-status');
  try {
    const connections = await settingsPage.checkConnections();
    const needed = connections.filter((c) => c.state === 'warn' || c.state === 'off' && c.required);
    clear(target,
      h('span', { class: `dot ${needed.length ? 'warn' : 'ok'}`, 'aria-hidden': 'true' }),
      needed.length ? `${needed.length} thing${needed.length > 1 ? 's' : ''} need${needed.length > 1 ? '' : 's'} setup` : 'All set');
  } catch {
    clear(target, h('span', { class: 'dot off', 'aria-hidden': 'true' }), 'Status unknown');
  }
}

async function loadGames() {
  try {
    const games = await api('/api/projects');
    const saved = localStorage.getItem('matterhorn.game');
    store.set({
      games,
      gameId: games.some((g) => g.id === saved) ? saved : games[0]?.id,
    });
  } catch {
    store.set({ games: [], gameId: undefined });
  }
}

export async function start() {
  initAssistant();
  window.addEventListener('hashchange', route);
  document.querySelector('#setup-status').addEventListener('click', async () => {
    if (location.hash !== '#settings') {
      location.hash = '#settings';
      return;
    }
    // Already on Settings: re-check everything and bring Connections into view.
    await route();
    refreshSetupStatus();
    document.querySelector('#connections')?.scrollIntoView?.({ block: 'start' });
  });
  // The skip link moves focus only; letting it change the hash would navigate away from the page.
  document.querySelector('.skip').addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('#main').focus();
  });
  await loadGames();
  await route();
  refreshSetupStatus();
  setInterval(refreshSetupStatus, 60000);
}

window.matterhornToast = toast;
start();
