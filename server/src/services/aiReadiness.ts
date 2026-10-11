import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { cleanClaudeEnvironment, findClaudeCodeExecutable } from '../../../core/out/index.js';

/**
 * Keeps local AI ready without the user doing anything: starts Ollama when Matterhorn
 * starts, pre-loads the chat model, remembers which model does which job, recommends
 * models that fit this PC, and downloads one only when the user asks.
 */

export type AiRole = 'chat' | 'assets';

export interface CatalogModel {
  readonly name: string;
  readonly title: string;
  /** Download size in GB (Ollama's default quantization). */
  readonly downloadGb: number;
  /** Graphics memory needed to run fully on the GPU, in GB (approximate, default context). */
  readonly vramGb: number;
  readonly good: string;
  readonly roles: readonly (AiRole | 'memory')[];
}

/** Curated, honest recommendations. Sizes are Ollama library figures for the default tag. */
export const MODEL_CATALOG: readonly CatalogModel[] = [
  { name: 'qwen3:8b', title: 'Qwen 3 · 8B', downloadGb: 5.2, vramGb: 6.5, roles: ['chat'],
    good: 'Fast everyday chat, questions and planning. Best default for talking to Matterhorn.' },
  { name: 'qwen3:14b', title: 'Qwen 3 · 14B', downloadGb: 9.3, vramGb: 11, roles: ['chat'],
    good: 'Smarter answers than the 8B, a bit slower. Uses most of a 12 GB graphics card.' },
  { name: 'qwen2.5-coder:14b', title: 'Qwen 2.5 Coder · 14B', downloadGb: 9.0, vramGb: 10.5, roles: ['assets', 'chat'],
    good: 'Best code writer that fits a 12 GB card — Blender scripts for assets and game code.' },
  { name: 'qwen2.5-coder:7b', title: 'Qwen 2.5 Coder · 7B', downloadGb: 4.7, vramGb: 6, roles: ['assets'],
    good: 'Lighter, faster code writer. Use it if the 14B feels slow.' },
  { name: 'gemma4:12b', title: 'Gemma 4 · 12B', downloadGb: 7.6, vramGb: 9.5, roles: ['chat'],
    good: 'Can look at images and screenshots, remembers very long conversations. Slower to answer.' },
  { name: 'llama3.1:8b', title: 'Llama 3.1 · 8B', downloadGb: 4.9, vramGb: 6.2, roles: ['chat'],
    good: 'Solid general assistant; a good fallback.' },
  { name: 'gemma3:1b', title: 'Gemma 3 · 1B', downloadGb: 0.8, vramGb: 1.5, roles: [],
    good: 'Tiny and instant, but only for very simple replies. Not recommended for real work.' },
  { name: 'nomic-embed-text', title: 'Nomic Embed', downloadGb: 0.3, vramGb: 0.6, roles: ['memory'],
    good: 'Used by project memory to find related notes. Not a chat model.' },
];

const PREFERRED: Record<AiRole, readonly string[]> = {
  chat: ['qwen3:8b', 'qwen3:14b', 'gemma4:12b', 'llama3.1:8b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b'],
  assets: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'qwen3:14b', 'qwen3:8b', 'gemma4:12b'],
};

export type ModelFit = 'gpu' | 'mixed' | 'too-big' | 'unknown';

export interface ClaudeStatus {
  readonly state: 'ready' | 'not-installed' | 'not-signed-in' | 'no-credits' | 'error' | 'unchecked';
  readonly detail: string;
  readonly authMethod?: string;
  readonly checkedAt?: string;
}

interface Settings { chatModel?: string; assetModel?: string }
interface Pull { status: string; completed?: number; total?: number; error?: string; done?: boolean }

export class AiReadiness {
  private settings: Settings = {};
  private readonly settingsPath: string;
  private readonly baseUrl: string;
  private hardware: { gpu?: string; vramGb?: number; ramGb: number } = { ramGb: Math.round(totalmem() / 1024 ** 3) };
  private ollamaState: 'unknown' | 'starting' | 'running' | 'missing' | 'failed' = 'unknown';
  private ollamaVersion?: string;
  private readonly pulls = new Map<string, Pull>();
  private claude: ClaudeStatus = { state: 'unchecked', detail: 'Not checked yet.' };
  private claudeCheck?: Promise<ClaudeStatus>;

  constructor(
    dataDirectory: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.settingsPath = resolve(dataDirectory, 'ai-settings.json');
    this.baseUrl = (env.OLLAMA_BASE_URL?.trim() || env.M_CORE_OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    if (existsSync(this.settingsPath)) {
      try {
        this.settings = JSON.parse(readFileSync(this.settingsPath, 'utf8')) as Settings;
      } catch {
        this.settings = {};
      }
    }
  }

  /** Called once when Matterhorn starts. Never throws; failures show up in status(). */
  async start(): Promise<void> {
    this.hardware = { ...this.hardware, ...detectGpu() };
    await this.ensureOllama();
    const chat = await this.chatModel();
    if (chat) await this.warm(chat).catch(() => undefined);
    void this.checkClaude(false);
  }

  // ── Ollama ─────────────────────────────────────────────────────────
  async ensureOllama(): Promise<boolean> {
    if (await this.ping()) return true;
    const exe = findOllama(this.env);
    if (!exe) {
      this.ollamaState = 'missing';
      return false;
    }
    this.ollamaState = 'starting';
    try {
      const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
    } catch {
      this.ollamaState = 'failed';
      return false;
    }
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await this.ping()) return true;
    }
    this.ollamaState = 'failed';
    return false;
  }

  private async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return false;
      this.ollamaVersion = ((await response.json()) as { version?: string }).version;
      this.ollamaState = 'running';
      return true;
    } catch {
      if (this.ollamaState === 'running') this.ollamaState = 'unknown';
      return false;
    }
  }

  private async installed(): Promise<{ name: string; sizeGb: number }[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
      const data = (await response.json()) as { models?: { name: string; size: number }[] };
      // Ollama reports untagged pulls as "name:latest"; the catalog and settings use the bare name.
      return (data.models ?? []).map((m) => ({ name: m.name.replace(/:latest$/, ''), sizeGb: Math.round((m.size / 1024 ** 3) * 10) / 10 }));
    } catch {
      return [];
    }
  }

  private async loaded(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ps`, { signal: AbortSignal.timeout(4000) });
      const data = (await response.json()) as { models?: { name: string }[] };
      return (data.models ?? []).map((m) => m.name.replace(/:latest$/, ''));
    } catch {
      return [];
    }
  }

  /** Loads a model into memory so the first real request is fast. */
  async warm(model: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: '30m' }),
      signal: AbortSignal.timeout(180_000),
    });
  }

  // ── Roles ──────────────────────────────────────────────────────────
  async chatModel(): Promise<string | undefined> {
    return this.resolveRole('chat');
  }

  async assetModel(): Promise<string | undefined> {
    return this.resolveRole('assets');
  }

  /** Synchronous best guess for callers that cannot await (uses the saved choice or the env default). */
  assetModelSync(fallback?: string): string | undefined {
    return this.settings.assetModel ?? fallback;
  }

  private async resolveRole(role: AiRole): Promise<string | undefined> {
    const names = (await this.installed()).map((m) => m.name);
    const saved = role === 'chat' ? this.settings.chatModel : this.settings.assetModel;
    if (saved && names.includes(saved)) return saved;
    const envDefault = role === 'chat'
      ? this.env.OLLAMA_MODEL?.trim()
      : this.env.MATTERHORN_ASSET_AGENT_OLLAMA_MODEL?.trim() || this.env.OLLAMA_MODEL?.trim();
    const fits = (name: string) => this.fit(MODEL_CATALOG.find((m) => m.name === name)?.vramGb) !== 'too-big';
    return PREFERRED[role].find((name) => names.includes(name) && fits(name))
      ?? (envDefault && names.includes(envDefault) ? envDefault : undefined)
      ?? names.find((name) => !name.includes('embed'));
  }

  async setRole(role: AiRole, model: string): Promise<void> {
    if (role !== 'chat' && role !== 'assets') throw new Error('Unknown AI job.');
    const names = (await this.installed()).map((m) => m.name);
    if (!names.includes(model)) throw new Error(`${model} is not downloaded yet.`);
    this.settings = { ...this.settings, [role === 'chat' ? 'chatModel' : 'assetModel']: model };
    mkdirSync(dirname(this.settingsPath), { recursive: true });
    const temp = `${this.settingsPath}.tmp`;
    writeFileSync(temp, JSON.stringify(this.settings, null, 2), 'utf8');
    renameSync(temp, this.settingsPath);
    if (role === 'chat') void this.warm(model).catch(() => undefined);
  }

  private fit(vramGb?: number): ModelFit {
    if (vramGb === undefined) return 'unknown';
    const { vramGb: vram, ramGb } = this.hardware;
    if (!vram) return vramGb <= ramGb * 0.5 ? 'mixed' : 'too-big';
    if (vramGb <= vram - 0.5) return 'gpu';
    if (vramGb <= vram + ramGb * 0.4) return 'mixed';
    return 'too-big';
  }

  // ── Downloads (only when the user asks) ────────────────────────────
  pull(name: string): void {
    if (!MODEL_CATALOG.some((m) => m.name === name)) throw new Error('Only recommended models can be downloaded from here.');
    const current = this.pulls.get(name);
    if (current && !current.done) throw new Error('Already downloading.');
    const state: Pull = { status: 'starting' };
    this.pulls.set(name, state);
    void (async () => {
      try {
        if (!(await this.ensureOllama())) throw new Error('Ollama is not running.');
        const response = await fetch(`${this.baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name, stream: true }),
        });
        if (!response.ok || !response.body) throw new Error(`Ollama refused the download (${response.status}).`);
        let pending = '';
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
            if (event.error) throw new Error(event.error);
            state.status = event.status ?? state.status;
            if (event.total) {
              state.total = event.total;
              state.completed = event.completed ?? state.completed;
            }
          }
        }
        state.status = 'done';
        state.done = true;
      } catch (error) {
        state.error = error instanceof Error ? error.message : String(error);
        state.done = true;
      }
    })();
  }

  // ── Claude Code ────────────────────────────────────────────────────
  /** Uses `claude auth status`; with probe=true also sends one tiny request to prove it can answer. */
  async checkClaude(probe: boolean): Promise<ClaudeStatus> {
    if (this.claudeCheck) return this.claudeCheck;
    this.claudeCheck = (async () => {
      const exe = findClaudeCodeExecutable(this.env);
      if (!exe) {
        return { state: 'not-installed' as const, detail: 'Claude Code is not installed.' };
      }
      const auth = await runJson(exe, ['auth', 'status'], 20_000) as { loggedIn?: boolean; authMethod?: string } | undefined;
      if (!auth?.loggedIn) {
        return { state: 'not-signed-in' as const, detail: 'Installed, not signed in.' };
      }
      if (!probe && this.claude.state !== 'unchecked' && this.claude.state !== 'not-signed-in') {
        return { ...this.claude, authMethod: auth.authMethod };
      }
      const answer = await runJson(exe, ['-p', 'Reply with exactly: ok', '--output-format', 'json', '--tools', '', '--no-session-persistence'], 90_000, 'Reply with exactly: ok') as
        { is_error?: boolean; result?: string } | undefined;
      const checkedAt = new Date().toISOString();
      if (answer && !answer.is_error) {
        return { state: 'ready' as const, detail: `Signed in (${auth.authMethod === 'api_key' ? 'API key' : 'subscription'}) and answering.`, authMethod: auth.authMethod, checkedAt };
      }
      const reason = answer?.result ?? 'No answer.';
      if (/credit balance/i.test(reason)) {
        return { state: 'no-credits' as const, authMethod: auth.authMethod, checkedAt,
          detail: 'Signed in with an API key that has no credits. Switch to your Claude subscription.' };
      }
      return { state: 'error' as const, detail: `Signed in, but requests fail: ${reason}`, authMethod: auth.authMethod, checkedAt };
    })().then((status) => {
      this.claude = status;
      return status;
    }).finally(() => {
      this.claudeCheck = undefined;
    });
    return this.claudeCheck;
  }

  // ── Status for the UI ──────────────────────────────────────────────
  async status() {
    const running = await this.ping();
    const [installed, loaded, chat, assets] = running
      ? await Promise.all([this.installed(), this.loaded(), this.chatModel(), this.assetModel()])
      : [[], [], undefined, undefined];
    const installedNames = new Set(installed.map((m) => m.name));
    const catalogNames = new Set(MODEL_CATALOG.map((m) => m.name));
    return {
      ollama: { state: running ? 'running' : this.ollamaState, version: this.ollamaVersion, baseUrl: this.baseUrl },
      hardware: this.hardware,
      roles: { chat, assets },
      loaded,
      models: [
        ...MODEL_CATALOG.map((m) => ({
          ...m,
          installed: installedNames.has(m.name),
          fit: this.fit(m.vramGb),
          pull: this.pulls.get(m.name),
        })),
        ...installed.filter((m) => !catalogNames.has(m.name)).map((m) => ({
          name: m.name, title: m.name, downloadGb: m.sizeGb, vramGb: undefined, roles: [], good: 'Installed on this PC.',
          installed: true, fit: 'unknown' as ModelFit, pull: undefined,
        })),
      ],
      claude: this.claude,
    };
  }
}

function findOllama(env: NodeJS.ProcessEnv): string | undefined {
  const candidates = [
    env.OLLAMA_EXE,
    env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe') : undefined,
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',
    '/usr/bin/ollama',
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (found) return found;
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['ollama'], { encoding: 'utf8', windowsHide: true });
  const first = lookup.status === 0 ? String(lookup.stdout).split(/\r?\n/).find((l) => l.trim()) : undefined;
  return first?.trim();
}

/** Reads the real graphics memory (Win32 reports at most 4 GB, so the driver registry value is used). */
function detectGpu(): { gpu?: string; vramGb?: number } {
  if (process.platform !== 'win32') return {};
  const script = [
    "$c = Get-ItemProperty 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue",
    "$best = $c | Where-Object { $_.'HardwareInformation.qwMemorySize' } | Sort-Object { [uint64]$_.'HardwareInformation.qwMemorySize' } -Descending | Select-Object -First 1",
    "if ($best) { '{0}|{1}' -f $best.DriverDesc, [uint64]$best.'HardwareInformation.qwMemorySize' }",
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15_000 });
  const line = String(result.stdout ?? '').trim().split(/\r?\n/).pop() ?? '';
  const [gpu, bytes] = line.split('|');
  const vram = Number(bytes);
  return Number.isFinite(vram) && vram > 0 ? { gpu: gpu?.trim(), vramGb: Math.round(vram / 1024 ** 3) } : {};
}

/** Runs a CLI without blocking the server and parses its JSON stdout (undefined on failure). */
function runJson(exe: string, args: string[], timeout: number, input?: string): Promise<unknown> {
  return new Promise((resolvePromise) => {
    const child = spawn(exe, args, { windowsHide: true, shell: false, env: cleanClaudeEnvironment() });
    let stdout = '';
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', () => { clearTimeout(timer); resolvePromise(undefined); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        resolvePromise(JSON.parse(stdout.trim()));
      } catch {
        resolvePromise(undefined);
      }
    });
    child.stdin.end(input ?? '');
  });
}
