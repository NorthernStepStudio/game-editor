import { initWorkspace } from './workspace.js';
import { api, notice, clearNotice } from './api.js';
import { initStudio, loadProjects, refreshRuns } from './studio.js';
import { initChat } from './chat.js';
import { initSpecialists, loadSpecialists } from './specialists.js';

const pages = ['chat', 'studio', 'projects', 'evidence', 'settings'];
const studioTabs = ['create', 'pipeline', 'output', 'assets', 'specialists'];
let selectedStudioTab = 'create';

function updateSidebarSelection(hash) {
  for (const link of document.querySelectorAll('.sidebar-nav a, nav a')) {
    link.removeAttribute('aria-current');
    link.classList.remove('active');
  }

  let matchedLink = document.querySelector(`.sidebar-nav a[href="#${hash}"], nav a[href="#${hash}"]`);
  if (!matchedLink && (hash === 'studio' || hash === 'create')) {
    matchedLink = document.querySelector('.sidebar-nav a[href="#create"], nav a[href="#create"], .sidebar-nav a[href="#studio"], nav a[href="#studio"]');
  }

  if (matchedLink) {
    matchedLink.setAttribute('aria-current', 'page');
    matchedLink.classList.add('active');
  }
}

function route() {
  const hash = location.hash.slice(1) || 'studio';

  let pageName = 'studio';
  let activeStudioTab = 'create';

  if (pages.includes(hash)) {
    pageName = hash;
    if (hash === 'studio') activeStudioTab = 'create';
  } else if (studioTabs.includes(hash)) {
    pageName = 'studio';
    activeStudioTab = hash;
  }

  selectedStudioTab = activeStudioTab;

  for (const page of pages) {
    const el = document.querySelector(`#${page}`);
    if (el) el.hidden = page !== pageName;
  }

  if (pageName === 'studio') {
    selectStudioTab(activeStudioTab);
  }

  updateSidebarSelection(hash);

  const titleMap = {
    studio: 'Studio / Create',
    create: 'Studio / Create',
    pipeline: 'Studio / Pipeline',
    output: 'Studio / Live Output',
    assets: 'Studio / Asset Gallery',
    specialists: 'Studio / Specialists',
    chat: 'Workspace / Chat',
    projects: 'Workspace / Projects',
    evidence: 'Workspace / Evidence',
    settings: 'Workspace / Settings'
  };

  document.querySelector('#breadcrumb').textContent = titleMap[hash] || `Workspace / ${hash[0].toUpperCase() + hash.slice(1)}`;
  if (pageName === 'evidence') refreshRuns().catch(notice);
}

function selectStudioTab(target) {
  if (!studioTabs.includes(target)) return;
  selectedStudioTab = target;
  for (const tab of document.querySelectorAll('.studio-tab')) {
    const selected = tab.dataset.studioTab === target;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.classList.toggle('active', selected);
  }
  for (const id of studioTabs) {
    const section = document.getElementById(`studio-${id}`);
    if (section) section.hidden = id !== target;
  }
}

function initStudioTabs() {
  for (const tab of document.querySelectorAll('.studio-tab')) {
    tab.onclick = () => {
      const target = tab.dataset.studioTab;
      location.hash = `#${target}`;
    };
  }
}

async function health() {
  const [server, daemon] = await Promise.all([api('/health'), api('/api/studio/health')]);
  const connection = document.querySelector('#connection');
  connection.textContent = `Connected · ${server.mode === 'mock' ? 'mock chat' : server.mode}`;
  connection.classList.add('connected');
  const systemState = document.querySelector('#system-state');
  if (systemState) {
    systemState.innerHTML = daemon.available
      ? '<span class="dot live"></span> Studio services ready'
      : '<span class="dot"></span> Flyrail offline';
  }
  const godotAi = daemon.executionBackends?.godotAi;
  const codex = daemon.executionBackends?.codex;
  document.querySelector('#daemon-detail').textContent = daemon.available
    ? `Flyrail connected (${daemon.version}) · Godot AI ${godotAi?.configured ? 'configured' : 'not configured'}${godotAi?.pluginInstalled ? ' + plugin detected' : ''} · Codex ${codex?.configured ? 'ready' : 'not configured'} · Sentinel validator active. Remote cancellation is currently unsupported.`
    : 'Flyrail is offline. Start the daemon on this PC and check its server-side configuration.';
  clearNotice();
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
    const p = data.providers.find(p => p.id === select.value);
    document.querySelector('#provider-detail').textContent = `${p?.model || select.value}. ${select.value === 'mock' ? 'Mock responses do not execute or validate work.' : 'Provider credentials are configured on the server.'}`;
  };
  select.onchange = describe;
  describe();
}

initStudio();
initChat();
initWorkspace();
initStudioTabs();
initSpecialists();
route();
window.addEventListener('hashchange', route);
document.querySelector('#recheck').onclick = () => health().catch(notice);
for (const task of [health, providers, loadProjects, refreshRuns, loadSpecialists]) task().catch(notice);
