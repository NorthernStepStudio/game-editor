import type { FoundryAssetView } from './foundryAssetService.js';
import type { FoundryJobView } from './foundryGenerationService.js';

/**
 * The Matterhorn chat answers from the app's real data. Questions about assets are
 * answered by searching the library directly (instant, never invented); everything
 * else goes to the chat model together with a summary of what Matterhorn holds.
 */

export interface AssistantAssetHit {
  readonly assetId: string;
  readonly name: string;
  readonly type: string;
  readonly source?: string;
  readonly previewUrl?: string;
}

export interface AssistantReply {
  readonly reply: string;
  readonly assets?: { readonly total: number; readonly shown: readonly AssistantAssetHit[]; readonly openHash: string };
  readonly answeredBy: 'library' | 'model';
}

const ASSET_WORDS = /\b(assets?|models?|meshes|sounds?|music|songs?|audio|sfx|images?|pictures?|sprites?|icons?|logos?|textures?|characters?|props?|files?|library|3d)\b/i;
const SHOW_WORDS = /\b(show|list|find|see|display|search|look|give|what|which|where|have|got|any|all|every(thing)?|how many)\b/i;

const KIND_FILTERS: { pattern: RegExp; label: string; filter: string; test: (type: string) => boolean }[] = [
  { pattern: /\b(3d|models?|meshes|props?|characters?)\b/i, label: '3D models', filter: '3d', test: (t) => t === 'mesh_3d' || t === 'rig' },
  { pattern: /\b(sounds?|music|songs?|audio|sfx)\b/i, label: 'sounds', filter: 'audio', test: (t) => t.startsWith('audio_') },
  { pattern: /\b(images?|pictures?|sprites?|icons?|logos?|textures?|backgrounds?)\b/i, label: 'images', filter: '2d', test: (t) => !t.startsWith('audio_') && t !== 'mesh_3d' && t !== 'rig' },
];

const STOP = new Set(('show list find see display search look give me us the a an of in on at for to from with and or that this these those we our my i you your can could would will please ' +
  'what which where have has got any all every everything how many do does is are there still still some just only assets asset models model meshes sounds sound music songs song audio sfx images image ' +
  'pictures picture sprites sprite icons icon logos logo textures texture characters character props prop files file library 3d inside called named version versions').split(/\s+/));

export function isAssetQuestion(message: string): boolean {
  return ASSET_WORDS.test(message) && (SHOW_WORDS.test(message) || /^\s*(assets?|models?|sounds?|images?)\b/i.test(message));
}

/** Searches the library for an asset question. No search words = everything (optionally by kind). */
export function searchAssets(message: string, assets: readonly FoundryAssetView[], gameNames: readonly string[]): AssistantReply {
  const visible = assets.filter((a) => !a.hidden);
  const kinds = KIND_FILTERS.filter((k) => k.pattern.test(message));
  const lower = message.toLowerCase();
  const game = gameNames.find((name) => lower.includes(name.toLowerCase()));
  const terms = (lower.match(/[a-z0-9_.-]+/g) ?? [])
    .map((t) => t.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((t) => t.length > 0 && !STOP.has(t) && t !== game?.toLowerCase());

  const haystack = (a: FoundryAssetView) => `${a.displayName ?? ''} ${a.assetId} ${a.source ?? ''} ${a.prompt ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ');
  const matches = visible.filter((a) => {
    if (kinds.length && !kinds.some((k) => k.test(a.type))) return false;
    if (game && !(a.source ?? '').toLowerCase().startsWith(`${game.toLowerCase()} game`)) return false;
    const text = haystack(a);
    return terms.every((term) => text.includes(term.replace(/[_-]+/g, ' ')));
  });

  const what = [kinds.map((k) => k.label).join(' and ') || 'assets', game ? `in ${game}` : null, terms.length ? `matching “${terms.join(' ')}”` : null]
    .filter(Boolean).join(' ');
  const openQuery = [...terms, ...(game ? [game] : [])].join(' ');
  const filter = kinds.length === 1 ? kinds[0].filter : 'all';
  const openHash = openQuery || filter !== 'all' ? `#assets/search/${encodeURIComponent(openQuery)}/${filter}` : '#assets';
  const shown = matches.slice(0, 24).map((a) => ({
    assetId: a.assetId,
    name: a.displayName ?? a.assetId,
    type: a.type,
    ...(a.source ? { source: a.source } : {}),
    ...(a.previewUrl ? { previewUrl: a.previewUrl } : {}),
  }));

  let reply: string;
  if (!matches.length) {
    reply = terms.length
      ? `I found no ${what.replace(/ matching.*/, '')} matching “${terms.join(' ')}” in your library of ${visible.length}. Try fewer or different words, or open Assets to browse everything.`
      : `Your library has no ${what} yet.`;
  } else if (matches.length === visible.length && !terms.length && !kinds.length && !game) {
    reply = `Here is everything in your library: ${visible.length} assets.${matches.length > shown.length ? ` Showing the first ${shown.length} — open Assets to see them all.` : ''}`;
  } else {
    reply = `I found ${matches.length} ${what}.${matches.length > shown.length ? ` Showing the first ${shown.length}.` : ''}`;
  }
  return { reply, assets: { total: matches.length, shown, openHash }, answeredBy: 'library' };
}

/** A compact, factual summary of the app for the chat model. */
export function appSummary(input: {
  page: string;
  games: readonly string[];
  assets: readonly FoundryAssetView[];
  jobs: readonly FoundryJobView[];
  runs: readonly { status: string; plan: { goal: string } }[];
}): string {
  const visible = input.assets.filter((a) => !a.hidden);
  const count = (test: (t: string) => boolean) => visible.filter((a) => test(a.type)).length;
  const running = input.jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  const failed = input.jobs.filter((j) => j.status === 'failed').slice(0, 3);
  const activeRuns = input.runs.filter((r) => !['completed', 'failed', 'blocked', 'cancelled'].includes(r.status));
  return [
    'You are Matterhorn, the assistant inside the Matterhorn studio app. Answer briefly and concretely using these facts; never invent assets, files or results. Point the user to the right place in the app (Studio, My Game, Assets, Settings) when useful.',
    `The user is looking at: ${input.page}.`,
    `Games: ${input.games.length ? input.games.join(', ') : 'none added yet'}.`,
    `Asset library: ${visible.length} assets — ${count((t) => t === 'mesh_3d')} 3D models, ${count((t) => t.startsWith('audio_'))} sounds, ${count((t) => !t.startsWith('audio_') && t !== 'mesh_3d')} images and sprites.`,
    running.length ? `Building now: ${running.map((j) => j.displayName ?? j.assetId).join(', ')}.` : 'No asset builds are running.',
    failed.length ? `Recent failed builds: ${failed.map((j) => `${j.displayName ?? j.assetId} (${(j.error ?? '').split('. ')[0].slice(0, 80)})`).join('; ')}.` : '',
    activeRuns.length ? `Game changes in progress: ${activeRuns.map((r) => r.plan.goal).join('; ')}.` : 'No game changes are running.',
  ].filter(Boolean).join('\n');
}
