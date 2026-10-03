import { api, el } from './api.js';

let agents = [];

function badgeClass(availability) {
  switch (availability) {
    case 'active': return 'badge-success';
    case 'integration-pending': return 'badge-warning';
    case 'planned': return 'badge-pending';
    default: return '';
  }
}

function dotClass(availability) {
  switch (availability) {
    case 'active': return 'available';
    case 'integration-pending': return 'pending';
    case 'planned': return 'planned';
    default: return 'offline';
  }
}

function renderAgentCards(target) {
  const container = document.getElementById(target);
  if (!container) return;
  container.replaceChildren();
  if (!agents.length) {
    container.append(el('p', 'No studio agents registered.', 'muted'));
    return;
  }

  for (const agent of agents) {
    const card = document.createElement('div');
    card.className = 'specialist-card';

    const header = document.createElement('div');
    header.className = 'specialist-header';
    header.append(
      el('span', agent.title, 'specialist-title'),
      el('span', agent.availability.replace('-', ' '), `badge ${badgeClass(agent.availability)}`),
    );

    const role = el('p', agent.role, 'specialist-role');
    const meta = el('p', `${agent.kind} · ${agent.adapters.filter(a => a.status === 'bound').length} bound adapter(s)`, 'muted-sm');

    const skillList = document.createElement('div');
    skillList.className = 'capability-list';
    for (const skill of agent.skills) {
      const tag = el('span', skill.id, 'capability-tag');
      tag.title = skill.description;
      skillList.append(tag);
    }

    card.append(header, role, meta, skillList);
    container.append(card);
  }
}

function renderSettingsAgents() {
  const container = document.getElementById('settings-specialists');
  if (!container) return;
  container.replaceChildren();
  for (const agent of agents) {
    const row = document.createElement('div');
    row.className = 'settings-specialist-row';
    const dot = document.createElement('span');
    dot.className = `avail-dot ${dotClass(agent.availability)}`;
    row.append(
      dot,
      el('span', agent.title, 'specialist-name'),
      el('span', `${agent.kind} · ${agent.availability.replace('-', ' ')}`, 'muted'),
    );
    container.append(row);
  }
}

export async function loadSpecialists() {
  try {
    agents = await api('/api/studio/agents');
  } catch {
    agents = [];
  }
  renderAgentCards('specialist-list');
  renderSettingsAgents();
}

export function getSpecialists() {
  return agents;
}

export function initSpecialists() {
  const refresh = document.getElementById('refresh-specialists');
  if (refresh) refresh.onclick = () => loadSpecialists();
}
