import { api, el } from './api.js';

let specialists = [];

function badgeClass(availability) {
  switch (availability) {
    case 'available': return 'badge-success';
    case 'integration-pending': return 'badge-warning';
    case 'planned': return 'badge-pending';
    default: return '';
  }
}

function dotClass(availability) {
  switch (availability) {
    case 'available': return 'available';
    case 'integration-pending': return 'pending';
    case 'planned': return 'planned';
    default: return 'offline';
  }
}

function renderSpecialistCards(target) {
  const container = document.getElementById(target);
  if (!container) return;
  container.replaceChildren();
  if (!specialists.length) {
    container.append(el('p', 'No specialists registered.', 'muted'));
    return;
  }
  for (const spec of specialists) {
    const card = document.createElement('div');
    card.className = 'specialist-card';

    const header = document.createElement('div');
    header.className = 'specialist-header';
    const title = el('span', spec.title, 'specialist-title');
    const badge = el('span', spec.availability.replace('-', ' '), `badge ${badgeClass(spec.availability)}`);
    header.append(title, badge);

    const role = el('p', spec.role, 'specialist-role');

    const capList = document.createElement('div');
    capList.className = 'capability-list';
    for (const cap of spec.capabilities) {
      const tag = el('span', cap.id, 'capability-tag');
      tag.title = cap.description;
      capList.append(tag);
    }

    card.append(header, role, capList);
    container.append(card);
  }
}

function renderSettingsSpecialists() {
  const container = document.getElementById('settings-specialists');
  if (!container) return;
  container.replaceChildren();
  for (const spec of specialists) {
    const row = document.createElement('div');
    row.className = 'settings-specialist-row';
    const dot = document.createElement('span');
    dot.className = `avail-dot ${dotClass(spec.availability)}`;
    const name = el('span', spec.title, 'specialist-name');
    const mode = el('span', `${spec.executionMode} · ${spec.availability.replace('-', ' ')}`, 'muted');
    row.append(dot, name, mode);
    container.append(row);
  }
}

export async function loadSpecialists() {
  try {
    specialists = await api('/api/studio/specialists');
  } catch {
    specialists = [];
  }
  renderSpecialistCards('specialist-list');
  renderSettingsSpecialists();
}

export function getSpecialists() {
  return specialists;
}

export function initSpecialists() {
  const refresh = document.getElementById('refresh-specialists');
  if (refresh) refresh.onclick = () => loadSpecialists();
}
