import { api, tryApi, h, clear, btn, action, toast } from './ui.js';
import { renderGuide } from './guide.js';

const CLAUDE_STEPS = [
  'Open Windows Terminal from the Start menu (not a terminal inside the Claude app).',
  'Type  claude  and press Enter. If it goes straight to a prompt, type  /login .',
  'Choose your Claude account (subscription) and sign in in the browser that opens.',
  'Back here, press Check again.',
].join('\n');

const FIT_TEXT = {
  gpu: 'Runs fast on your graphics card',
  mixed: 'Runs, but slower (partly on the processor)',
  'too-big': 'Too big for this PC',
  unknown: 'Fit unknown',
};
const JOB_TEXT = { chat: 'chat & answers', assets: 'building assets', memory: 'project memory' };

/**
 * Reads every tool Matterhorn depends on from live endpoints. Each entry says what is
 * wrong and how to fix it; nothing is reported ready without the server saying so.
 */
export async function checkConnections() {
  const [ai, foundry, health, runtime] = await Promise.all([
    tryApi('/api/ai/status'),
    tryApi('/api/foundry/providers'),
    tryApi('/api/studio/health'),
    tryApi('/api/studio/runtime'),
  ]);
  const foundryProviders = foundry?.providers ?? [];
  const local = foundryProviders.find((p) => p.id === 'blender-agent-local');
  const claudeAssets = foundryProviders.find((p) => p.id === 'blender-agent-claude');
  const comfy = foundryProviders.find((p) => p.id === 'comfyui-local');
  const memory = Array.isArray(runtime) ? runtime.find((c) => c.capability === 'project-memory') : undefined;
  const blenderMissing = [local, claudeAssets].some((p) => /Install Blender/i.test(p?.note ?? ''));
  const claude = ai?.claude;
  const codeAgent = health?.executionBackends?.codeAgent;
  const ollamaState = ai?.ollama?.state;

  const claudeState = !claude || claude.state === 'unchecked'
    ? (codeAgent?.agent === 'claude' ? (codeAgent.ready ? 'ok' : codeAgent.installed ? 'warn' : 'off') : 'off')
    : claude.state === 'ready' ? 'ok' : claude.state === 'not-installed' ? 'off' : 'warn';

  return [
    {
      id: 'ollama', name: 'Local AI (Ollama)', required: true,
      state: ollamaState === 'running' && ai.roles.chat ? 'ok' : ollamaState === 'starting' ? 'warn' : 'off',
      detail: !ai ? 'Matterhorn server did not answer'
        : ollamaState === 'running' ? (ai.roles.chat ? `Ready · chat uses ${ai.roles.chat}` : 'Running, but no chat model downloaded')
          : ollamaState === 'starting' ? 'Starting…'
            : ollamaState === 'missing' ? 'Not installed' : 'Not running',
      help: ollamaState === 'missing'
        ? 'Install Ollama from ollama.com (free), then restart Matterhorn. Matterhorn starts it and loads a model by itself.'
        : 'Press Start below in AI, or restart Matterhorn — it starts Ollama automatically.',
    },
    {
      id: 'claude', name: 'Claude Code', required: false,
      state: claudeState,
      detail: claude && claude.state !== 'unchecked' ? claude.detail
        : codeAgent?.agent === 'claude' ? (codeAgent.ready ? 'Signed in' : codeAgent.installed ? 'Installed, not signed in' : 'Not installed') : 'Not checked',
      help: claude?.state === 'not-installed' ? 'Install it with:  npm install -g @anthropic-ai/claude-code , then sign in.' : CLAUDE_STEPS,
      check: () => api('/api/ai/claude/check', {}),
    },
    {
      id: 'blender', name: 'Blender', required: true,
      state: !foundry ? 'off' : blenderMissing ? 'off' : 'ok',
      detail: !foundry ? 'Unknown' : blenderMissing ? 'Not found' : 'Found · builds assets from a description',
      help: 'Install Blender 4.2 or newer from blender.org, or set MATTERHORN_BLENDER_BIN in .env to blender.exe.',
    },
    {
      id: 'godot', name: 'Godot + Flyrail', required: true,
      state: health?.available ? 'ok' : 'warn',
      detail: health?.available ? `Connected · Flyrail ${health.version ?? ''}`.trim() : 'Not connected',
      help: 'Start everything with  npm run studio  (it starts the Flyrail daemon). FLYRAIL_REPO_ROOT in .env must point at your Flyrail folder.',
    },
    {
      id: 'memory', name: 'Project memory', required: false,
      state: memory?.state === 'ready' ? 'ok' : 'off',
      detail: memory?.state === 'ready' ? 'Running on this PC' : 'Not running (optional)',
      help: 'Run tools/setup-matterhorn-project-memory.ps1 once (see docs), then npm run studio starts it.',
    },
    {
      id: 'comfy', name: 'Image generator (ComfyUI)', required: false,
      state: comfy?.available ? 'ok' : 'off',
      detail: comfy?.available ? 'Connected' : 'Not set up (optional)',
      help: comfy?.note ?? 'Optional: connect a local ComfyUI for image-based assets.',
    },
  ];
}

const state = { pollAi: undefined };

export function leave() {
  clearTimeout(state.pollAi);
}

export async function render(main, sub = '') {
  clearTimeout(state.pollAi);
  const tab = sub.startsWith('guide') ? 'guide' : 'setup';
  clear(main,
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('nav', { class: 'tabs', 'aria-label': 'Settings sections' },
      h('a', { href: '#settings', class: `tab${tab === 'setup' ? ' active' : ''}`, 'aria-current': tab === 'setup' ? 'page' : undefined }, 'Setup'),
      h('a', { href: '#settings/guide', class: `tab${tab === 'guide' ? ' active' : ''}`, 'aria-current': tab === 'guide' ? 'page' : undefined }, 'Guide')),
    h('div', { id: 'settings-body' }));
  const body = document.querySelector('#settings-body');
  if (tab === 'guide') return renderGuide(body, sub.slice('guide'.length + 1));

  clear(body,
    h('section', { class: 'card', 'aria-labelledby': 'conn-title' },
      h('h2', { id: 'conn-title' }, 'Connections'),
      h('p', { class: 'muted' }, 'Everything Matterhorn uses on this PC. Anything not ready says exactly how to fix it.'),
      h('div', { id: 'connections', class: 'list' }, h('p', { class: 'muted' }, 'Checking…'))),
    h('section', { class: 'card', 'aria-labelledby': 'ai-title' },
      h('h2', { id: 'ai-title' }, 'AI'),
      h('div', { id: 'ai-settings', class: 'form' }, h('p', { class: 'muted' }, 'Loading…'))),
    h('details', { class: 'card advanced' },
      h('summary', {}, 'Advanced'),
      h('div', { id: 'advanced' }, h('p', { class: 'muted' }, 'Loading…'))));
  await Promise.all([renderConnections(), renderAi(), renderAdvanced()]);
}

async function renderConnections() {
  const host = document.querySelector('#connections');
  if (!host) return;
  const connections = await checkConnections();
  clear(host, connections.map((c) => connectionRow(c)));
}

function connectionRow(c) {
  const help = h('p', { class: 'help', hidden: true }, c.help);
  const result = h('span', { class: 'muted small', role: 'status' });
  const howTo = btn('How to fix', (event) => {
    help.hidden = !help.hidden;
    event.currentTarget.textContent = help.hidden ? 'How to fix' : 'Hide steps';
  });
  const row = h('div', { class: 'conn' },
    h('div', { class: 'conn-main' },
      h('span', { class: `dot ${c.state}`, 'aria-hidden': 'true' }),
      h('strong', {}, c.name),
      h('span', { class: 'muted' }, c.detail),
      result,
      h('div', { class: 'row end' },
        c.state === 'ok' ? null : howTo,
        action('Check again', async () => {
          result.textContent = c.id === 'claude' ? 'Asking Claude a test question…' : 'Checking…';
          if (c.check) await c.check();
          const fresh = (await checkConnections()).find((x) => x.id === c.id);
          const next = connectionRow(fresh ?? c);
          next.querySelector('[role="status"]').textContent = `Checked ${new Date().toLocaleTimeString()}`;
          row.replaceWith(next);
        }, 'quiet'))),
    help);
  return row;
}

// ── AI ───────────────────────────────────────────────────────────────
async function renderAi() {
  const host = document.querySelector('#ai-settings');
  if (!host) return;
  const [ai, foundry, routing] = await Promise.all([api('/api/ai/status'), api('/api/foundry/providers'), api('/api/studio/routing')]);
  const running = ai.ollama.state === 'running';
  const installed = ai.models.filter((m) => m.installed && !m.name.includes('embed'));
  const hw = ai.hardware;

  const roleSelect = (role, label, hint) => {
    const id = `role-${role}`;
    const current = ai.roles[role];
    return [
      h('label', { for: id, class: 'label' }, label),
      installed.length
        ? h('select', { id, class: 'field', onchange: async (e) => {
          try {
            await api('/api/ai/roles', { role, model: e.target.value });
            toast(role === 'chat' ? `Chat will use ${e.target.value}. Loading it now so it's ready.` : `Local asset builds will use ${e.target.value}.`);
            renderAi();
          } catch (error) {
            toast(error.message, 'error');
          }
        } }, installed.map((m) => h('option', { value: m.name, selected: m.name === current },
          `${m.title !== m.name ? `${m.title} (${m.name})` : m.name}${m.roles.includes(role) ? ' ★ recommended' : ''}${m.fit === 'too-big' ? ' — too big for this PC' : m.fit === 'mixed' ? ' — slower here' : ''}`)))
        : h('p', { class: 'muted' }, 'No model downloaded yet — download one below.'),
      h('p', { class: 'muted small' }, hint),
    ];
  };

  const builders = foundry.providers.filter((p) => p.id.startsWith('blender-agent') && p.available);
  const builder = h('select', { id: 'asset-builder', class: 'field', onchange: async (e) => {
    const id = e.target.value;
    try {
      await api('/api/studio/routing', { assets: id, ...(id === 'blender-agent-claude' ? { allowNetworkProviders: true } : {}) }, 'PUT');
      toast(id === 'blender-agent-claude'
        ? 'Assets will be built with Claude. This also allows online AI (Claude runs online).'
        : id === 'auto' ? 'Matterhorn will pick the builder (local first).' : 'Assets will be built with the local model.');
    } catch (error) {
      toast(error.message, 'error');
    }
  } },
  h('option', { value: 'auto', selected: routing.assets === 'auto' }, 'Let Matterhorn pick (local first)'),
  builders.map((p) => h('option', { value: p.id, selected: routing.assets === p.id },
    p.id === 'blender-agent-claude' ? 'Claude — best quality (uses your Claude account)' : 'Local model — free, simple props')));

  clear(host,
    h('div', { class: 'row spread wrap' },
      h('div', { class: 'row' },
        h('span', { class: `dot ${running ? 'ok' : ai.ollama.state === 'starting' ? 'warn' : 'off'}`, 'aria-hidden': 'true' }),
        h('strong', {}, running
          ? `Local AI is ready${ai.loaded.length ? ` · loaded: ${ai.loaded.join(', ')}` : ''}`
          : ai.ollama.state === 'starting' ? 'Local AI is starting…'
            : ai.ollama.state === 'missing' ? 'Ollama is not installed' : 'Local AI is not running')),
      running ? null : action('Start local AI', async () => {
        await api('/api/ai/start', {});
        toast('Local AI started and the chat model is loaded.');
        renderAi();
        renderConnections();
      }, 'primary')),
    h('p', { class: 'muted small' }, `Your PC: ${hw.gpu ?? 'graphics card unknown'}${hw.vramGb ? ` with ${hw.vramGb} GB` : ''} · ${hw.ramGb} GB memory. Matterhorn starts local AI and loads the chat model by itself when it opens.`),
    roleSelect('chat', 'Model for chat & answers', 'Used by Ask Matterhorn, questions in Studio, and file explanations. A fast model feels best.'),
    roleSelect('assets', 'Model for building assets (local)', 'Writes the Blender scripts when the local builder is used. A code model works best.'),
    h('label', { for: 'asset-builder', class: 'label' }, 'Who builds assets'), builder,
    h('h3', {}, 'Recommended models for this PC'),
    h('div', { class: 'list' }, ai.models.filter((m) => m.vramGb !== undefined).map(modelRow)));

  if (ai.models.some((m) => m.pull && !m.pull.done) || ai.ollama.state === 'starting') {
    state.pollAi = setTimeout(() => { if (document.querySelector('#ai-settings')) renderAi(); }, 2000);
  }
}

function modelRow(m) {
  const jobs = m.roles.map((r) => JOB_TEXT[r]).filter(Boolean);
  const pull = m.pull;
  const percent = pull?.total ? Math.round(((pull.completed ?? 0) / pull.total) * 100) : undefined;
  let control;
  if (m.installed) control = h('span', { class: 'status ok' }, 'Downloaded');
  else if (pull && !pull.done) control = h('span', { class: 'status active', role: 'status' }, `Downloading… ${percent !== undefined ? `${percent}%` : pull.status}`);
  else if (m.fit === 'too-big') control = h('span', { class: 'muted small' }, 'Too big for this PC');
  else control = action(`Download ${m.downloadGb} GB`, async () => {
    await api('/api/ai/models/pull', { name: m.name });
    toast(`Downloading ${m.title}. You can keep working.`);
    renderAi();
  }, 'small');
  return h('div', { class: 'model-row' },
    h('div', { class: 'model-main' },
      h('strong', {}, m.title), h('span', { class: 'mono small muted' }, ` ${m.name}`),
      h('p', { class: 'small' }, m.good),
      h('p', { class: 'muted small' }, [FIT_TEXT[m.fit], jobs.length ? `Good for ${jobs.join(' and ')}` : null].filter(Boolean).join(' · ')),
      pull?.error ? h('p', { class: 'error-text small' }, `Download failed: ${pull.error}`) : null),
    h('div', { class: 'row end' }, control));
}

async function renderAdvanced() {
  const host = document.querySelector('#advanced');
  if (!host) return;
  const [routing, health, scorecard] = await Promise.all([api('/api/studio/routing'), tryApi('/api/studio/health'), tryApi('/api/studio/completion')]);
  const toggle = (key, label, hint) => {
    const id = `routing-${key}`;
    return h('label', { class: 'check', for: id },
      h('input', { id, type: 'checkbox', checked: routing[key], onchange: async (e) => {
        try {
          await api('/api/studio/routing', { [key]: e.target.checked }, 'PUT');
          toast('Saved.');
        } catch (error) {
          e.target.checked = !e.target.checked;
          toast(error.message, 'error');
        }
      } }),
      h('span', {}, label, h('small', { class: 'muted block' }, hint)));
  };
  clear(host,
    h('h3', {}, 'Safety limits'),
    toggle('allowNetworkProviders', 'Allow online AI providers', 'Needed for Claude. Off keeps everything on this PC.'),
    toggle('allowExternalCostProviders', 'Allow paid providers', 'Providers that charge per request (e.g. Sprite Fusion credits).'),
    toggle('requireCommercialUse', 'Only use output I can sell', 'Blocks providers whose license does not allow commercial use.'),
    toggle('localFirst', 'Prefer local tools', 'When several can do the job, use the one on this PC.'),
    h('h3', {}, 'Readiness scorecard'),
    scorecard
      ? h('p', { class: 'muted' }, `${scorecard.metric}: capability coverage ${scorecard.capabilityCoverage}%, production readiness ${scorecard.productionReadiness}% (last updated ${scorecard.updatedAt}).`)
      : h('p', { class: 'muted' }, 'Scorecard unavailable.'),
    h('h3', {}, 'Services'),
    h('p', { class: 'muted' }, health
      ? `Execution: ${health.available ? `Flyrail ${health.version}` : 'offline'} · Validator: ${health.validatorAgent} · Storage: ${health.storage}`
      : 'Server status unavailable.'));
}
