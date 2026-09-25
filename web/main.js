import { initWorkspace } from './workspace.js';
import { api, notice, clearNotice } from './api.js';
import { initStudio, loadProjects, refreshRuns } from './studio.js';
import { initChat } from './chat.js';
import { initSpecialists, loadSpecialists } from './specialists.js';

const pages = ['chat', 'studio', 'projects', 'evidence', 'settings'];
const studioTabs = ['create', 'pipeline', 'output', 'assets', 'specialists'];

function route() {
  const name = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'studio';
  for (const page of pages) document.querySelector(`#${page}`).hidden = page !== name;
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.querySelector('#breadcrumb').textContent = `Workspace / ${name[0].toUpperCase() + name.slice(1)}`;
  if (name === 'evidence') refreshRuns().catch(notice);
}

function selectStudioTab(target) {
  if (!studioTabs.includes(target)) return;
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
    tab.onclick = () => selectStudioTab(tab.dataset.studioTab);
  }
  for (const link of document.querySelectorAll('[data-studio-link]')) {
    link.onclick = event => {
      event.preventDefault();
      location.hash = 'studio';
      selectStudioTab(link.dataset.studioLink);
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
  document.querySelector('#daemon-detail').textContent = daemon.available
    ? `Flyrail connected (${daemon.version}). Remote cancellation is currently unsupported.`
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
