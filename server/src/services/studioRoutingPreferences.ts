import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';

export type StudioGameRoute = 'auto' | 'flyrail';
export type StudioThreeDRoute = 'auto' | 'blender-engine';
export type StudioAssetRoute = 'auto' | 'sprite-fusion' | 'comfyui-local';

export interface StudioRoutingPreferences {
  readonly version: 1;
  readonly game: StudioGameRoute;
  readonly threeD: StudioThreeDRoute;
  readonly assets: StudioAssetRoute;
  readonly localFirst: boolean;
  readonly requireCommercialUse: boolean;
  readonly allowNetworkProviders: boolean;
  readonly allowExternalCostProviders: boolean;
  readonly updatedAt: string;
}

export interface StudioRoutingPreferencesInput {
  readonly game?: unknown;
  readonly threeD?: unknown;
  readonly assets?: unknown;
  readonly localFirst?: unknown;
  readonly requireCommercialUse?: unknown;
  readonly allowNetworkProviders?: unknown;
  readonly allowExternalCostProviders?: unknown;
}

const DEFAULTS: Omit<StudioRoutingPreferences, 'updatedAt'> = {
  version: 1,
  game: 'auto',
  threeD: 'auto',
  assets: 'auto',
  localFirst: true,
  requireCommercialUse: true,
  allowNetworkProviders: false,
  allowExternalCostProviders: false,
};

const GAME_ROUTES = new Set<StudioGameRoute>(['auto', 'flyrail']);
const THREE_D_ROUTES = new Set<StudioThreeDRoute>(['auto', 'blender-engine']);
const ASSET_ROUTES = new Set<StudioAssetRoute>([
  'auto',
  'sprite-fusion',
  'comfyui-local',
]);

function atomicWrite(path: string, text: string): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink()) {
    throw new Error('Studio routing settings directory cannot be a symbolic link.');
  }

  const temp = `${path}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temp, 'wx', 0o600);
    writeFileSync(fd, text, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temp);
    } catch {
      // Rename consumed the temporary file.
    }
  }
}

function booleanValue(
  value: unknown,
  fallback: boolean,
  field: string,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be true or false.`);
  }
  return value;
}

function routeValue<T extends string>(
  value: unknown,
  fallback: T,
  allowed: ReadonlySet<T>,
  field: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`${field} contains an unsupported route.`);
  }
  return value as T;
}

export function validateStudioRoutingPreferences(
  input: StudioRoutingPreferencesInput,
  previous?: StudioRoutingPreferences,
): StudioRoutingPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Studio routing settings must be an object.');
  }

  const base = previous ?? {
    ...DEFAULTS,
    updatedAt: new Date(0).toISOString(),
  };

  return {
    version: 1,
    game: routeValue(input.game, base.game, GAME_ROUTES, 'game'),
    threeD: routeValue(input.threeD, base.threeD, THREE_D_ROUTES, 'threeD'),
    assets: routeValue(input.assets, base.assets, ASSET_ROUTES, 'assets'),
    localFirst: booleanValue(input.localFirst, base.localFirst, 'localFirst'),
    requireCommercialUse: booleanValue(
      input.requireCommercialUse,
      base.requireCommercialUse,
      'requireCommercialUse',
    ),
    allowNetworkProviders: booleanValue(
      input.allowNetworkProviders,
      base.allowNetworkProviders,
      'allowNetworkProviders',
    ),
    allowExternalCostProviders: booleanValue(
      input.allowExternalCostProviders,
      base.allowExternalCostProviders,
      'allowExternalCostProviders',
    ),
    updatedAt: new Date().toISOString(),
  };
}

export class StudioRoutingPreferencesStore {
  private readonly path: string;
  private current: StudioRoutingPreferences;

  constructor(dataDirectory: string) {
    this.path = resolve(dataDirectory, 'studio-settings', 'routing.json');
    this.current = this.load();
  }

  get(): StudioRoutingPreferences {
    return structuredClone(this.current);
  }

  update(input: StudioRoutingPreferencesInput): StudioRoutingPreferences {
    const next = validateStudioRoutingPreferences(input, this.current);
    atomicWrite(this.path, JSON.stringify(next));
    this.current = next;
    return this.get();
  }

  private load(): StudioRoutingPreferences {
    if (!existsSync(this.path)) {
      return {
        ...DEFAULTS,
        updatedAt: new Date(0).toISOString(),
      };
    }

    const info = lstatSync(this.path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64_000) {
      throw new Error('Studio routing settings file is invalid.');
    }

    const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Studio routing settings file is invalid.');
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) {
      throw new Error('Studio routing settings version is unsupported.');
    }

    const validated = validateStudioRoutingPreferences(record);
    return {
      ...validated,
      updatedAt:
        typeof record.updatedAt === 'string' && record.updatedAt
          ? record.updatedAt
          : validated.updatedAt,
    };
  }
}
