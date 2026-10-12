import {
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  closeSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import {
  FoundryAssetCatalog,
  type FoundryAssetExecution,
  type FoundryAssetManifest,
} from '../../../core/out/index.js';

const STORE_VERSION = 1;
const MAX_ASSETS = 10_000;
const MAX_STORE_BYTES = 20_000_000;

interface FoundryAssetStoreFile {
  readonly version: number;
  readonly assets: readonly FoundryAssetManifest[];
}

function atomicWrite(path: string, text: string): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink()) {
    throw new Error('Foundry asset storage cannot be a symbolic link.');
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

function parseStore(raw: unknown): readonly FoundryAssetManifest[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Foundry asset store must contain an object.');
  }
  const file = raw as Record<string, unknown>;
  if (file.version !== STORE_VERSION || !Array.isArray(file.assets)) {
    throw new Error('Foundry asset store has an unsupported format.');
  }
  if (file.assets.length > MAX_ASSETS) {
    throw new Error('Foundry asset store exceeds the asset retention limit.');
  }

  // FoundryAssetCatalog performs the canonical per-manifest validation and
  // duplicate detection. structuredClone prevents callers from retaining
  // references into persisted state.
  return structuredClone(file.assets as FoundryAssetManifest[]);
}

export class FoundryAssetStore {
  private readonly path: string;
  private catalog = new FoundryAssetCatalog();

  constructor(dataDirectory: string) {
    this.path = resolve(dataDirectory, 'foundry-assets', 'assets.json');
    this.load();
  }

  list(): readonly FoundryAssetManifest[] {
    return structuredClone(this.catalog.list());
  }

  get(assetId: string): FoundryAssetManifest | undefined {
    const manifest = this.catalog.get(assetId);
    return manifest ? structuredClone(manifest) : undefined;
  }

  require(assetId: string): FoundryAssetManifest {
    return structuredClone(this.catalog.require(assetId));
  }

  lineage(assetId: string): readonly FoundryAssetManifest[] {
    return structuredClone(this.catalog.lineage(assetId));
  }

  register(manifest: FoundryAssetManifest): void {
    this.registerMany([manifest]);
  }

  registerMany(manifests: readonly FoundryAssetManifest[]): void {
    const existing = this.catalog.list();
    if (existing.length + manifests.length > MAX_ASSETS) {
      throw new Error('Foundry asset store retention limit reached.');
    }

    const candidate = new FoundryAssetCatalog();
    candidate.registerMany([
      ...existing,
      ...structuredClone(manifests),
    ]);
    this.persist(candidate.list());
    this.catalog = candidate;
  }

  /** Takes assets out of the catalog (their files are handled by the caller). */
  removeMany(assetIds: readonly string[]): void {
    const gone = new Set(assetIds);
    const candidate = new FoundryAssetCatalog();
    candidate.registerMany(this.catalog.list().filter((manifest) => !gone.has(manifest.assetId)));
    this.persist(candidate.list());
    this.catalog = candidate;
  }

  registerExecution(execution: FoundryAssetExecution): void {
    this.registerMany(execution.manifests);
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    const info = lstatSync(this.path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_STORE_BYTES) {
      throw new Error('Foundry asset store file is invalid.');
    }

    const manifests = parseStore(JSON.parse(readFileSync(this.path, 'utf8')));
    this.catalog.registerMany(manifests);
  }

  private persist(assets: readonly FoundryAssetManifest[]): void {
    const payload: FoundryAssetStoreFile = {
      version: STORE_VERSION,
      assets,
    };
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STORE_BYTES) {
      throw new Error('Foundry asset store exceeds the persistence size limit.');
    }
    atomicWrite(this.path, serialized);
  }
}
