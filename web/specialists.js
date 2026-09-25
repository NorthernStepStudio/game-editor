import { api, el } from './api.js';

let specialists = [];

function avatarIcon(id) {
  switch (id) {
    case 'matterhorn': return '🔮';
    case 'flyrail': return '⚡';
    case 'blender':
    case 'blender-engine': return '🎨';
    case 'foundry': return '📦';
    case 'audio': return '🎵';
    case 'world': return '🌐';
    case 'narrative': return '💬';
    case 'qa': return '🔍';
    default: return '🤖';
  }
}

function avatarClass(id) {
  const normalized = id === 'blender-engine' ? 'blender' : id.toLowerCase();
  return `specialist-avatar ${normalized}`;
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
    header.className = 'specialist-card-header';

    const identity = document.createElement('div');
    identity.className = 'specialist-identity';

    const avatar = document.createElement('div');
    avatar.className = avatarClass(spec.id);
    avatar.textContent = avatarIcon(spec.id);

    const titleGroup = document.createElement('div');
    titleGroup.className = 'specialist-title';
    const title = document.createElement('strong');
    title.textContent = spec.title;
    const mode = document.createElement('span');
    mode.textContent = spec.executionMode;
    titleGroup.append(title, mode);

    identity.append(avatar, titleGroup);

    const badge = document.createElement('span');
    badge.className = `badge-availability ${spec.availability === 'available' ? 'available' : spec.availability.includes('pending') ? 'pending' : 'planned'}`;
    badge.textContent = spec.availability.replace('-', ' ').toUpperCase();

    header.append(identity, badge);

    const role = el('p', spec.role, 'muted-sm');

    const capList = document.createElement('div');
    capList.className = 'specialist-tags';
    for (const cap of spec.capabilities) {
      const tag = el('span', cap.id, 'spec-tag');
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
    row.className = 'info-item';
    row.style.padding = '6px 0';
    const label = el('span', `• ${spec.title}`, 'lbl');
    const value = el('span', `${spec.executionMode} · ${spec.availability}`, 'val');
    row.append(label, value);
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
