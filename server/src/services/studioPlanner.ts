import { createHash } from 'node:crypto';
import type {
  FoundryAssetCost,
  FoundryAssetKind,
  FoundryAssetOperation,
  NssStudioBlenderTaskSpec,
  NssStudioFoundryTaskSpec,
  NssStudioPlan,
  NssStudioPlanTaskInput,
  NssStudioTaskDisclosure,
} from '../../../core/out/index.js';
import { createStudioPlan, validateBlenderTaskSpec } from '../../../core/out/index.js';
import type { StudioProject } from './studioService.js';
import type { FoundryProviderStatus } from './foundryGenerationService.js';
import type { StudioRoutingPreferences } from './studioRoutingPreferences.js';
import { foundryAssetOutputCriterion } from './foundryStudioAdapter.js';

export type StudioPlanningDomain = 'assets' | 'blender' | 'godot';

export interface StudioAssetRequestInput {
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

export interface StudioPlannerRequest {
  readonly id?: string;
  readonly goal: string;
  readonly project: StudioProject;
  readonly criteria: readonly string[];
  readonly domains?: readonly StudioPlanningDomain[];
  readonly assets?: readonly StudioAssetRequestInput[];
  readonly blenderTaskSpec?: unknown;
}

const ASSET_KINDS = new Set<FoundryAssetKind>([
  'pixel_sprite', 'sprite_sheet', 'texture', 'tile', 'tileset', 'ui_icon', 'ui_atlas',
  'concept_art', 'background', 'mesh_3d', 'material', 'rig', 'animation',
  'audio_sfx', 'audio_music', 'audio_voice', 'other',
]);
const ASSET_OPERATIONS = new Set<FoundryAssetOperation>([
  'generate', 'edit', 'style_reference', 'direction_set', 'animate', 'upscale',
  'background_remove', 'palette_normalize', 'pack_sheet', 'image_to_3d', 'rig',
  'retarget', 'audio_generate', 'audio_loop',
]);

export function createStudioPlannerPlan(
  request: StudioPlannerRequest,
  preferences: StudioRoutingPreferences,
  providers: readonly FoundryProviderStatus[],
): NssStudioPlan {
  const goal = request.goal.trim();
  if (goal.length < 3 || goal.length > 8_000) throw new Error('Enter a goal between 3 and 8000 characters.');
  if (!request.criteria.length || request.criteria.length > 20 || request.criteria.some(value => !value.trim() || value.length > 1_000)) {
    throw new Error('Supply 1–20 nonempty acceptance criteria.');
  }

  const id = request.id ?? `studio-plan-${createHash('sha256').update(`${goal}\n${Date.now()}`).digest('hex').slice(0, 20)}`;
  const inferred = inferDomains(goal);
  const domains = new Set(request.domains?.length ? request.domains : inferred);
  if ([...domains].some(domain => !['assets', 'blender', 'godot'].includes(domain))) {
    throw new Error('Planner domain must be assets, blender, or godot.');
  }
  const assetInputs = request.assets?.length ? request.assets : (domains.has('assets') ? inferAssetRequests(goal) : []);
  const assetSpecs = assetInputs.map((input, index) => makeFoundrySpec(input, index, id, goal, request.project.id, preferences));
  const assetTaskIds = new Map(assetSpecs.map((spec, index) => [spec.assetId, `foundry-assets-${index + 1}`]));
  const tasks: NssStudioPlanTaskInput[] = [];

  for (let index = 0; index < assetSpecs.length; index += 1) {
    const spec = assetSpecs[index]!;
    const disclosure = discloseProvider(spec, providers, preferences);
    const dependencies = [spec.parentAsset, ...(spec.referenceAssets ?? [])]
      .filter((assetId): assetId is string => Boolean(assetId))
      .map(assetId => assetTaskIds.get(assetId))
      .filter((taskId): taskId is string => Boolean(taskId));
    tasks.push({
      id: `foundry-assets-${index + 1}`,
      title: `Generate Foundry asset ${spec.assetId}`,
      goal: `Use Foundry to ${spec.operation} ${spec.kind} asset ${spec.assetId}: ${spec.prompt}`,
      domain: 'art',
      specialistId: 'foundry',
      acceptanceCriteria: [foundryAssetOutputCriterion(spec.assetId)],
      ...(dependencies.length ? { dependsOn: [...new Set(dependencies)] } : {}),
      requiredCapabilities: ['foundry.asset.generate', ...(spec.providerId ? [`foundry.provider.${spec.providerId}`] : [])],
      inputArtifacts: [
        ...(spec.parentAsset ? [{ kind: 'foundry-asset' as const, uri: `/api/foundry/assets/${encodeURIComponent(spec.parentAsset)}`, label: spec.parentAsset, assetId: spec.parentAsset }] : []),
        ...(spec.referenceAssets ?? []).map(assetId => ({ kind: 'foundry-asset', uri: `/api/foundry/assets/${encodeURIComponent(assetId)}`, label: assetId, assetId })),
      ],
      outputArtifacts: [{ kind: 'foundry-asset', uri: '', label: spec.assetId, assetId: spec.assetId, producedBy: 'foundry' }],
      taskSpec: spec,
      disclosure,
    });
  }

  let blenderSpec: NssStudioBlenderTaskSpec | undefined;
  if (domains.has('blender')) {
    if (request.blenderTaskSpec !== undefined) {
      const validated = validateBlenderTaskSpec({
        ...(asRecord(request.blenderTaskSpec) ?? {}),
        workingDirectory: `${request.project.path}\\.matterhorn\\planner-validation`,
      });
      blenderSpec = {
        protocol: 'nss.studio-task-spec.v1',
        specialist: 'blender-engine',
        action: 'execute_spec',
        prompt: goal,
        ...(assetSpecs.length ? { sourceAssetIds: assetSpecs.map(spec => spec.assetId) } : {}),
        specification: { ...validated, workingDirectory: '.' },
      };
    } else {
      blenderSpec = {
        protocol: 'nss.studio-task-spec.v1',
        specialist: 'blender-engine',
        action: 'execute_spec',
        prompt: goal,
        ...(assetSpecs.length ? { sourceAssetIds: assetSpecs.map(spec => spec.assetId) } : {}),
      };
    }
    const dependencies = tasks.map(task => task.id);
    const outputs = blenderSpec?.specification?.expectedArtifacts
      .filter(artifact => artifact.required)
      .map(artifact => ({
        kind: artifact.kind === 'png' ? 'preview' : artifact.kind === 'json' ? 'report' : artifact.kind,
        uri: '',
        label: artifact.name,
        producedBy: 'blender-engine' as const,
      }));
    tasks.push({
      id: 'blender-work',
      title: 'Create and validate the 3D asset in Blender',
      goal,
      domain: 'blender',
      specialistId: 'blender-engine',
      dependsOn: dependencies,
      acceptanceCriteria: blenderSpec?.specification?.acceptanceCriteria ?? request.criteria,
      requiredCapabilities: ['blender.create', 'blender.qa'],
      ...(assetSpecs.length ? { inputArtifacts: [] } : {}),
      ...(outputs?.length ? { outputArtifacts: outputs } : {}),
      ...(blenderSpec ? { taskSpec: blenderSpec } : {}),
    });
  }

  const needsGodot = domains.has('godot');
  if (needsGodot) {
    const dependencies = tasks.map(task => task.id);
    tasks.push({
      id: 'flyrail-game-work',
      title: 'Implement and validate the Godot work in Flyrail',
      goal,
      domain: 'godot',
      specialistId: 'flyrail',
      dependsOn: dependencies,
      acceptanceCriteria: [...request.criteria],
      requiredCapabilities: ['godot.project.inspect', 'godot.project.run', 'godot.validation.run'],
      inputArtifacts: [{ kind: 'godot-project', uri: request.project.path, label: request.project.name }],
    });
  }

  const upstreamIds = tasks.map(task => task.id);
  if (upstreamIds.length === 0) throw new Error('The planner could not resolve this request to an executable specialist domain. Add a structured asset, Blender, or Godot task.');
  tasks.push({
    id: 'matterhorn-qa',
    title: 'Aggregate specialist evidence and verify acceptance',
    goal: `Verify the requested acceptance criteria using only evidence returned by: ${upstreamIds.join(', ')}. Do not infer missing results.`,
    domain: 'qa',
    specialistId: 'matterhorn',
    dependsOn: upstreamIds,
    acceptanceCriteria: [...request.criteria],
    requiredCapabilities: ['studio.qa', 'studio.evidence.aggregate'],
    taskSpec: {
      protocol: 'nss.studio-task-spec.v1',
      specialist: 'matterhorn',
      action: 'aggregate_evidence',
      dependencyTaskIds: upstreamIds,
      criteria: [...request.criteria],
    },
  });

  return createStudioPlan({ id, goal, tasks, finalAcceptanceCriteria: [...request.criteria] });
}

export function inferDomains(goal: string): readonly StudioPlanningDomain[] {
  const value = goal.toLowerCase();
  const is2dAssetRequest = /\b(create|make|generate|draw|paint|design|edit)\b/.test(value) &&
    /\b(pixel[ -]art|sprite|spritesheet|sprite sheet|tile|tileset|ui icon|background|texture)\b/.test(value);
  const explicitReference = /\b(reference|concept art|concept image|design sheet|mood ?board)\b/.test(value);
  const assetKinds = is2dAssetRequest || explicitReference;
  const blender = /\b(3d|three[- ]d|mesh|model|rig|blender)\b/.test(value);
  const godot = /\b(godot|game|gameplay|scene|import|attack behavior|attack behaviour|playtest|test it|test the)\b/.test(value);
  const domains: StudioPlanningDomain[] = [];
  if (assetKinds) domains.push('assets');
  if (blender) domains.push('blender');
  if (godot) domains.push('godot');
  if (domains.length === 0) domains.push('godot');
  return domains;
}

function inferAssetRequests(goal: string): StudioAssetRequestInput[] {
  const value = goal.toLowerCase();
  if (/\b(reference|concept art|concept image|design sheet|mood ?board)\b/.test(value)) {
    return [{ kind: 'concept_art', operation: 'generate', prompt: goal }];
  }
  if (/\b(sprite sheet|spritesheet|animated character|animated characters)\b/.test(value)) {
    return [{ kind: 'sprite_sheet', operation: 'generate', prompt: goal }];
  }
  if (/\b(background|farming scene|game scene)\b/.test(value)) {
    return [{ kind: 'background', operation: 'generate', prompt: goal }];
  }
  if (/\b(tile|tileset)\b/.test(value)) return [{ kind: 'tileset', operation: 'generate', prompt: goal }];
  if (/\b(icon)\b/.test(value)) return [{ kind: 'ui_icon', operation: 'generate', prompt: goal }];
  if (/\b(texture)\b/.test(value)) return [{ kind: 'texture', operation: 'generate', prompt: goal }];
  return [{ kind: 'pixel_sprite', operation: 'generate', prompt: goal }];
}

function makeFoundrySpec(
  input: StudioAssetRequestInput,
  index: number,
  planId: string,
  goal: string,
  projectId: string,
  preferences: StudioRoutingPreferences,
): NssStudioFoundryTaskSpec {
  const kind = input.kind ?? 'concept_art';
  const operation = input.operation ?? 'generate';
  if (typeof kind !== 'string' || !ASSET_KINDS.has(kind as FoundryAssetKind)) throw new Error(`Unsupported Foundry asset kind: ${String(kind)}.`);
  if (typeof operation !== 'string' || !ASSET_OPERATIONS.has(operation as FoundryAssetOperation)) throw new Error(`Unsupported Foundry asset operation: ${String(operation)}.`);
  const idSuffix = createHash('sha256').update(`${planId}:${index}`).digest('hex').slice(0, 8);
  const assetId = optionalString(input.assetId, 'assetId', 120) ?? `studio-${idSuffix}-asset-${index + 1}`;
  const prompt = optionalString(input.prompt, 'prompt', 8_000) ?? goal;
  const parentAsset = optionalString(input.parentAsset, 'parentAsset', 120);
  const referenceAssets = optionalStringArray(input.referenceAssets, 'referenceAssets', 16);
  const width = optionalInteger(input.width, 'width', 1, 4096);
  const height = optionalInteger(input.height, 'height', 1, 4096);
  if ((width === undefined) !== (height === undefined)) throw new Error('Foundry asset width and height must be supplied together.');
  const explicitProvider = optionalString(input.providerId, 'providerId', 120);
  const providerId = explicitProvider ?? (preferences.assets === 'auto' ? undefined : preferences.assets);
  const maxCost = parseCost(input.maxCost);
  const allowNetwork = input.allowNetwork === true;
  const approveExternalCost = input.approveExternalCost === true;
  if (input.allowNetwork !== undefined && typeof input.allowNetwork !== 'boolean') throw new Error('allowNetwork must be true or false.');
  if (input.approveExternalCost !== undefined && typeof input.approveExternalCost !== 'boolean') throw new Error('approveExternalCost must be true or false.');
  if (input.requireCommercialUse !== undefined && typeof input.requireCommercialUse !== 'boolean') throw new Error('requireCommercialUse must be true or false.');
  return {
    protocol: 'nss.studio-task-spec.v1',
    specialist: 'foundry',
    action: 'generate_asset',
    projectId,
    assetId,
    kind: kind as FoundryAssetKind,
    operation: operation as FoundryAssetOperation,
    prompt,
    ...(parentAsset ? { parentAsset } : {}),
    ...(referenceAssets.length ? { referenceAssets } : {}),
    ...(width !== undefined ? { width, height: height! } : {}),
    ...(providerId ? { providerId } : {}),
    allowNetwork,
    approveExternalCost,
    ...(maxCost ? { maxCost } : {}),
    // A user task cannot reduce the server's persisted commercial-use rule.
    requireCommercialUse: preferences.requireCommercialUse || input.requireCommercialUse === true,
  };
}

function discloseProvider(
  spec: NssStudioFoundryTaskSpec,
  providers: readonly FoundryProviderStatus[],
  preferences: StudioRoutingPreferences,
): NssStudioTaskDisclosure {
  const selected = spec.providerId ? providers.filter(provider => provider.id === spec.providerId) : providers;
  const known = selected.filter(provider => provider.operations.includes(spec.operation) && provider.kinds.includes(spec.kind));
  const networkMayBeRequired = known.some(provider => provider.requiresNetwork);
  const externalCostMayBeIncurred = known.some(provider => provider.externalCost);
  const explicitApprovalRequired = (networkMayBeRequired && !spec.allowNetwork) ||
    (externalCostMayBeIncurred && (!spec.approveExternalCost || !spec.maxCost));
  const paidEstimate = known.find(provider => provider.externalCost)?.estimatedCost;
  return {
    networkMayBeRequired,
    externalCostMayBeIncurred,
    explicitApprovalRequired,
    ...(spec.providerId ? { providerId: spec.providerId } : preferences.assets !== 'auto' ? { providerId: preferences.assets } : {}),
    ...(spec.maxCost ?? paidEstimate ? { estimatedCost: spec.maxCost ?? paidEstimate as FoundryAssetCost } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${field} must contain 1-${max} characters.`);
  return value.trim();
}

function optionalStringArray(value: unknown, field: string, maxItems: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} must be an array with at most ${maxItems} entries.`);
  return value.map((item, index) => optionalString(item, `${field}[${index}]`, 120)!);
}

function optionalInteger(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}.`);
  return value;
}

function parseCost(value: unknown): FoundryAssetCost | undefined {
  if (value === undefined) return undefined;
  const cost = asRecord(value);
  if (!cost || typeof cost.currency !== 'string' || !cost.currency.trim() || typeof cost.amount !== 'number' || !Number.isFinite(cost.amount) || cost.amount <= 0) {
    throw new Error('maxCost must contain a currency and positive amount.');
  }
  return { currency: cost.currency.trim(), amount: cost.amount };
}
