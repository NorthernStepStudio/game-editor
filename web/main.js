import { initWorkspace } from './workspace.js';
import { api, notice, clearNotice } from './api.js';
import { initStudio, loadProjects, refreshRuns } from './studio.js';
import { initChat } from './chat.js';
import { initSpecialists, loadSpecialists } from './specialists.js';
import { initAssets, loadAssets, loadAssetProviders } from './assets.js';
import { initRoutingPreferences, loadRoutingPreferences } from './routing.js';
import { loadCompletionScorecard } from './completion.js';
import { initMotionStudio } from './motionStudio.js';

import { initCharacterWorkbench, setWorkbenchMode } from './characterWorkbench.js';
import { loadStudioStack } from './studioStack.js';

const routeMap = {
  home: 'home',
  studio: 'home',
  create: 'create-page',
  runs: 'runs-page',
  pipeline: 'runs-page',
  output: 'runs-page',
  projects: 'projects',
  assets: 'assets-page',
  validation: 'validation',
  evidence: 'validation',
  settings: 'settings',
  specialists: 'settings',
};

const titleMap = {
  home: 'Home',
  studio: 'Home',
  create: 'Create / Character Studio',
  runs: 'Runs',
  pipeline: 'Runs',
  output: 'Runs',
  projects: 'Projects',
  assets: 'Assets',
  validation: 'Validation',
  evidence: 'Validation',
  settings: 'Settings',
  specialists: 'Settings / Specialists',
};

function updateSidebarSelection(hash) {
  const normalized =
    hash.startsWith('characters/') || hash === 'create' ? 'create' :
    hash === 'studio' ? 'home' :
    ['pipeline', 'output'].includes(hash) ? 'runs' :
    hash === 'evidence' ? 'validation' : hash;

  for (const link of document.querySelectorAll('.sidebar-nav a')) {
    const selected = link.getAttribute('href') === `#${normalized}`;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function route() {
  const hash = location.hash.slice(1) || 'home';

  if (hash === 'chat') {
    openAssistant();
    location.hash = '#home';
    return;
  }

  let pageId = routeMap[hash];
  let workbenchMode = 'model3d';

  if (!pageId) {
    if (hash.startsWith('characters/')) {
      pageId = 'create-page';
      if (hash.includes('/refine')) workbenchMode = 'refine';
      else if (hash.includes('/motion')) workbenchMode = 'motion';
      else if (hash.includes('/art2d')) workbenchMode = 'art2d';
      else if (hash.includes('/game-preview')) workbenchMode = 'game-preview';
      else if (hash.includes('/model3d')) workbenchMode = 'model3d';
      else workbenchMode = 'characters';
    } else {
      pageId = 'home';
    }
  }

  if (pageId !== 'assets-page') closeAssetDrawers();
  for (const page of document.querySelectorAll('.page')) {
    page.hidden = page.id !== pageId;
  }

  updateSidebarSelection(hash);
  const breadcrumb = document.querySelector('#breadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent =
      hash.startsWith('characters/')
        ? `Create / Character Studio / ${workbenchMode.toUpperCase()}`
        : titleMap[hash] || 'Home';
  }

  if (pageId === 'create-page') {
    setWorkbenchMode(workbenchMode);
  }

  if (pageId === 'validation') refreshRuns().catch(notice);
  if (pageId === 'runs-page') refreshRuns().catch(notice);
  if (hash === 'specialists') switchPanel('settings', 'advanced');
}

function switchPanel(group, target) {
  const buttonSelector = `[data-${group}-tab]`;
  for (const button of document.querySelectorAll(buttonSelector)) {
    button.classList.toggle('active', button.dataset[`${group}Tab`] === target);
  }
  for (const panel of document.querySelectorAll(`#${group}-tab-${target}, [id^="${group}-tab-"]`)) {
    if (panel.id?.startsWith(`${group}-tab-`)) panel.hidden = panel.id !== `${group}-tab-${target}`;
  }
}

function initInternalTabs() {
  for (const button of document.querySelectorAll('[data-settings-tab]')) {
    button.onclick = () => switchPanel('settings', button.dataset.settingsTab);
  }
  for (const button of document.querySelectorAll('[data-project-tab]')) {
    button.onclick = () => switchPanel('project', button.dataset.projectTab);
  }
}

function openAssistant() {
  const drawer = document.querySelector('#chat-drawer');
  if (drawer) drawer.hidden = false;
}
function closeAssistant() {
  const drawer = document.querySelector('#chat-drawer');
  if (drawer) drawer.hidden = true;
}

function closeAssetDrawers() {
  const generator = document.querySelector('#asset-generator');
  const inspector = document.querySelector('#asset-inspector');
  if (generator) generator.hidden = true;
  if (inspector) inspector.hidden = true;
}

function initValidationFilters() {
  for (const button of document.querySelectorAll('[data-validation-filter]')) {
    button.onclick = () => {
      const filter = button.dataset.validationFilter;
      for (const peer of document.querySelectorAll('[data-validation-filter]')) {
        peer.classList.toggle('active', peer === button);
      }
      for (const card of document.querySelectorAll('[data-validation-state]')) {
        card.hidden = filter !== 'all' && card.dataset.validationState !== filter;
      }
    };
  }
}

function initDrawers() {
  document.querySelector('#assistant-toggle')?.addEventListener('click', openAssistant);
  document.querySelector('#assistant-close')?.addEventListener('click', closeAssistant);

  const assetDrawer = document.querySelector('#asset-generator');
  document.querySelector('#open-asset-generator')?.addEventListener('click', () => {
    if (assetDrawer) assetDrawer.hidden = false;
  });
  document.querySelector('#close-asset-generator')?.addEventListener('click', () => {
    if (assetDrawer) assetDrawer.hidden = true;
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeAssistant();
    closeAssetDrawers();
  });
}

function initQuickActions() {
  for (const button of document.querySelectorAll('[data-goal-prefix]')) {
    button.onclick = () => {
      const goal = document.querySelector('#goal');
      if (!goal) return;
      const prefix = button.dataset.goalPrefix || '';
      if (!goal.value.trim()) goal.value = prefix;
      goal.focus();
      goal.setSelectionRange(goal.value.length, goal.value.length);
    };
  }
}

async function health() {
  const [server, daemon] = await Promise.all([api('/health'), api('/api/studio/health')]);
  const connection = document.querySelector('#connection');
  connection.textContent = daemon.available ? 'System Ready' : `Connected · ${server.mode === 'mock' ? 'mock' : server.mode}`;
  connection.classList.toggle('connected', daemon.available);

  const systemState = document.querySelector('#system-state');
  if (systemState) {
    systemState.innerHTML = daemon.available
      ? '<span class="dot live"></span> System ready'
      : '<span class="dot"></span> Flyrail offline';
  }

  const godotAi = daemon.executionBackends?.godotAi;
  const codex = daemon.executionBackends?.codex;
  document.querySelector('#daemon-detail').textContent = daemon.available
    ? `Flyrail connected (${daemon.version}) · Godot AI ${godotAi?.configured ? 'configured' : 'not configured'}${godotAi?.pluginInstalled ? ' + plugin detected' : ''} · Codex ${codex?.configured ? 'ready' : 'not configured'} · Sentinel active.`
    : 'Flyrail is offline. Start the daemon on this PC and check its server-side configuration.';
  clearNotice();
}

async function runtimeCapabilities() {
  const capabilities = await api('/api/studio/runtime');
  const container = document.querySelector('#runtime-capabilities');
  if (!container) return;
  container.replaceChildren();

  for (const capability of capabilities) {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const identity = document.createElement('div');
    identity.className = 'runtime-identity';
    const name = document.createElement('strong');
    name.className = 'setting-label';
    name.textContent = capability.title;
    identity.append(name);

    const state = document.createElement('span');
    state.className = 'status-badge';
    state.textContent = capability.state === 'ready'
      ? 'Ready'
      : capability.state === 'degraded'
        ? 'Needs attention'
        : 'Not configured';
    if (capability.state === 'ready') state.classList.add('connected');

    row.append(identity, state);
    container.append(row);
  }
}

async function providers() {
  const data = await api('/providers');
  const select = document.querySelector('#provider');
  select.replaceChildren();
  for (const provider of data.providers) {
    const option = new Option(`${provider.label}${provider.available ? '' : ' — setup required'}`, provider.id);
    option.disabled = !provider.available;
    select.add(option);
  }
  select.value = data.current;
  const describe = () => {
    const provider = data.providers.find(candidate => candidate.id === select.value);
    document.querySelector('#provider-detail').textContent =
      `${provider?.model || select.value}. ${select.value === 'mock' ? 'Mock responses do not execute or validate work.' : 'Provider credentials are configured on the server.'}`;
  };
  select.onchange = describe;
  describe();
}

initStudio();
initChat();
initWorkspace();
initSpecialists();
initAssets();
initMotionStudio();
initCharacterWorkbench();
initRoutingPreferences();
initInternalTabs();
initValidationFilters();
initDrawers();
initQuickActions();
route();

window.addEventListener('hashchange', route);
document.querySelector('#recheck').onclick = () =>
  Promise.all([health(), runtimeCapabilities(), loadStudioStack()]).catch(notice);

for (const task of [
  health,
  loadStudioStack,
  runtimeCapabilities,
  providers,
  loadProjects,
  refreshRuns,
  loadSpecialists,
  loadRoutingPreferences,
  loadAssetProviders,
  loadAssets,
  loadCompletionScorecard,
]) task().catch(notice);
