import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  BlenderAgentAssetProvider,
  ClaudeCodeScriptAuthor,
  OllamaScriptAuthor,
  findBlenderExecutable,
  findClaudeCodeExecutable,
  FoundryAssetCatalog,
  FoundryAssetForge,
  FoundryAssetProviderRegistry,
  MESHY_CREDIT_CURRENCY,
  MESHY_PROVIDER_DESCRIPTOR,
  MESHY_REQUEST_CREDITS,
  MeshyImageTo3DProvider,
  SPRITE_FUSION_CREDIT_CURRENCY,
  SPRITE_FUSION_REQUEST_CREDITS,
  SPRITE_FUSION_PROVIDER_DESCRIPTOR,
  SpriteFusionAssetProvider,
  type FoundryAssetCost,
  type FoundryAssetExecution,
  type FoundryLiveUpdate,
  type FoundryAssetKind,
  type FoundryAssetOperation,
  type FoundryAssetProvider,
  type FoundryAssetRequest,
  type FoundryAssetRoutingPolicy,
} from '../../../core/out/index.js';
import type { StudioProject } from './studioService.js';
import type { FoundryAssetService } from './foundryAssetService.js';
import type { FoundryStyleStore } from './foundryStyles.js';
import { configureComfyUiProvider } from './comfyUiConfiguration.js';
import type { StudioRoutingPreferences } from './studioRoutingPreferences.js';

const ASSET_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const KINDS = new Set<FoundryAssetKind>([
  'pixel_sprite',
  'sprite_sheet',
  'texture',
  'tile',
  'tileset',
  'ui_icon',
  'ui_atlas',
  'concept_art',
  'background',
  'mesh_3d',
  'material',
  'rig',
  'animation',
  'audio_sfx',
  'audio_music',
  'audio_voice',
  'other',
]);
const OPERATIONS = new Set<FoundryAssetOperation>([
  'generate',
  'edit',
  'style_reference',
  'direction_set',
  'animate',
  'upscale',
  'background_remove',
  'palette_normalize',
  'pack_sheet',
  'image_to_3d',
  'rig',
  'retarget',
  'audio_generate',
  'audio_loop',
]);

export interface FoundryProviderStatus {
  readonly id: string;
  readonly name: string;
  readonly configured: boolean;
  readonly available: boolean;
  readonly local: boolean;
  readonly requiresNetwork: boolean;
  readonly externalCost: boolean;
  readonly commercialUseAllowed: boolean;
  readonly model?: string;
  readonly operations: readonly FoundryAssetOperation[];
  readonly kinds: readonly FoundryAssetKind[];
  readonly note: string;
  readonly estimatedCost?: FoundryAssetCost;
}

export interface FoundryJob {
  readonly jobId: string;
  readonly assetId: string;
  readonly projectId: string;
  readonly kind: FoundryAssetKind;
  readonly prompt?: string;
  readonly displayName?: string;
  readonly draftGroup?: string;
  readonly styleId?: string;
  readonly retryOf?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  readonly progress: { at: string; message: string }[];
  readonly createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  providerId?: string;
  assetIds?: string[];
  error?: string;
  /** The submitted request, kept so a failed build can be retried. Not exposed to the browser. */
  readonly input: Record<string, unknown>;
}

export type FoundryJobView = Readonly<Omit<FoundryJob, 'input'>>;

export interface FoundryGenerationServiceOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly providers?: readonly FoundryAssetProvider[];
  readonly routingPreferences?: () => StudioRoutingPreferences;
  readonly styles?: FoundryStyleStore;
  /** The user's chosen local model for writing Blender scripts (read at build time). */
  readonly assetModel?: () => string | undefined;
  /** Where build history is kept; defaults to the asset store's data directory. */
  readonly jobsPath?: string | false;
}

interface GenerationBody {
  readonly projectId?: unknown;
  readonly assetId?: unknown;
  readonly kind?: unknown;
  readonly operation?: unknown;
  readonly prompt?: unknown;
  readonly parentAsset?: unknown;
  readonly referenceAssets?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
  readonly providerId?: unknown;
  readonly allowNetwork?: unknown;
  readonly approveExternalCost?: unknown;
  readonly maxCost?: unknown;
  readonly requireCommercialUse?: unknown;
}

export class FoundryGenerationService {
  private readonly registry = new FoundryAssetProviderRegistry();
  private readonly catalog = new FoundryAssetCatalog();
  private readonly forge: FoundryAssetForge;
  private readonly env: NodeJS.ProcessEnv;
  private readonly routingPreferences?: () => StudioRoutingPreferences;
  private comfyConfigurationNote =
    'Configure a local ComfyUI checkpoint on the Matterhorn server to enable generation.';
  private comfyModelLabel?: string;
  private busy = false;
  private readonly blenderAgentNotes = new Map<string, string>();
  private readonly jobs = new Map<string, FoundryJob>();
  private jobQueue: Promise<void> = Promise.resolve();
  private readonly aborts = new Map<string, AbortController>();
  /** What a running build is doing right now (kept in memory only; it is a view, not history). */
  private readonly liveViews = new Map<string, { script?: string; thinking?: number; frames: string[]; updatedAt: string }>();
  private readonly styles?: FoundryStyleStore;
  private readonly jobsPath?: string;
  private readonly assetModel?: () => string | undefined;

  constructor(
    private readonly projects: readonly StudioProject[],
    private readonly assets: FoundryAssetService,
    options: FoundryGenerationServiceOptions = {},
  ) {
    this.env = options.env ?? process.env;
    this.routingPreferences = options.routingPreferences;
    this.styles = options.styles;
    this.assetModel = options.assetModel;
    this.jobsPath = options.jobsPath === false
      ? undefined
      : options.jobsPath ?? join(this.assets.dataDirectory, 'foundry-assets', 'jobs.json');
    this.loadJobs();
    this.catalog.registerMany(this.assets.store.list());

    if (options.providers) {
      for (const provider of options.providers) this.registry.register(provider);
      if (this.registry.get('comfyui-local')) {
        this.comfyConfigurationNote =
          'Configured with an injected server-owned ComfyUI workflow.';
      }
    } else {
      const spriteFusionApiKey = this.env.SPRITE_FUSION_API_KEY?.trim();
      if (spriteFusionApiKey) {
        this.registry.register(
          new SpriteFusionAssetProvider({
            apiKey: spriteFusionApiKey,
            catalog: this.catalog,
          }),
        );
      }

      const comfy = configureComfyUiProvider(this.env);
      this.comfyConfigurationNote = comfy.note;
      this.comfyModelLabel = comfy.modelLabel;
      if (comfy.provider) this.registry.register(comfy.provider);

      this.registerBlenderAgents();

      const meshyKey = this.env.MESHY_API_KEY?.trim();
      if (meshyKey) {
        this.registry.register(new MeshyImageTo3DProvider({
          apiKey: meshyKey,
          resolveImagePath: (assetId) => {
            const file = this.assets.store.get(assetId)?.localPath;
            return file && /\.(png|jpe?g|webp)$/i.test(file) && existsSync(file) ? file : undefined;
          },
        }));
      }
    }

    this.forge = new FoundryAssetForge(this.registry, {
      onExecution: (execution) => {
        this.assets.registerExecution(execution);
        this.catalog.registerExecution(execution);
      },
    });
  }

  providers(): readonly FoundryProviderStatus[] {
    const configured = new Map(
      this.registry.list().map((descriptor) => [descriptor.id, descriptor]),
    );
    const spriteFusion = configured.get(SPRITE_FUSION_PROVIDER_DESCRIPTOR.id);

    const statuses: FoundryProviderStatus[] = [
      {
        id: SPRITE_FUSION_PROVIDER_DESCRIPTOR.id,
        name: SPRITE_FUSION_PROVIDER_DESCRIPTOR.name,
        configured: Boolean(spriteFusion),
        available: Boolean(spriteFusion),
        local: false,
        requiresNetwork: true,
        externalCost: true,
        commercialUseAllowed: true,
        operations: SPRITE_FUSION_PROVIDER_DESCRIPTOR.operations,
        kinds: SPRITE_FUSION_PROVIDER_DESCRIPTOR.kinds,
        note: spriteFusion
          ? 'Configured. Paid generation still requires an explicit per-request credit budget.'
          : 'Configure Sprite Fusion API credentials on the Matterhorn server to enable this provider.',
        estimatedCost: {
          currency: SPRITE_FUSION_CREDIT_CURRENCY,
          amount: SPRITE_FUSION_REQUEST_CREDITS,
        },
      },
    ];

    const meshy = configured.get(MESHY_PROVIDER_DESCRIPTOR.id);
    statuses.push({
      id: MESHY_PROVIDER_DESCRIPTOR.id,
      name: MESHY_PROVIDER_DESCRIPTOR.name,
      configured: Boolean(meshy),
      available: Boolean(meshy),
      local: false,
      requiresNetwork: true,
      externalCost: true,
      commercialUseAllowed: true,
      operations: MESHY_PROVIDER_DESCRIPTOR.operations,
      kinds: MESHY_PROVIDER_DESCRIPTOR.kinds,
      note: meshy
        ? 'Configured. Turns 1–4 views of a character into a textured 3D model; each build asks for your approval and a credit budget first.'
        : 'Turns a character sheet into a 3D model. Create a Meshy account, copy your API key, and add MESHY_API_KEY=your-key to the .env file, then restart Matterhorn.',
      estimatedCost: { currency: MESHY_CREDIT_CURRENCY, amount: MESHY_REQUEST_CREDITS },
    });

    const comfy = configured.get('comfyui-local');
    statuses.push({
      id: 'comfyui-local',
      name: comfy?.name ?? 'ComfyUI Local',
      configured: Boolean(comfy),
      available: Boolean(comfy),
      local: true,
      requiresNetwork: false,
      externalCost: false,
      commercialUseAllowed: comfy?.commercialUseAllowed ?? false,
      ...(this.comfyModelLabel ? { model: this.comfyModelLabel } : {}),
      operations: comfy?.operations ?? [],
      kinds: comfy?.kinds ?? [],
      note: this.comfyConfigurationNote,
    });

    for (const [id, note] of this.blenderAgentNotes) {
      if (configured.has(id)) continue;
      statuses.push({
        id,
        name: id === 'blender-agent-claude' ? 'Blender Agent (Claude Code)' : 'Blender Agent (local model)',
        configured: false,
        available: false,
        local: id !== 'blender-agent-claude',
        requiresNetwork: id === 'blender-agent-claude',
        externalCost: false,
        commercialUseAllowed: true,
        operations: [],
        kinds: [],
        note,
      });
    }

    for (const descriptor of configured.values()) {
      if (
        descriptor.id === SPRITE_FUSION_PROVIDER_DESCRIPTOR.id ||
        descriptor.id === MESHY_PROVIDER_DESCRIPTOR.id ||
        descriptor.id === 'comfyui-local'
      ) {
        continue;
      }
      statuses.push({
        id: descriptor.id,
        name: descriptor.name,
        configured: true,
        available: true,
        local: descriptor.local,
        requiresNetwork: descriptor.requiresNetwork,
        externalCost: descriptor.externalCost,
        commercialUseAllowed: descriptor.commercialUseAllowed,
        operations: descriptor.operations,
        kinds: descriptor.kinds,
        note: this.blenderAgentNotes.get(descriptor.id) ?? 'Configured server-side.',
      });
    }

    return statuses.sort((a, b) => a.id.localeCompare(b.id));
  }

  async execute(
    raw: unknown,
    onProgress?: (message: string) => void,
    signal?: AbortSignal,
    onLive?: (update: FoundryLiveUpdate) => void,
  ): Promise<FoundryAssetExecution> {
    if (this.busy) {
      throw new Error('Another Foundry generation is already in progress.');
    }

    const body = this.parseBody(raw);
    const preferences = this.routingPreferences?.();
    const preferredProviderId =
      preferences?.assets && preferences.assets !== 'auto'
        ? preferences.assets
        : undefined;
    const effectiveProviderId = body.providerId ?? preferredProviderId;
    const effectiveRequireCommercialUse =
      Boolean(preferences?.requireCommercialUse) || body.requireCommercialUse;

    const project = this.projects.find((candidate) => candidate.id === body.projectId);
    if (!project) throw new Error('Select a configured project for asset generation.');
    if (!existsSync(project.path)) {
      throw new Error('The configured project path does not exist.');
    }
    const projectInfo = lstatSync(project.path);
    if (!projectInfo.isDirectory() || projectInfo.isSymbolicLink()) {
      throw new Error('The configured project path must be a real directory.');
    }

    const collision = this.assets.store
      .list()
      .find((asset) => assetIdCollides(body.assetId, asset.assetId));
    if (collision) {
      throw new Error(
        `Asset ID ${body.assetId} would collide with existing asset ${collision.assetId}. Choose a new asset ID before generation.`,
      );
    }

    const request: FoundryAssetRequest = {
      requestId: randomUUID(),
      assetId: body.assetId,
      kind: body.kind,
      operation: body.operation,
      ...(body.prompt ? { prompt: body.prompt } : {}),
      ...(body.parentAsset ? { parentAsset: body.parentAsset } : {}),
      ...(body.referenceAssets.length
        ? { referenceAssets: body.referenceAssets }
        : {}),
      ...(body.width && body.height
        ? { dimensions: { width: body.width, height: body.height } }
        : {}),
    };

    for (const assetId of [
      ...(request.referenceAssets ?? []),
      ...(request.parentAsset ? [request.parentAsset] : []),
    ]) {
      if (!this.assets.store.get(assetId)) {
        throw new Error(`Referenced asset is not in the Foundry catalog: ${assetId}`);
      }
    }

    if (effectiveProviderId) {
      const requestedProvider = this.registry.get(effectiveProviderId);
      if (!requestedProvider) {
        throw new Error(`Foundry provider is not configured: ${effectiveProviderId}`);
      }
      if (
        requestedProvider.descriptor.requiresNetwork &&
        preferences &&
        !preferences.allowNetworkProviders
      ) {
        throw new Error(
          `Provider ${requestedProvider.descriptor.name} is blocked by Studio routing settings because network providers are disabled.`,
        );
      }
      if (
        requestedProvider.descriptor.externalCost &&
        preferences &&
        !preferences.allowExternalCostProviders
      ) {
        throw new Error(
          `Provider ${requestedProvider.descriptor.name} is blocked by Studio routing settings because external-cost providers are disabled.`,
        );
      }
      if (requestedProvider.descriptor.requiresNetwork && !body.allowNetwork) {
        throw new Error(
          `Provider ${requestedProvider.descriptor.name} requires explicit network approval.`,
        );
      }
      if (
        requestedProvider.descriptor.externalCost &&
        !body.approveExternalCost
      ) {
        throw new Error(
          `Provider ${requestedProvider.descriptor.name} requires explicit external-cost approval.`,
        );
      }
      if (requestedProvider.descriptor.externalCost && !body.maxCost) {
        throw new Error(
          `Provider ${requestedProvider.descriptor.name} requires an explicit cost budget.`,
        );
      }
    }

    const routing: FoundryAssetRoutingPolicy = {
      localFirst: preferences?.localFirst ?? true,
      allowNetwork: body.allowNetwork,
      allowExternalCost: body.approveExternalCost,
      requireCommercialUse: effectiveRequireCommercialUse,
      ...(effectiveProviderId ? { allowedProviders: [effectiveProviderId] } : {}),
      ...(body.maxCost ? { maxEstimatedCost: body.maxCost } : {}),
    };

    const selected = this.registry.select(request, routing);
    if (selected.descriptor.externalCost) {
      if (!body.approveExternalCost) {
        throw new Error(
          `Provider ${selected.descriptor.name} requires explicit external-cost approval.`,
        );
      }
      if (!body.maxCost) {
        throw new Error(
          `Provider ${selected.descriptor.name} requires an explicit cost budget.`,
        );
      }
      if (
        selected.descriptor.id === SPRITE_FUSION_PROVIDER_DESCRIPTOR.id &&
        body.maxCost.currency !== SPRITE_FUSION_CREDIT_CURRENCY
      ) {
        throw new Error(
          `Sprite Fusion budgets must use ${SPRITE_FUSION_CREDIT_CURRENCY}.`,
        );
      }
    }

    const outputRoot = join(project.path, 'assets', 'generated', 'foundry');
    this.busy = true;
    try {
      return await this.forge.execute(request, {
        routing,
        context: {
          projectId: project.id,
          outputRoot,
          ...(onProgress ? { onProgress } : {}),
          ...(signal ? { signal } : {}),
          ...(onLive ? { onLive } : {}),
        },
      });
    } finally {
      this.busy = false;
    }
  }

  /** Queues a generation to run in the background; long Blender Agent builds report progress here. */
  submitJob(raw: unknown, retryOf?: string): FoundryJobView {
    const body = this.parseBody(raw);
    if (!this.projects.some((project) => project.id === body.projectId)) {
      throw new Error('Select a configured project for asset generation.');
    }
    const clash = [...this.jobs.values()].find(
      (job) => job.assetId === body.assetId && (job.status === 'queued' || job.status === 'running'),
    );
    if (clash) throw new Error(`Asset ${body.assetId} is already queued.`);

    const extra = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const displayName = typeof extra.displayName === 'string' && extra.displayName.trim()
      ? extra.displayName.trim().slice(0, 80)
      : undefined;
    const draftGroup = typeof extra.draftGroup === 'string' && /^[a-zA-Z0-9_.-]{1,120}$/.test(extra.draftGroup)
      ? extra.draftGroup
      : undefined;
    const style = typeof extra.styleId === 'string' && extra.styleId ? this.styles?.get(extra.styleId) : undefined;
    if (typeof extra.styleId === 'string' && extra.styleId && !style) throw new Error('That style no longer exists.');

    // The original description is kept for display; the style text is appended only to what the builder sees.
    const input: Record<string, unknown> = {
      ...extra,
      ...(style && body.prompt ? { prompt: `${body.prompt}. Style for this asset: ${style.description}` } : {}),
    };

    const job: FoundryJob = {
      jobId: randomUUID(),
      assetId: body.assetId,
      projectId: body.projectId,
      kind: body.kind,
      ...(body.prompt ? { prompt: body.prompt.slice(0, 400) } : {}),
      ...(displayName ? { displayName } : {}),
      ...(draftGroup ? { draftGroup } : {}),
      ...(style ? { styleId: style.id } : {}),
      ...(retryOf ? { retryOf } : {}),
      status: 'queued',
      progress: [],
      createdAt: new Date().toISOString(),
      input,
    };
    this.jobs.set(job.jobId, job);
    this.trimJobs();
    this.persistJobs();
    this.jobQueue = this.jobQueue.then(() => this.runJob(job));
    return this.jobView(job);
  }

  /** Queues the same request again under a fresh asset id (failed or cancelled builds only). */
  retryJob(jobId: string, overrides: { providerId?: unknown } = {}): FoundryJobView {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Build not found.');
    if (job.status !== 'failed' && job.status !== 'cancelled') throw new Error('Only failed or cancelled builds can be retried.');
    const base = job.assetId.replace(/_r\d+$/, '');
    let assetId = `${base}_r2`;
    for (let n = 2; this.assets.store.get(assetId) || [...this.jobs.values()].some((j) => j.assetId === assetId); n++) {
      assetId = `${base}_r${n + 1}`;
    }
    return this.submitJob({
      ...job.input,
      assetId,
      ...(typeof overrides.providerId === 'string' ? { providerId: overrides.providerId, allowNetwork: true } : {}),
      // Style already folded into input.prompt on the first submission.
      styleId: undefined,
    }, job.jobId);
  }

  /** Cancels a queued build immediately, or stops a running one at its next safe point. */
  cancelJob(jobId: string): FoundryJobView {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Build not found.');
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.finishedAt = new Date().toISOString();
      job.error = 'Cancelled before it started.';
    } else if (job.status === 'running') {
      this.aborts.get(job.jobId)?.abort();
      job.progress.push({ at: new Date().toISOString(), message: 'Cancelling…' });
    } else {
      throw new Error('This build has already finished.');
    }
    this.persistJobs();
    return this.jobView(job);
  }

  /** A style-matched set: every item shares the pack style and is built one after another. */
  submitPack(raw: unknown): readonly FoundryJobView[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Pack request must be an object.');
    const body = raw as Record<string, unknown>;
    const packId = stringField(body.packId, 'packId', 60);
    if (!/^[a-zA-Z0-9_-]+$/.test(packId)) {
      throw new Error('packId must contain only letters, numbers, underscores, and dashes.');
    }
    const style = stringField(body.style, 'style', 1000);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 12) {
      throw new Error('A pack needs between 1 and 12 items.');
    }
    const items = body.items.map((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') throw new Error(`Pack item ${index + 1} is invalid.`);
      const record = item as Record<string, unknown>;
      const name = stringField(record.name, 'name', 60);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${index + 1}`;
      return { slug, name, prompt: stringField(record.prompt ?? name, 'prompt', 2000) };
    });
    if (new Set(items.map((item) => item.slug)).size !== items.length) {
      throw new Error('Pack item names must be distinct.');
    }
    const { packId: _packId, style: _style, items: _items, ...shared } = body;
    return items.map((item) => this.submitJob({
      ...shared,
      assetId: `${packId}_${item.slug}`,
      displayName: `${item.name} (${packId})`,
      prompt: `${item.prompt}. Shared pack style (keep it consistent with the rest of the set): ${style}`,
    }));
  }

  /** The live view of a build: the script as it is being written and the latest image. */
  liveView(jobId: string): { readonly status: FoundryJob['status']; readonly script?: string; readonly thinking?: number; readonly frames: number; readonly updatedAt?: string } | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const live = this.liveViews.get(jobId);
    return {
      status: job.status,
      ...(live?.script !== undefined ? { script: live.script } : {}),
      frames: live?.frames.length ?? 0,
      ...(live?.thinking ? { thinking: live.thinking } : {}),
      ...(live ? { updatedAt: live.updatedAt } : {}),
    };
  }

  /** One picture of the live view by its position (the latest when no position is given). */
  liveImage(jobId: string, index?: number): string | undefined {
    const frames = this.liveViews.get(jobId)?.frames ?? [];
    const image = index === undefined ? frames.at(-1) : frames[index];
    return image && existsSync(image) ? image : undefined;
  }

  listJobs(): readonly FoundryJobView[] {
    return [...this.jobs.values()].reverse().map((job) => this.jobView(job));
  }

  getJob(jobId: string): FoundryJobView | undefined {
    const job = this.jobs.get(jobId);
    return job ? this.jobView(job) : undefined;
  }

  private async runJob(job: FoundryJob): Promise<void> {
    if (job.status !== 'queued') return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    const abort = new AbortController();
    this.aborts.set(job.jobId, abort);
    this.persistJobs();
    const progress = (message: string) => {
      job.progress.push({ at: new Date().toISOString(), message: message.slice(0, 500) });
      if (job.progress.length > 60) job.progress.splice(0, job.progress.length - 60);
      this.persistJobs();
    };
    try {
      const live = (update: FoundryLiveUpdate) => {
        const current = this.liveViews.get(job.jobId) ?? { frames: [], updatedAt: '' };
        // Every picture is kept in order so the viewer can play the whole assembly, not just the latest.
        const frames = update.image ? [...current.frames, update.image].slice(-200) : current.frames;
        this.liveViews.set(job.jobId, {
          ...current,
          ...(update.script !== undefined ? { script: update.script.slice(-40_000) } : {}),
          ...(update.thinking !== undefined ? { thinking: update.thinking } : {}),
          frames,
          updatedAt: new Date().toISOString(),
        });
      };
      const execution = await this.execute(job.input, progress, abort.signal, live);
      job.assetIds = execution.manifests.map((manifest) => manifest.assetId);
      job.providerId = execution.provider.id;
      job.status = 'succeeded';
      for (const assetId of job.assetIds) {
        this.assets.setMeta(assetId, {
          ...(job.displayName ? { displayName: job.displayName } : {}),
          ...(job.prompt ? { prompt: job.prompt } : {}),
          ...(job.draftGroup ? { draftGroup: job.draftGroup } : {}),
          ...(job.styleId ? { styleId: job.styleId } : {}),
        });
      }
    } catch (error) {
      if (abort.signal.aborted) {
        job.status = 'cancelled';
        job.error = 'Cancelled.';
      } else {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      job.finishedAt = new Date().toISOString();
      this.aborts.delete(job.jobId);
      this.persistJobs();
    }
  }

  private jobView(job: FoundryJob): FoundryJobView {
    const { input: _input, ...view } = job;
    return structuredClone(view);
  }

  private trimJobs(): void {
    const finished = [...this.jobs.values()].filter((job) => job.status !== 'queued' && job.status !== 'running');
    for (const job of finished.slice(0, Math.max(0, this.jobs.size - 300))) this.jobs.delete(job.jobId);
  }

  private loadJobs(): void {
    if (!this.jobsPath || !existsSync(this.jobsPath)) return;
    try {
      const saved = JSON.parse(readFileSync(this.jobsPath, 'utf8')) as { jobs?: FoundryJob[] };
      for (const job of saved.jobs ?? []) {
        if (job.status === 'queued' || job.status === 'running') {
          // Never resubmit automatically: the user decides whether to retry interrupted work.
          job.status = 'failed';
          job.error = 'Matterhorn restarted before this build finished. Retry it if you still want it.';
          job.finishedAt = new Date().toISOString();
        }
        this.jobs.set(job.jobId, job);
      }
    } catch {
      // A damaged history file must not stop the server; it is rewritten on the next change.
    }
  }

  private persistJobs(): void {
    if (!this.jobsPath) return;
    try {
      mkdirSync(dirname(this.jobsPath), { recursive: true });
      const temp = `${this.jobsPath}.tmp`;
      writeFileSync(temp, JSON.stringify({ version: 1, jobs: [...this.jobs.values()] }), 'utf8');
      renameSync(temp, this.jobsPath);
    } catch {
      // History is a convenience; a failed write never fails the build itself.
    }
  }

  private registerBlenderAgents(): void {
    const blender = findBlenderExecutable();
    const ollamaModel =
      this.env.MATTERHORN_ASSET_AGENT_OLLAMA_MODEL?.trim() ||
      this.env.OLLAMA_MODEL?.trim() ||
      this.env.M_CORE_OLLAMA_MODEL?.trim();
    const ollamaBase =
      this.env.OLLAMA_BASE_URL?.trim() ||
      this.env.M_CORE_OLLAMA_BASE_URL?.trim() ||
      'http://127.0.0.1:11434';
    const claude = findClaudeCodeExecutable(this.env);
    const resolveParentScript = (assetId: string) => this.parentScript(assetId);
    const resolveParentFile = (assetId: string) => this.parentFile(assetId);

    if (!blender) {
      const note = 'Install Blender 4.2 or newer (or set MATTERHORN_BLENDER_BIN) to build assets from a description.';
      this.blenderAgentNotes.set('blender-agent-local', note);
      this.blenderAgentNotes.set('blender-agent-claude', note);
      return;
    }

    if (ollamaModel || this.assetModel) {
      const chosen = this.assetModel;
      this.registry.register(new BlenderAgentAssetProvider({
        author: new OllamaScriptAuthor(ollamaBase, () => chosen?.() ?? ollamaModel),
        blenderExecutable: blender,
        resolveParentScript,
        resolveParentFile,
      }));
      this.blenderAgentNotes.set(
        'blender-agent-local',
        'Local and free: your chosen local model writes the Blender script on this PC (Settings › AI). Good for simple props; Claude Code builds better multi-part assets.',
      );
    } else {
      this.blenderAgentNotes.set('blender-agent-local', 'Set OLLAMA_MODEL on the Matterhorn server to build assets with a local model.');
    }

    if (claude) {
      this.registry.register(new BlenderAgentAssetProvider({
        author: new ClaudeCodeScriptAuthor(claude, this.env.MATTERHORN_ASSET_AGENT_CLAUDE_MODEL?.trim() || undefined),
        blenderExecutable: blender,
        resolveParentScript,
        resolveParentFile,
      }));
      this.blenderAgentNotes.set(
        'blender-agent-claude',
        'Uses your Claude subscription through Claude Code (sign in once by running `claude`). Allow network providers in routing settings to use it.',
      );
    } else {
      this.blenderAgentNotes.set(
        'blender-agent-claude',
        'Install Claude Code (npm install -g @anthropic-ai/claude-code) and sign in to build higher-quality assets.',
      );
    }
  }

  /** An existing asset's own 3D file, so work can continue on assets made outside the Blender Agent. */
  private parentFile(assetId: string): string | undefined {
    const manifest = this.assets.store.get(assetId);
    if (!manifest) return undefined;
    const candidates = [manifest.localPath, ...(manifest.companionFiles ?? [])].filter((file): file is string => Boolean(file));
    const pick = (ext: RegExp) => candidates.find((file) => ext.test(file) && existsSync(file));
    return pick(/\.blend$/i) ?? pick(/\.(glb|gltf)$/i);
  }

  private parentScript(assetId: string): string | undefined {
    const manifest = this.assets.store.get(assetId);
    const script = manifest?.companionFiles?.find((file) => file.endsWith('_script.py'));
    if (!script || !existsSync(script)) return undefined;
    return readFileSync(script, 'utf8');
  }

  private parseBody(raw: unknown): {
    projectId: string;
    assetId: string;
    kind: FoundryAssetKind;
    operation: FoundryAssetOperation;
    prompt?: string;
    parentAsset?: string;
    referenceAssets: string[];
    width?: number;
    height?: number;
    providerId?: string;
    allowNetwork: boolean;
    approveExternalCost: boolean;
    maxCost?: FoundryAssetCost;
    requireCommercialUse: boolean;
  } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Foundry generation body must be an object.');
    }
    const body = raw as GenerationBody;
    const projectId = stringField(body.projectId, 'projectId', 80);
    const assetId = stringField(body.assetId, 'assetId', 120);
    if (!ASSET_ID.test(assetId)) {
      throw new Error('assetId must contain only letters, numbers, dots, underscores, and dashes.');
    }

    const kind = stringField(body.kind, 'kind', 80) as FoundryAssetKind;
    if (!KINDS.has(kind)) throw new Error(`Unsupported Foundry asset kind: ${kind}`);

    const operation = stringField(
      body.operation,
      'operation',
      80,
    ) as FoundryAssetOperation;
    if (!OPERATIONS.has(operation)) {
      throw new Error(`Unsupported Foundry asset operation: ${operation}`);
    }

    const prompt =
      body.prompt === undefined
        ? undefined
        : stringField(body.prompt, 'prompt', 8_000);

    const parentAsset =
      body.parentAsset === undefined
        ? undefined
        : assetIdField(body.parentAsset, 'parentAsset');

    let referenceAssets: string[] = [];
    if (body.referenceAssets !== undefined) {
      if (
        !Array.isArray(body.referenceAssets) ||
        body.referenceAssets.length > 16
      ) {
        throw new Error('referenceAssets must be an array with at most 16 asset IDs.');
      }
      referenceAssets = body.referenceAssets.map((value) =>
        assetIdField(value, 'referenceAssets'),
      );
    }

    const width = optionalDimension(body.width, 'width');
    const height = optionalDimension(body.height, 'height');
    if ((width === undefined) !== (height === undefined)) {
      throw new Error('width and height must be supplied together.');
    }

    const providerId =
      body.providerId === undefined
        ? undefined
        : stringField(body.providerId, 'providerId', 120);

    const allowNetwork = booleanField(body.allowNetwork, false);
    const approveExternalCost = booleanField(body.approveExternalCost, false);
    const requireCommercialUse = booleanField(
      body.requireCommercialUse,
      true,
    );
    const maxCost = parseCost(body.maxCost);

    return {
      projectId,
      assetId,
      kind,
      operation,
      ...(prompt ? { prompt } : {}),
      ...(parentAsset ? { parentAsset } : {}),
      referenceAssets,
      ...(width !== undefined ? { width, height } : {}),
      ...(providerId ? { providerId } : {}),
      allowNetwork,
      approveExternalCost,
      ...(maxCost ? { maxCost } : {}),
      requireCommercialUse,
    };
  }
}


function assetIdCollides(baseAssetId: string, existingAssetId: string): boolean {
  if (existingAssetId === baseAssetId) return true;
  const prefix = `${baseAssetId}-`;
  if (!existingAssetId.startsWith(prefix)) return false;
  const suffix = existingAssetId.slice(prefix.length);
  return /^[0-9]+$/.test(suffix);
}

function stringField(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    throw new Error(`${field} must contain 1-${max} characters.`);
  }
  return trimmed;
}

function assetIdField(value: unknown, field: string): string {
  const valueString = stringField(value, field, 120);
  if (!ASSET_ID.test(valueString)) {
    throw new Error(`${field} contains an invalid asset ID.`);
  }
  return valueString;
}

function optionalDimension(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 4096
  ) {
    throw new Error(`${field} must be an integer between 1 and 4096.`);
  }
  return value;
}

function booleanField(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error('Boolean generation settings must be true or false.');
  }
  return value;
}

function parseCost(value: unknown): FoundryAssetCost | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('maxCost must contain currency and amount.');
  }
  const raw = value as Record<string, unknown>;
  const currency = stringField(raw.currency, 'maxCost.currency', 80);
  if (
    typeof raw.amount !== 'number' ||
    !Number.isFinite(raw.amount) ||
    raw.amount <= 0 ||
    raw.amount > 1_000_000
  ) {
    throw new Error('maxCost.amount must be a positive finite number.');
  }
  return { currency, amount: raw.amount };
}
