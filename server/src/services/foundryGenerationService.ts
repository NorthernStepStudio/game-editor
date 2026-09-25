import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import {
  FoundryAssetCatalog,
  FoundryAssetForge,
  FoundryAssetProviderRegistry,
  SPRITE_FUSION_CREDIT_CURRENCY,
  SPRITE_FUSION_REQUEST_CREDITS,
  SPRITE_FUSION_PROVIDER_DESCRIPTOR,
  SpriteFusionAssetProvider,
  type FoundryAssetCost,
  type FoundryAssetExecution,
  type FoundryAssetKind,
  type FoundryAssetOperation,
  type FoundryAssetProvider,
  type FoundryAssetRequest,
  type FoundryAssetRoutingPolicy,
} from '../../../core/out/index.js';
import type { StudioProject } from './studioService.js';
import type { FoundryAssetService } from './foundryAssetService.js';

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
  readonly operations: readonly FoundryAssetOperation[];
  readonly kinds: readonly FoundryAssetKind[];
  readonly note: string;
  readonly estimatedCost?: FoundryAssetCost;
}

export interface FoundryGenerationServiceOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly providers?: readonly FoundryAssetProvider[];
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
  private busy = false;

  constructor(
    private readonly projects: readonly StudioProject[],
    private readonly assets: FoundryAssetService,
    options: FoundryGenerationServiceOptions = {},
  ) {
    this.env = options.env ?? process.env;
    this.catalog.registerMany(this.assets.store.list());

    if (options.providers) {
      for (const provider of options.providers) this.registry.register(provider);
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
          : 'Set SPRITE_FUSION_API_KEY on the Matterhorn server to enable this provider.',
        estimatedCost: {
          currency: SPRITE_FUSION_CREDIT_CURRENCY,
          amount: SPRITE_FUSION_REQUEST_CREDITS,
        },
      },
    ];

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
      operations: comfy?.operations ?? [],
      kinds: comfy?.kinds ?? [],
      note: comfy
        ? 'Configured with server-owned workflows.'
        : 'Local adapter is installed, but no server-owned ComfyUI workflows are configured yet.',
    });

    for (const descriptor of configured.values()) {
      if (
        descriptor.id === SPRITE_FUSION_PROVIDER_DESCRIPTOR.id ||
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
        note: 'Configured server-side.',
      });
    }

    return statuses.sort((a, b) => a.id.localeCompare(b.id));
  }

  async execute(raw: unknown): Promise<FoundryAssetExecution> {
    if (this.busy) {
      throw new Error('Another Foundry generation is already in progress.');
    }

    const body = this.parseBody(raw);
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

    if (body.providerId) {
      const requestedProvider = this.registry.get(body.providerId);
      if (!requestedProvider) {
        throw new Error(`Foundry provider is not configured: ${body.providerId}`);
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
      allowNetwork: body.allowNetwork,
      allowExternalCost: body.approveExternalCost,
      requireCommercialUse: body.requireCommercialUse,
      ...(body.providerId ? { allowedProviders: [body.providerId] } : {}),
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
        },
      });
    } finally {
      this.busy = false;
    }
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
