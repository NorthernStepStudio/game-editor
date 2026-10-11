import { api, el } from './api.js';

// Home "Your studio" cards: one per Matterhorn capability, each status line backed by a live endpoint.
// Unknown or unreachable state is shown as such — never as ready.

const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio']);

function statusRow(label, value, state) {
  const row = el('div', undefined, 'stack-row');
  const dot = el('span', undefined, `dot ${state === 'ready' ? 'live' : state === 'warn' ? 'warn' : ''}`);
  row.append(el('span', label, 'stack-row-label'), el('span', undefined, 'stack-row-value'));
  row.lastChild.append(dot, document.createTextNode(value));
  return row;
}

function card({ kicker, title, line, rows, actions }) {
  const node = el('article', undefined, 'stack-card surface');
  node.append(el('p', kicker, 'eyebrow'), el('h3', title, 'stack-title'), el('p', line, 'stack-line'));
  const list = el('div', undefined, 'stack-rows');
  list.append(...rows);
  const actionRow = el('div', undefined, 'stack-actions');
  for (const action of actions) {
    const link = el('a', action.label, action.primary ? 'primary-action stack-cta' : 'text-link');
    link.href = action.href;
    actionRow.append(link);
  }
  node.append(list, actionRow);
  return node;
}

async function safe(path) {
  try { return await api(path); } catch { return undefined; }
}

export async function loadStudioStack() {
  const container = document.querySelector('#studio-stack');
  if (!container) return;

  const [providers, daemon, foundry, motion] = await Promise.all([
    safe('/providers'),
    safe('/api/studio/health'),
    safe('/api/foundry/providers'),
    safe('/api/motion/characters'),
  ]);

  const available = providers?.providers?.filter((p) => p.available && p.id !== 'mock') ?? [];
  const local = available.filter((p) => LOCAL_PROVIDERS.has(p.id));
  const cloud = available.filter((p) => !LOCAL_PROVIDERS.has(p.id));
  const activeIsMock = providers?.current === 'mock';
  const foundryReady = foundry?.providers?.filter((p) => p.available) ?? [];
  const characters = motion?.characters ?? [];
  const flyrail = daemon?.available === true;
  const codex = daemon?.executionBackends?.codex?.configured === true;
  const godotAi = daemon?.executionBackends?.godotAi?.configured === true;

  container.replaceChildren(
    card({
      kicker: 'AGENT',
      title: 'Plan, build, verify',
      line: 'Runs on your PC with the AI you choose. Every run is checked before it counts.',
      rows: [
        statusRow('Active AI', providers ? (activeIsMock ? 'Mock — choose a real model' : providers.current) : 'Unknown', providers ? (activeIsMock ? 'warn' : 'ready') : 'off'),
        statusRow('On this PC', local.length ? local.map((p) => p.label).join(', ') : 'No local models found', local.length ? 'ready' : 'off'),
        statusRow('Cloud AI', cloud.length ? cloud.map((p) => p.label).join(', ') : 'None connected', cloud.length ? 'ready' : 'off'),
      ],
      actions: [
        { label: 'Start a run', href: '#home', primary: true },
        { label: 'AI settings', href: '#settings' },
      ],
    }),
    card({
      kicker: 'ASSET GENERATOR',
      title: 'Create assets, ship-ready',
      line: 'Characters, sprites and props built on your PC as files you keep, with provenance.',
      rows: [
        statusRow('Characters', motion ? `${characters.length} in Character Studio` : 'Unknown', characters.length ? 'ready' : 'off'),
        statusRow('Generators', foundry ? (foundryReady.length ? foundryReady.map((p) => p.name).join(', ') : 'None configured') : 'Unknown', foundryReady.length ? 'ready' : 'warn'),
      ],
      actions: [
        { label: 'Open Character Studio', href: '#create', primary: true },
        { label: 'Browse assets', href: '#assets' },
      ],
    }),
    card({
      kicker: 'GAME ENGINE',
      title: 'Build and playtest in Godot',
      line: 'Changes land in your Godot project and are playtested before Matterhorn accepts them.',
      rows: [
        statusRow('Execution', daemon ? (flyrail ? 'Connected' : 'Offline — start the daemon on this PC') : 'Unknown', flyrail ? 'ready' : 'warn'),
        statusRow('Editor tools', godotAi ? 'Godot editor tools configured' : 'Not configured', godotAi ? 'ready' : 'off'),
        statusRow('Code agent', codex ? 'Ready' : 'Not configured', codex ? 'ready' : 'off'),
      ],
      actions: [
        { label: 'Open projects', href: '#projects', primary: true },
        { label: 'Validation', href: '#validation' },
      ],
    }),
  );

  const startRun = container.querySelector('a[href="#home"]');
  if (startRun) {
    startRun.onclick = (event) => {
      event.preventDefault();
      document.querySelector('#goal')?.focus();
    };
  }
}
