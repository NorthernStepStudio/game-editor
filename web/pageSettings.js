import { api, tryApi, h, clear, btn, action, toast } from './ui.js';

const CLAUDE_STEPS = [
  'Open Windows Terminal (or PowerShell).',
  'Type  claude  and press Enter.',
  'Choose “Claude account with subscription” and sign in in the browser that opens.',
  'Type  /exit  in the terminal, then press Check again here.',
].join('\n');

/**
 * Reads every tool Matterhorn depends on from live endpoints. Each entry says what is
 * wrong and how to fix it; nothing is reported ready without the server saying so.
 */
export async function checkConnections() {
  const [providers, foundry, health, runtime] = await Promise.all([
    tryApi('/providers'),
    tryApi('/api/foundry/providers'),
    tryApi('/api/studio/health'),
    tryApi('/api/studio/runtime'),
  ]);
  const foundryProviders = foundry?.providers ?? [];
  const ollama = providers?.providers?.find((p) => p.id === 'ollama');
  const local = foundryProviders.find((p) => p.id === 'blender-agent-local');
  const claudeAssets = foundryProviders.find((p) => p.id === 'blender-agent-claude');
  const comfy = foundryProviders.find((p) => p.id === 'comfyui-local');
  const codeAgent = health?.executionBackends?.codeAgent;
  const memory = Array.isArray(runtime) ? runtime.find((c) => c.capability === 'project-memory') : undefined;
  const blenderMissing = [local, claudeAssets].some((p) => /Install Blender/i.test(p?.note ?? ''));

  const claudeInstalled = codeAgent?.agent === 'claude' ? codeAgent.installed : Boolean(claudeAssets?.available);
  const claudeSignedIn = codeAgent?.agent === 'claude' ? codeAgent.signedIn : undefined;

  return [
    {
      id: 'ollama', name: 'Local AI (Ollama)', required: true,
      state: !providers ? 'off' : ollama?.available ? 'ok' : 'off',
      detail: !providers ? 'Matterhorn server did not answer' : ollama?.available ? `Running · ${ollama.model ?? 'model'}` : 'Not running',
      help: 'Install Ollama from ollama.com, run  ollama pull gemma4:12b , and set OLLAMA_MODEL in the .env file. npm run studio starts it for you.',
    },
    {
      id: 'claude', name: 'Claude Code', required: false,
      state: !claudeInstalled ? 'off' : claudeSignedIn === false ? 'warn' : 'ok',
      detail: !claudeInstalled ? 'Not installed' : claudeSignedIn === false ? 'Installed, not signed in' : 'Ready',
      help: !claudeInstalled ? 'Install it with:  npm install -g @anthropic-ai/claude-code , then sign in.' : CLAUDE_STEPS,
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

const CHAT_KEY = 'matterhorn.chatProvider';

export async function render(main) {
  clear(main,
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('section', { class: 'card', 'aria-labelledby': 'conn-title' },
      h('h2', { id: 'conn-title' }, 'Connections'),
      h('p', { class: 'muted' }, 'Everything Matterhorn uses on this PC. Anything not ready says exactly how to fix it.'),
      h('div', { id: 'connections', class: 'list' }, h('p', { class: 'muted' }, 'Checking…'))),
    h('section', { class: 'card', 'aria-labelledby': 'ai-title' },
      h('h2', { id: 'ai-title' }, 'AI'),
      h('div', { id: 'ai-settings', class: 'form' }, h('p', { class: 'muted' }, 'Loading…'))),
    h('details', { class: 'card advanced' },
      h('summary', {}, 'Advanced'),
      h('div', { id: 'advanced' }, h('p', { class: 'muted' }, 'Loading…'))),
  );
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
  const row = h('div', { class: 'conn' },
    h('div', { class: 'conn-main' },
      h('span', { class: `dot ${c.state}`, 'aria-hidden': 'true' }),
      h('strong', {}, c.name),
      h('span', { class: 'muted' }, c.detail),
      result,
      h('div', { class: 'row end' },
        c.state === 'ok' ? null : btn(help.hidden ? 'How to fix' : 'Hide steps', (event) => {
          help.hidden = !help.hidden;
          event.currentTarget.textContent = help.hidden ? 'How to fix' : 'Hide steps';
        }),
        action('Check again', async () => {
          result.textContent = 'Checking…';
          const fresh = (await checkConnections()).find((x) => x.id === c.id);
          if (fresh && c.id === 'ollama' && fresh.state === 'ok') {
            const started = performance.now();
            await api('/ask', { prompt: 'Reply with: ok', intent: 'ask', workspace: { name: 'Matterhorn' }, _provider: 'ollama' });
            fresh.detail += ` · answered in ${((performance.now() - started) / 1000).toFixed(1)} s`;
          }
          const next = connectionRow(fresh ?? c);
          next.querySelector('[role="status"]').textContent = `Checked ${new Date().toLocaleTimeString()}`;
          row.replaceWith(next);
        }, 'quiet'))),
    help);
  return row;
}

async function renderAi() {
  const host = document.querySelector('#ai-settings');
  if (!host) return;
  const [providers, foundry, routing] = await Promise.all([api('/providers'), api('/api/foundry/providers'), api('/api/studio/routing')]);
  const chatOptions = providers.providers.filter((p) => p.available);
  const savedChat = localStorage.getItem(CHAT_KEY) || providers.current;
  const chat = h('select', { id: 'chat-model', class: 'field', onchange: (e) => {
    localStorage.setItem(CHAT_KEY, e.target.value);
    toast(e.target.value === 'mock' ? 'Chat set to Mock: it answers but cannot do real work.' : `Chat and planning will use ${e.target.selectedOptions[0].textContent}.`);
  } }, chatOptions.map((p) => h('option', { value: p.id, selected: p.id === savedChat },
    p.id === 'mock' ? 'Mock (testing only — does no real work)' : `${p.label}${p.model ? ` · ${p.model}` : ''}`)));

  const builders = foundry.providers.filter((p) => p.id.startsWith('blender-agent') && p.available);
  const builder = h('select', { id: 'asset-builder', class: 'field', onchange: async (e) => {
    const id = e.target.value;
    try {
      await api('/api/studio/routing', {
        assets: id,
        ...(id === 'blender-agent-claude' ? { allowNetworkProviders: true } : {}),
      }, 'PUT');
      toast(id === 'blender-agent-claude'
        ? 'Assets will be built with Claude. This also allows network providers (Claude runs online).'
        : id === 'auto' ? 'Matterhorn will pick the builder (local first).' : 'Assets will be built with the local model.');
    } catch (error) {
      toast(error.message, 'error');
    }
  } },
  h('option', { value: 'auto', selected: routing.assets === 'auto' }, 'Let Matterhorn pick (local first)'),
  builders.map((p) => h('option', { value: p.id, selected: routing.assets === p.id },
    p.id === 'blender-agent-claude' ? 'Claude — best quality (uses your Claude subscription)' : `Local — free, simple props only (${p.name.replace(/.*\(local\s*|\)$/g, '')})`)));

  clear(host,
    h('label', { for: 'chat-model', class: 'label' }, 'Chat and planning'), chat,
    h('label', { for: 'asset-builder', class: 'label' }, 'Building assets'), builder,
    builders.length ? null : h('p', { class: 'muted' }, 'No asset builder is available — see Blender in Connections.'));
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
      : 'Server status unavailable.'),
  );
}
