import { api, el } from './api.js';

let specialists = [];

function badgeClass(availability) {
  switch (availability) {
    case 'active':
    case 'available': return 'badge-success';
    case 'integration-pending': return 'badge-warning';
    case 'planned': return 'badge-pending';
    default: return '';
  }
}

function dotClass(availability) {
  switch (availability) {
    case 'active':
    case 'available': return 'available';
    case 'integration-pending': return 'pending';
    case 'planned': return 'planned';
    default: return 'offline';
  }
}

function capabilitiesOf(spec) {
  return spec.skills ?? spec.capabilities ?? [];
}

function renderSpecialistCards(target) {
  const container = document.getElementById(target);
  if (!container) return;
  container.replaceChildren();
  if (!specialists.length) {
    container.append(el('p', 'No studio agents registered.', 'muted'));
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
    const meta = el('p', spec.kind ? `${spec.kind} · ${spec.id}` : `${spec.executionMode} · ${spec.id}`, 'muted-sm');

    const capList = document.createElement('div');
    capList.className = 'capability-list';
    for (const cap of capabilitiesOf(spec)) {
      const tag = el('span', cap.id, 'capability-tag');
      tag.title = cap.description;
      capList.append(tag);
    }

    if (spec.adapters?.length) {
      const adapters = el('p', `Adapters: ${spec.adapters.map(adapter => adapter.adapterId + ' · ' + adapter.status).join(', ')}`, 'muted-sm');
      card.append(header, role, meta, capList, adapters);
    } else {
      card.append(header, role, meta, capList);
    }
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
    const mode = el('span', `${spec.kind ?? spec.executionMode} · ${spec.availability.replace('-', ' ')}`, 'muted');
    row.append(dot, name, mode);
    container.append(row);
  }
}

export async function loadSpecialists() {
  try {
    specialists = await api('/api/studio/agents');
  } catch {
    try {
      specialists = await api('/api/studio/specialists');
    } catch {
      specialists = [];
    }
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
