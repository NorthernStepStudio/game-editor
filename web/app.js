import { api, h, clear, btn, toast, store } from './ui.js';
import * as studioPage from './pageStudio.js';
import * as gamePage from './pageGame.js';
import * as assetsPage from './pageAssets.js';
import * as settingsPage from './pageSettings.js';
import { logo, logoPreference, svgText } from './brand.js';
import { initChat, openChat } from './chat.js';

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
    openChat();
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
  store.set({ context: pages[page].title, ref: undefined });
  const main = document.querySelector('#main');
  main.focus({ preventScroll: true });
  try {
    await pages[page].module.render(main, sub);
  } catch (error) {
    clear(main, h('div', { class: 'empty' }, h('p', {}, `This page could not load: ${error?.message || error}`), btn('Try again', route)));
  }
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

/** Draws the chosen logo in the sidebar and as the browser-tab icon. */
function paintBrand() {
  const pref = logoPreference();
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.replaceChildren();
    // The mark is SVG; the words are real text so they stay crisp at sidebar size.
    const mark = pref.style === 'tile'
      ? logo(pref.mark, 'tile', { layout: 'tile', title: 'Matterhorn' })
      : logo(pref.mark, pref.style, { layout: 'mark', title: 'Matterhorn' });
    mark.classList.add(pref.style === 'tile' ? 'brand-tile' : 'brand-mark');
    brand.append(mark, h('span', { class: 'brand-text' },
      h('span', { class: 'brand-word' }, 'MATTERHORN'),
      pref.tagline ? h('span', { class: 'brand-tag' }, 'IDEAS UNDER CONTROL') : null));
  }
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.append(icon);
  }
  icon.type = 'image/svg+xml';
  icon.href = `data:image/svg+xml,${encodeURIComponent(svgText(logo(pref.mark, 'tile', { layout: 'tile' })))}`;
}

/** The left menu can be hidden with a small button and brought back with another. */
function initNavToggle() {
  const KEY = 'matterhorn.navHidden';
  const applyNav = (hidden) => {
    document.body.classList.toggle('nav-hidden', hidden);
    // Truly hidden (not just invisible) so its controls cannot be reached while collapsed.
    document.querySelector('.sidebar').hidden = hidden && window.innerWidth >= 760;
    document.querySelector('#nav-expand').hidden = !hidden;
    try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch { /* storage optional */ }
  };
  let hidden = false;
  try { hidden = localStorage.getItem(KEY) === '1'; } catch { hidden = false; }
  applyNav(hidden);
  document.querySelector('#nav-collapse').addEventListener('click', () => applyNav(true));
  document.querySelector('#nav-expand').addEventListener('click', () => {
    applyNav(false);
    document.querySelector('#nav-collapse').focus();
  });
}

export async function start() {
  paintBrand();
  initNavToggle();
  window.addEventListener('matterhorn-logo', paintBrand);
  initChat();
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
