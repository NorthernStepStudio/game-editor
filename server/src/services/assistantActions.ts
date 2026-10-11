import type { StudioService } from './studioService.js';

/**
 * Lets the Matterhorn chat do the work it is asked for, through the same paths as the
 * buttons: build an asset, make a new version of the asset you are looking at (also for
 * imported models), retry a failed build, or plan a game change for approval.
 * Nothing destructive happens: new versions never overwrite, game changes need approval.
 */

export interface ChatRef {
  readonly kind?: 'asset' | 'build' | 'game';
  readonly id?: string;
}

export type ChatAction =
  | { action: 'make_asset'; description: string; name?: string; kind: AssetKind; builder: Builder }
  | { action: 'change_asset'; assetId: string; change: string; builder: Builder }
  | { action: 'retry_build'; jobId?: string; builder: Builder }
  | { action: 'plan_game_change'; goal: string }
  | { action: 'answer' };

type AssetKind = 'mesh_3d' | 'sprite_sheet' | 'pixel_sprite';
type Builder = 'claude' | 'local' | 'default';

export interface ActionReply {
  readonly reply: string;
  readonly answeredBy: 'action';
  readonly job?: { readonly jobId: string; readonly assetId: string; readonly displayName?: string; readonly builder: string };
  readonly plan?: { readonly goal: string; readonly game: string; readonly tasks: readonly string[]; readonly payload: Record<string, unknown> };
  readonly needsDirtyConfirm?: { readonly goal: string; readonly projectId: string };
}

const CHANGE_WORDS = /\b(make it|change|add|remove|delete the|put|give it|paint|color|colour|recolor|bigger|smaller|taller|shorter|wider|thinner|longer|rotate|move|replace|fix|improve|continue|keep working|finish|refine|more detail|less|rust|wood|metal|texture|lighter|darker|another version|new version|version|tweak)\b/i;
const MAKE_WORDS = /\b(make|create|build|generate|model|design)\b.*\b(a|an|new|some|the)\b/i;
const RETRY_WORDS = /\b(retry|try again|again with|rebuild|redo)\b/i;
const GAME_WORDS = /\b(game|level|player|enemy|enemies|score|timer|match|round|menu|hud|gameplay|difficulty|spawn|controls?|multiplayer)\b/i;

function builderFrom(message: string): Builder {
  if (/\bclaude\b/i.test(message)) return 'claude';
  if (/\b(local|free|offline|ollama|qwen|gemma)\b/i.test(message)) return 'local';
  return 'default';
}

function kindFrom(text: string): AssetKind {
  if (/sprite sheet|8.direction|directions/i.test(text)) return 'sprite_sheet';
  if (/pixel/i.test(text)) return 'pixel_sprite';
  return 'mesh_3d';
}

const ROUTER_SYSTEM = `You route a chat message inside the Matterhorn game studio app to one action.
Reply with JSON only, shaped like {"action": "...", "description": "...", "change": "...", "name": "...", "goal": "..."}.
Actions:
- "change_asset": the user wants to modify the asset they are looking at ("make it taller", "add rust", "continue working on it"). Put the requested change in "change".
- "make_asset": the user wants a NEW asset built (a prop, model, character, sprite). Put what to build in "description" and a 1-4 word "name".
- "retry_build": the user wants a failed build tried again.
- "plan_game_change": the user wants the GAME itself changed (gameplay, levels, menus, UI, bugs). Put the change in "goal".
- "answer": a question or anything else.`;

/** Decides what the user wants. Clear cases are matched directly; the rest go to the chat model. */
export async function decideAction(message: string, ref: ChatRef, service: StudioService): Promise<ChatAction> {
  const builder = builderFrom(message);
  const onAsset = ref.kind === 'asset' && ref.id ? service.foundryAssets.get(ref.id) : undefined;
  const isQuestion = /\?\s*$/.test(message) && !/^(can|could|would|will) you\b/i.test(message.trim());

  if (RETRY_WORDS.test(message) && !onAsset) return { action: 'retry_build', ...(ref.kind === 'build' && ref.id ? { jobId: ref.id } : {}), builder };
  if (onAsset && !isQuestion && CHANGE_WORDS.test(message) && !/\b(new|another) (asset|model|prop)\b/i.test(message)) {
    return { action: 'change_asset', assetId: onAsset.assetId, change: message, builder };
  }

  const context = [
    `The user is on: ${ref.kind === 'asset' && onAsset ? `the page of asset "${onAsset.displayName ?? onAsset.assetId}" (${onAsset.type})` : ref.kind ?? 'a page'}.`,
    `Message: ${message}`,
  ].join('\n');
  const routed = await service.ai.json(ROUTER_SYSTEM, context);
  const action = typeof routed?.action === 'string' ? routed.action : undefined;
  const text = (key: string) => (typeof routed?.[key] === 'string' ? (routed[key] as string).trim() : '');

  if (action === 'change_asset' && onAsset) return { action: 'change_asset', assetId: onAsset.assetId, change: text('change') || message, builder };
  if (action === 'make_asset' || (!action && MAKE_WORDS.test(message) && !GAME_WORDS.test(message))) {
    const description = text('description') || message;
    return { action: 'make_asset', description, name: text('name') || undefined, kind: kindFrom(description + message), builder };
  }
  if (action === 'retry_build') return { action: 'retry_build', builder };
  if (action === 'plan_game_change') return { action: 'plan_game_change', goal: text('goal') || message };
  return { action: 'answer' };
}

/** Picks the provider for a builder choice, allowing online AI when the user asked for Claude by name. */
function provider(service: StudioService, builder: Builder): { id: string; label: string; enabledOnline?: boolean } {
  const available = service.foundryGeneration.providers().filter((p) => p.id.startsWith('blender-agent') && p.available);
  const routing = service.routingPreferences.get();
  const want = builder === 'claude' ? 'blender-agent-claude'
    : builder === 'local' ? 'blender-agent-local'
      : routing.assets !== 'auto' ? routing.assets : 'blender-agent-local';
  const chosen = available.find((p) => p.id === want) ?? available.find((p) => p.id === 'blender-agent-local') ?? available[0];
  if (!chosen) throw new Error('No asset builder is available — Blender must be installed (Settings › Connections).');
  let enabledOnline = false;
  if (chosen.requiresNetwork && !routing.allowNetworkProviders) {
    if (builder !== 'claude') throw new Error('Assets are set to be built with Claude, but online AI is switched off in Settings › Advanced.');
    service.routingPreferences.update({ allowNetworkProviders: true });
    enabledOnline = true;
  }
  return { id: chosen.id, label: chosen.id === 'blender-agent-claude' ? 'Claude' : 'the local model', enabledOnline };
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'asset';
}

export async function runAction(action: Exclude<ChatAction, { action: 'answer' }>, service: StudioService): Promise<ActionReply> {
  if (action.action === 'make_asset') {
    const builder = provider(service, action.builder);
    const name = action.name ?? (action.description.charAt(0).toUpperCase() + action.description.slice(1, 40));
    const job = service.foundryGeneration.submitJob({
      projectId: 'library', assetId: `${slug(name)}_${Date.now().toString(36).slice(-4)}`, kind: action.kind, operation: 'generate',
      prompt: action.description, displayName: name, providerId: builder.id, allowNetwork: builder.id === 'blender-agent-claude',
    });
    return {
      answeredBy: 'action',
      reply: `On it — ${builder.label} is building “${name}”.${builder.enabledOnline ? ' (I switched on online AI so Claude can work.)' : ''} I'll show it here when it's ready.`,
      job: { jobId: job.jobId, assetId: job.assetId, displayName: name, builder: builder.label },
    };
  }

  if (action.action === 'change_asset') {
    const asset = service.foundryAssets.get(action.assetId);
    if (!asset) throw new Error('That asset is no longer in the library.');
    if (asset.type !== 'mesh_3d') {
      return { answeredBy: 'action', reply: `I can change 3D models from the chat. “${asset.displayName ?? asset.assetId}” is ${asset.type.replace('_', ' ')}, which I can't edit yet.` };
    }
    const builder = provider(service, action.builder);
    const name = (asset.displayName ?? asset.assetId).replace(/ \(v\d+\)$/, '');
    const base = asset.assetId.replace(/_v\d+$/, '');
    const existing = new Set(service.foundryAssets.list().map((a) => a.assetId));
    let version = Number(/_v(\d+)$/.exec(asset.assetId)?.[1] ?? 1) + 1;
    while (existing.has(`${base}_v${version}`)) version += 1;
    const job = service.foundryGeneration.submitJob({
      projectId: 'library', assetId: `${base}_v${version}`, kind: 'mesh_3d', operation: 'edit', parentAsset: asset.assetId,
      prompt: action.change, displayName: `${name} (v${version})`, providerId: builder.id, allowNetwork: builder.id === 'blender-agent-claude',
    });
    return {
      answeredBy: 'action',
      reply: `Working on it — ${builder.label} is making version ${version} of “${name}”: ${action.change}. The current version stays as it is.${builder.enabledOnline ? ' (I switched on online AI so Claude can work.)' : ''}`,
      job: { jobId: job.jobId, assetId: job.assetId, displayName: `${name} (v${version})`, builder: builder.label },
    };
  }

  if (action.action === 'retry_build') {
    const jobs = service.foundryGeneration.listJobs();
    const retried = new Set(jobs.map((j) => j.retryOf).filter(Boolean));
    const target = action.jobId ? jobs.find((j) => j.jobId === action.jobId) : jobs.find((j) => (j.status === 'failed' || j.status === 'cancelled') && !retried.has(j.jobId));
    if (!target) return { answeredBy: 'action', reply: 'There is no failed build to try again.' };
    const builder = provider(service, action.builder);
    const job = service.foundryGeneration.retryJob(target.jobId, { providerId: builder.id });
    return {
      answeredBy: 'action',
      reply: `Trying “${target.displayName ?? target.assetId}” again with ${builder.label}.${builder.enabledOnline ? ' (I switched on online AI so Claude can work.)' : ''}`,
      job: { jobId: job.jobId, assetId: job.assetId, displayName: target.displayName, builder: builder.label },
    };
  }

  const game = service.projects[0];
  if (!game) return { answeredBy: 'action', reply: 'Add your game first (My Game › + Add a game), then I can plan changes to it.' };
  const payload = { projectId: game.id, goal: action.goal, criteria: [] as string[] };
  try {
    const plan = await service.plan(payload);
    return {
      answeredBy: 'action',
      reply: `Here's the plan for ${game.name}. Nothing changes until you approve it.`,
      plan: { goal: plan.goal, game: game.name, tasks: plan.tasks.map((t) => t.title), payload },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/uncommitted|dirty/i.test(message)) {
      return { answeredBy: 'action', reply: `${game.name} has unsaved changes in its folder, so I stopped before planning.`, needsDirtyConfirm: { goal: action.goal, projectId: game.id } };
    }
    return { answeredBy: 'action', reply: `I couldn't plan that: ${message}` };
  }
}
