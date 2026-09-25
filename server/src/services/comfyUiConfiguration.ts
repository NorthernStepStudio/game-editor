import { createHash } from 'node:crypto';
import {
  ComfyUIAssetProvider,
  type ComfyUIWorkflow,
  type FoundryAssetKind,
  type FoundryAssetProvider,
  type FoundryAssetRequest,
  type FoundryLicenseClassification,
  type FoundryLicenseRecord,
  type FoundryReusePolicy,
} from '../../../core/out/index.js';

const DEFAULT_KINDS: readonly FoundryAssetKind[] = [
  'concept_art',
  'background',
  'texture',
];

const LICENSE_CLASSIFICATIONS = new Set<FoundryLicenseClassification>([
  'permissive',
  'weak-copyleft',
  'copyleft',
  'public-domain',
  'source-available',
  'proprietary',
  'unlicensed',
  'unknown',
]);

const REUSE_POLICIES = new Set<FoundryReusePolicy>([
  'direct',
  'adapter-only',
  'clean-room-reimplement',
  'reference-only',
  'blocked',
  'review-required',
]);

export interface ComfyUiServerConfiguration {
  readonly configured: boolean;
  readonly provider?: FoundryAssetProvider;
  readonly note: string;
}

export interface StandardComfyUiWorkflowOptions {
  readonly checkpoint: string;
  readonly negativePrompt?: string;
  readonly steps?: number;
  readonly cfg?: number;
}

export function configureComfyUiProvider(
  env: NodeJS.ProcessEnv = process.env,
): ComfyUiServerConfiguration {
  const checkpoint = trim(env.MATTERHORN_COMFYUI_CHECKPOINT);
  if (!checkpoint) {
    return {
      configured: false,
      note:
        'Configure a local ComfyUI checkpoint on the Matterhorn server to enable generation.',
    };
  }

  const commercialUseAllowed = parseBoolean(
    env.MATTERHORN_COMFYUI_COMMERCIAL_USE_ALLOWED,
    false,
    'MATTERHORN_COMFYUI_COMMERCIAL_USE_ALLOWED',
  );
  const outputLicense = parseOutputLicense(env, commercialUseAllowed);
  const kinds = parseKinds(env.MATTERHORN_COMFYUI_KINDS);
  const steps = parseInteger(
    env.MATTERHORN_COMFYUI_STEPS,
    20,
    1,
    100,
    'MATTERHORN_COMFYUI_STEPS',
  );
  const cfg = parseNumber(
    env.MATTERHORN_COMFYUI_CFG,
    7,
    0.1,
    50,
    'MATTERHORN_COMFYUI_CFG',
  );
  const baseUrl = trim(env.MATTERHORN_COMFYUI_BASE_URL);
  const negativePrompt =
    trim(env.MATTERHORN_COMFYUI_NEGATIVE_PROMPT) ??
    'blurry, low quality, artifacts, text, watermark';

  const provider = new ComfyUIAssetProvider({
    ...(baseUrl ? { baseUrl } : {}),
    workflows: {
      generate: (request) =>
        createStandardComfyUiWorkflow(request, {
          checkpoint,
          negativePrompt,
          steps,
          cfg,
        }),
    },
    kinds,
    outputLicense,
    commercialUseAllowed,
    supportsSeed: true,
    supportsReferences: false,
    modelName: checkpoint,
  });

  return {
    configured: true,
    provider,
    note: commercialUseAllowed
      ? 'Configured locally with explicit commercial-use license approval.'
      : 'Configured locally. Commercial-use eligibility is not approved; review the checkpoint license before production use.',
  };
}

export function createStandardComfyUiWorkflow(
  request: FoundryAssetRequest,
  options: StandardComfyUiWorkflowOptions,
): ComfyUIWorkflow {
  const width = request.dimensions?.width ?? 512;
  const height = request.dimensions?.height ?? 512;
  if (width % 8 !== 0 || height % 8 !== 0) {
    throw new Error('ComfyUI image dimensions must be divisible by 8.');
  }

  const seed = normalizeSeed(request.seed ?? request.requestId);
  const prompt = request.prompt?.trim() || request.assetId;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: options.checkpoint,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: prompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: options.negativePrompt ?? '',
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: options.steps ?? 20,
        cfg: options.cfg ?? 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'Matterhorn',
        images: ['6', 0],
      },
    },
  };
}

function parseOutputLicense(
  env: NodeJS.ProcessEnv,
  commercialUseAllowed: boolean,
): FoundryLicenseRecord {
  const name =
    trim(env.MATTERHORN_COMFYUI_OUTPUT_LICENSE_NAME) ??
    'ComfyUI checkpoint/workflow output license not declared';
  const classificationRaw =
    trim(env.MATTERHORN_COMFYUI_OUTPUT_LICENSE_CLASSIFICATION) ?? 'unknown';
  const reuseRaw =
    trim(env.MATTERHORN_COMFYUI_OUTPUT_REUSE_POLICY) ?? 'review-required';

  if (!LICENSE_CLASSIFICATIONS.has(classificationRaw as FoundryLicenseClassification)) {
    throw new Error(
      'MATTERHORN_COMFYUI_OUTPUT_LICENSE_CLASSIFICATION is invalid.',
    );
  }
  if (!REUSE_POLICIES.has(reuseRaw as FoundryReusePolicy)) {
    throw new Error('MATTERHORN_COMFYUI_OUTPUT_REUSE_POLICY is invalid.');
  }

  const classification =
    classificationRaw as FoundryLicenseClassification;
  const reusePolicy = reuseRaw as FoundryReusePolicy;

  if (commercialUseAllowed) {
    if (
      !trim(env.MATTERHORN_COMFYUI_OUTPUT_LICENSE_NAME) ||
      classification === 'unknown' ||
      classification === 'unlicensed' ||
      reusePolicy !== 'direct'
    ) {
      throw new Error(
        'Commercial-use ComfyUI configuration requires an explicit license name, a known classification, and direct output reuse policy.',
      );
    }
  }

  return {
    name,
    ...(trim(env.MATTERHORN_COMFYUI_OUTPUT_LICENSE_SPDX)
      ? { spdxId: trim(env.MATTERHORN_COMFYUI_OUTPUT_LICENSE_SPDX)! }
      : {}),
    classification,
    reusePolicy,
    notes: commercialUseAllowed
      ? 'Commercial-use status was explicitly configured by the Matterhorn operator.'
      : 'Commercial-use status was not approved by the Matterhorn operator.',
  };
}

function parseKinds(value: string | undefined): readonly FoundryAssetKind[] {
  const raw = trim(value);
  if (!raw) return DEFAULT_KINDS;

  const valid = new Set<FoundryAssetKind>([
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

  const result = [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
    .map((item) => {
      if (!valid.has(item as FoundryAssetKind)) {
        throw new Error(`Unsupported MATTERHORN_COMFYUI_KINDS value: ${item}`);
      }
      return item as FoundryAssetKind;
    });

  if (!result.length) {
    throw new Error('MATTERHORN_COMFYUI_KINDS must contain at least one asset kind.');
  }
  return result;
}

function normalizeSeed(value: string | number): number {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return value;
  }

  const digest = createHash('sha256').update(String(value)).digest();
  return digest.readUInt32BE(0);
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  field: string,
): boolean {
  const raw = trim(value);
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${field} must be true or false.`);
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): number {
  const raw = trim(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function parseNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): number {
  const raw = trim(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function trim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
