import { api, notice } from './api.js';
import { initStudio, loadProjects, refreshRuns } from './studio.js';
import { initChat } from './chat.js';
const pages = ['chat', 'studio', 'projects', 'evidence', 'settings'];
function route() {
  const name = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'studio';
  for (const page of pages) document.querySelector(`#${page}`).hidden = page !== name;
  for (const link of document.querySelectorAll('nav a')) { if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  document.querySelector('#breadcrumb').textContent = `Workspace / ${name[0].toUpperCase() + name.slice(1)}`;
  if (name === 'evidence') refreshRuns().catch(notice);
}
async function health() {
  const [server, daemon] = await Promise.all([api('/health'), api('/api/studio/health')]);
  document.querySelector('#connection').textContent = `Connected · ${server.mode === 'mock' ? 'mock chat' : server.mode}`;
  document.querySelector('#daemon-detail').textContent = daemon.available ? `Flyrail connected (${daemon.version}). Remote cancellation is currently unsupported.` : 'Flyrail is offline. Start the daemon on this PC and check its server-side configuration.';
}
async function providers() {
  const data = await api('/providers'), select = document.querySelector('#provider'); select.replaceChildren();
  for (const provider of data.providers) { const option = new Option(`${provider.label}${provider.available ? '' : ' — setup required'}`, provider.id); option.disabled = !provider.available; select.add(option); }
  select.value = data.current;
  const describe = () => { const p = data.providers.find(p => p.id === select.value); document.querySelector('#provider-detail').textContent = `${p?.model || select.value}. ${select.value === 'mock' ? 'Mock responses do not execute or validate work.' : 'Provider credentials are configured on the server.'}`; };
  select.onchange = describe; describe();
}
initStudio(); initChat(); route(); window.addEventListener('hashchange', route);
document.querySelector('#recheck').onclick = () => health().catch(notice);
for (const task of [health, providers, loadProjects, refreshRuns]) task().catch(notice);
