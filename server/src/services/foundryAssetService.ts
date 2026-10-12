import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
  sep,
} from 'node:path';
import type {
  FoundryAssetExecution,
  FoundryAssetManifest,
} from '../../../core/out/index.js';
import type { StudioProject } from './studioService.js';
import { FoundryAssetStore } from './foundryAssetStore.js';

const PREVIEW_MIME: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

const FILE_MIME: Readonly<Record<string, string>> = {
  ...PREVIEW_MIME,
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.blend': 'application/octet-stream',
  '.py': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

export interface FoundryAssetFileView {
  readonly name: string;
  readonly role: 'main' | 'preview' | 'source' | 'script' | 'render' | 'frame' | 'spin' | 'build' | 'anim' | 'report' | 'other';
  readonly url: string;
}

export interface FoundryAssetView {
  readonly assetId: string;
  readonly type: string;
  readonly operation?: string;
  readonly generationProvider?: string;
  readonly model?: string;
  readonly outputIndex?: number;
  readonly parentAsset?: string;
  readonly referenceAssets?: readonly string[];
  readonly width?: number;
  readonly height?: number;
  readonly palette?: readonly string[];
  readonly cost?: {
    readonly currency: string;
    readonly amount: number;
  };
  readonly createdAt: string;
  readonly contentHash?: string;
  readonly sourceLicenseIds?: readonly string[];
  readonly previewUrl?: string;
  readonly files?: readonly FoundryAssetFileView[];
  /** Friendly name, original description, draft grouping and visibility (user-facing metadata). */
  readonly displayName?: string;
  readonly prompt?: string;
  readonly draftGroup?: string;
  readonly styleId?: string;
  readonly hidden?: boolean;
  /** Where an imported asset came from, e.g. "Yun game · characters". */
  readonly source?: string;
  /** What it is (characters, props, buildings…), set automatically unless the owner chose one. */
  readonly category: string;
  readonly categorySetByOwner?: boolean;
}

/** What an asset is, for finding it fast. Set automatically; the owner can move anything. */
export const ASSET_CATEGORIES = ['characters', 'animals', 'props', 'buildings', 'vehicles', 'nature', 'images', 'sounds'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

const CATEGORY_WORDS: readonly [AssetCategory, RegExp][] = [
  ['characters', /\b(characters?|player|mini_characters|npc|person|people|adventurer|avatar|hero|attacker|defender|rigged|mascot|figure|chibi)\b/],
  ['animals', /\b(dogs?|puppy|cats?|kitten|birds?|chickens?|roosters?|hens?|goats?|pigs?|cows?|horses?|donkeys?|animals?|shepherd|pigeons?|parrots?|fish)\b/],
  ['vehicles', /\b(cars?|sedan|truck|bus|van|taxi|motor\w*|moto|bike|bicycle|scooter|vehicles?|kart|guagua|carro|pickup)\b/],
  ['buildings', /\b(house|houses|buildings?|colmado|shop|store|walls?|doors?|windows?|roofs?|balcon\w*|stairs?|facade|kiosk|stall|market|apartments?|fence|gate|awning|street_kit|storefront|church|school|bodega|street block|block|blocks|plaza|malecon|neighborhood|barrio)\b/],
  ['nature', /\b(trees?|palms?|plants?|bush\w*|flowers?|rocks?|stones?|grass|leaf|leaves|nature|cactus|mango|coconut|foliage|flora|hedge|vines?)\b/],
];

/** Picks a category from the asset's kind, name and description. */
export function autoCategory(type: string, name: string, more = ''): AssetCategory {
  if (type.startsWith('audio')) return 'sounds';
  if (type !== 'mesh_3d' && type !== 'rig' && type !== 'animation') return 'images';
  if (type === 'rig' || type === 'animation') return 'characters';
  // The asset's own name and description decide first; file and folder names only when those say nothing.
  for (const text of [name, more]) {
    const words = text.toLowerCase().replace(/[_\-./]+/g, ' ');
    for (const [category, pattern] of CATEGORY_WORDS) if (pattern.test(words)) return category;
  }
  return 'props';
}

export interface FoundryTrashEntry {
  readonly trashId: string;
  readonly assetId: string;
  readonly displayName?: string;
  readonly type: string;
  readonly deletedAt: string;
  readonly files: number;
}

export interface FoundryBulkResult {
  readonly changed: readonly string[];
  readonly trashed: readonly string[];
  readonly removedFromLibrary: readonly string[];
}

export interface FoundryAssetMeta {
  readonly displayName?: string;
  readonly category?: AssetCategory;
  readonly prompt?: string;
  readonly draftGroup?: string;
  readonly styleId?: string;
  readonly hidden?: boolean;
  readonly source?: string;
  /** Preview rendered later (e.g. for imported models), stored under the data directory. */
  readonly previewPath?: string;
}

export interface FoundryAssetPreview {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly contentLength: number;
  readonly contentHash?: string;
}


function publicModelLabel(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  return (normalized.split('/').filter(Boolean).pop() ?? 'model').slice(0, 160);
}

export class FoundryAssetService {
  readonly store: FoundryAssetStore;
  private readonly allowedRoots: readonly string[];
  private readonly projects: readonly StudioProject[];
  readonly dataDirectory: string;
  private readonly metaPath: string;
  private meta_: Record<string, FoundryAssetMeta> = {};

  constructor(
    dataDirectory: string,
    projects: readonly StudioProject[],
    /** Extra folders whose files may be served (imported work folders). */
    extraRoots: readonly string[] = [],
  ) {
    this.store = new FoundryAssetStore(dataDirectory);
    this.projects = projects;
    this.dataDirectory = resolve(dataDirectory);
    this.metaPath = resolve(dataDirectory, 'foundry-assets', 'meta.json');
    if (existsSync(this.metaPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.metaPath, 'utf8')) as { assets?: Record<string, FoundryAssetMeta> };
        this.meta_ = parsed.assets && typeof parsed.assets === 'object' ? parsed.assets : {};
      } catch {
        this.meta_ = {};
      }
    }
    this.allowedRoots = [
      resolve(dataDirectory),
      ...projects.map((project) => resolve(project.path)),
      ...extraRoots.map((root) => resolve(root)),
    ];
  }

  list(): readonly FoundryAssetView[] {
    return this.store.list().map((manifest) => this.toView(manifest));
  }

  get(assetId: string): FoundryAssetView | undefined {
    const manifest = this.store.get(assetId);
    return manifest ? this.toView(manifest) : undefined;
  }

  lineage(assetId: string): readonly FoundryAssetView[] {
    return this.store.lineage(assetId).map((manifest) => this.toView(manifest));
  }

  registerExecution(execution: FoundryAssetExecution): void {
    this.store.registerExecution(execution);
  }

  preview(assetId: string): FoundryAssetPreview | undefined {
    const manifest = this.store.get(assetId);
    if (!manifest) return undefined;

    const path = this.safePreviewPath(manifest);
    if (!path) return undefined;

    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_PREVIEW_BYTES) {
      return undefined;
    }

    const contentType = PREVIEW_MIME[extname(path).toLowerCase()];
    if (!contentType) return undefined;

    return {
      bytes: readFileSync(path),
      contentType,
      contentLength: info.size,
      ...(manifest.contentHash ? { contentHash: manifest.contentHash } : {}),
    };
  }

  /** Serves one file that belongs to an asset (main file or a recorded companion), by file name. */
  file(assetId: string, name: string): FoundryAssetPreview | undefined {
    const manifest = this.store.get(assetId);
    if (!manifest) return undefined;
    const match = this.assetFiles(manifest).find((candidate) => basename(candidate) === name);
    const path = match ? this.safePath(match) : undefined;
    if (!path) return undefined;
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES) return undefined;
    const contentType = FILE_MIME[extname(path).toLowerCase()];
    if (!contentType) return undefined;
    return { bytes: readFileSync(path), contentType, contentLength: info.size };
  }

  /**
   * Copies an asset's deliverable files into a game project with a provenance
   * record, so assets made in the Asset Library can be used by any game.
   */
  sendToProject(assetId: string, projectId: string): { readonly projectId: string; readonly folder: string; readonly files: readonly string[] } {
    const manifest = this.store.get(assetId);
    if (!manifest) throw new Error('Asset not found.');
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('Choose a configured project to send the asset to.');
    if (!existsSync(project.path) || !lstatSync(project.path).isDirectory()) {
      throw new Error('The configured project path does not exist.');
    }

    const safeName = manifest.assetId.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    const relativeFolder = join('assets', 'matterhorn', safeName);
    const folder = resolve(project.path, relativeFolder);
    if (!folder.startsWith(resolve(project.path) + sep)) throw new Error('Invalid destination.');
    mkdirSync(folder, { recursive: true });

    const deliverable = this.assetFiles(manifest).filter((file) => {
      const ext = extname(file).toLowerCase();
      return ext === '.glb' || ext === '.gltf' || ext === '.png' || ext === '.blend' || file.endsWith('_script.py');
    });
    const copied: string[] = [];
    for (const source of deliverable) {
      const path = this.safePath(source);
      if (!path) continue;
      const target = join(folder, basename(path));
      if (resolve(target) === path) continue;
      copyFileSync(path, target);
      copied.push(join(relativeFolder, basename(path)).replace(/\\/g, '/'));
    }
    if (copied.length === 0) throw new Error('This asset has no files that can be sent to a project.');

    writeFileSync(join(folder, 'matterhorn-provenance.json'), JSON.stringify({
      assetId: manifest.assetId,
      type: manifest.type,
      generationProvider: manifest.generationProvider,
      model: manifest.model,
      promptHash: manifest.promptHash,
      contentHash: manifest.contentHash,
      parentAsset: manifest.parentAsset,
      sourceLicenseIds: manifest.sourceLicenseIds,
      createdAt: manifest.createdAt,
      sentAt: new Date().toISOString(),
      files: copied,
    }, null, 2), 'utf8');

    return { projectId: project.id, folder: relativeFolder.replace(/\\/g, '/'), files: copied };
  }

  private assetFiles(manifest: FoundryAssetManifest): readonly string[] {
    return [
      ...(manifest.localPath ? [manifest.localPath] : []),
      ...(manifest.companionFiles ?? []),
    ].filter((file) => isAbsolute(file));
  }

  private fileRole(manifest: FoundryAssetManifest, file: string): FoundryAssetFileView['role'] {
    const name = basename(file);
    if (file === manifest.localPath) return 'main';
    if (name.endsWith('_script.py')) return 'script';
    if (name.endsWith('.blend')) return 'source';
    if (name.startsWith('render_')) return 'render';
    if (manifest.generationProvider === 'imported' && PREVIEW_MIME[extname(name).toLowerCase()]) return 'render';
    if (name.startsWith('dir_')) return 'frame';
    if (/^spin_\d+\.png$/.test(name)) return 'spin';
    if (/^build_\d+\.png$/.test(name)) return 'build';
    if (/^anim_[a-z0-9-]+_\d+\.png$/.test(name)) return 'anim';
    if (name.endsWith('.json')) return 'report';
    if (file === manifest.previewPath) return 'preview';
    return 'other';
  }

  /** Merges user-facing metadata (name, description, draft group, visibility) for an asset. */
  setMeta(assetId: string, patch: FoundryAssetMeta): FoundryAssetView {
    if (!this.store.get(assetId)) throw new Error('Asset not found.');
    this.mergeMeta(assetId, patch);
    this.persistMeta();
    return this.get(assetId)!;
  }

  /** Same as setMeta for many assets with one write (imports). */
  setMetaMany(entries: readonly (readonly [string, FoundryAssetMeta])[]): void {
    for (const [assetId, patch] of entries) {
      if (this.store.get(assetId)) this.mergeMeta(assetId, patch);
    }
    this.persistMeta();
  }

  meta(assetId: string): FoundryAssetMeta | undefined {
    const value = this.meta_[assetId];
    return value ? { ...value } : undefined;
  }

  private mergeMeta(assetId: string, patch: FoundryAssetMeta): void {
    const next: Record<string, unknown> = { ...this.meta_[assetId] };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    this.meta_[assetId] = next as FoundryAssetMeta;
  }

  private persistMeta(): void {
    mkdirSync(dirname(this.metaPath), { recursive: true });
    const temp = `${this.metaPath}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, assets: this.meta_ }), 'utf8');
    renameSync(temp, this.metaPath);
  }

  /** Keeps one draft of a group and hides its siblings (they stay on disk and can be shown again). */
  /**
   * One action on many assets: hide/show, set a category, or delete. Delete moves files made in Matterhorn
   * to the Trash (restorable); files that live in a game or work folder are never deleted, those assets
   * only leave the library. Assets other assets were made from can only be deleted together with them.
   */
  bulk(action: string, assetIds: readonly string[], category?: string): FoundryBulkResult {
    const ids = [...new Set(assetIds)];
    if (!ids.length || ids.length > 2000) throw new Error('Select between 1 and 2000 assets.');
    for (const id of ids) if (!this.store.get(id)) throw new Error(`Asset not found: ${id}`);
    if (action === 'hide' || action === 'show') {
      this.setMetaMany(ids.map((id) => [id, { hidden: action === 'hide' ? true : undefined }]));
      return { changed: ids, trashed: [], removedFromLibrary: [] };
    }
    if (action === 'category') {
      if (category !== 'auto' && !(ASSET_CATEGORIES as readonly string[]).includes(category ?? '')) throw new Error('Choose a category.');
      this.setMetaMany(ids.map((id) => [id, { category: category === 'auto' ? undefined : category as AssetCategory }]));
      return { changed: ids, trashed: [], removedFromLibrary: [] };
    }
    if (action !== 'delete') throw new Error(`Unknown action: ${action}`);

    const selected = new Set(ids);
    const blocked = this.store.list().filter((m) => m.parentAsset && selected.has(m.parentAsset) && !selected.has(m.assetId));
    if (blocked.length) {
      const names = blocked.slice(0, 5).map((m) => this.meta_[m.assetId]?.displayName ?? m.assetId).join(', ');
      throw new Error(`Other assets were made from these: ${names}${blocked.length > 5 ? ` and ${blocked.length - 5} more` : ''}. Select them too, or remove them from the library instead.`);
    }
    const made = ids.filter((id) => this.store.get(id)?.generationProvider !== 'imported');
    const imported = ids.filter((id) => !made.includes(id));
    for (const id of made) this.moveToTrash(id);
    this.store.removeMany(made);
    for (const id of made) delete this.meta_[id];
    if (imported.length) this.setMetaMany(imported.map((id) => [id, { hidden: true }]));
    else this.persistMeta();
    return { changed: [], trashed: made, removedFromLibrary: imported };
  }

  trash(): readonly FoundryTrashEntry[] {
    if (!existsSync(this.trashDir)) return [];
    return readdirSync(this.trashDir)
      .map((name) => {
        try {
          const record = JSON.parse(readFileSync(join(this.trashDir, name, 'record.json'), 'utf8')) as TrashRecord;
          return { trashId: name, assetId: record.manifest.assetId, ...(record.meta?.displayName ? { displayName: record.meta.displayName } : {}), type: record.manifest.type, deletedAt: record.deletedAt, files: record.moved.length };
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is FoundryTrashEntry => Boolean(entry))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  /** Puts a deleted asset back: files to where they were, and the asset back in the library. */
  restore(trashId: string): FoundryAssetView {
    if (!/^[a-zA-Z0-9_.-]+$/.test(trashId)) throw new Error('Invalid trash entry.');
    const folder = join(this.trashDir, trashId);
    const record = JSON.parse(readFileSync(join(folder, 'record.json'), 'utf8')) as TrashRecord;
    const manifest = record.manifest;
    if (this.store.get(manifest.assetId)) throw new Error('An asset with this name is already in the library.');
    if (manifest.parentAsset && !this.store.get(manifest.parentAsset)) {
      throw new Error(`Restore "${manifest.parentAsset}" first; this asset was made from it.`);
    }
    for (const { from, to } of record.moved) {
      if (existsSync(from)) throw new Error(`Something already exists where this asset's files were: ${from}`);
    }
    for (const { from, to } of record.moved) {
      mkdirSync(dirname(from), { recursive: true });
      moveFile(to, from);
    }
    this.store.register(manifest);
    if (record.meta) this.meta_[manifest.assetId] = record.meta;
    this.persistMeta();
    rmSync(folder, { recursive: true, force: true });
    return this.get(manifest.assetId)!;
  }

  /** Permanently deletes everything in the Trash (only ever on the owner's click). */
  emptyTrash(): number {
    const count = this.trash().length;
    if (existsSync(this.trashDir)) rmSync(this.trashDir, { recursive: true, force: true });
    return count;
  }

  private get trashDir(): string {
    return join(this.dataDirectory, 'foundry-assets', 'trash');
  }

  /** Moves a made-in-Matterhorn asset's folder (or its own files) into the Trash with a record to restore it. */
  private moveToTrash(assetId: string): void {
    const manifest = this.store.require(assetId);
    const files = this.assetFiles(manifest).map((file) => this.safePath(file)).filter((file): file is string => Boolean(file));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folder = join(this.trashDir, `${stamp}_${assetId.replace(/[^a-zA-Z0-9_.-]+/g, '_')}`.slice(0, 180));
    mkdirSync(folder, { recursive: true });
    const moved: { from: string; to: string }[] = [];
    // A build folder that holds only this asset moves as a whole (renders, scripts, work files together).
    const home = manifest.localPath ? dirname(resolve(manifest.localPath)) : undefined;
    const others = this.store.list().filter((m) => m.assetId !== assetId);
    const shared = home && others.some((m) => [m.localPath, ...(m.companionFiles ?? [])].some((f) => f && resolve(f).startsWith(home + sep)));
    if (home && existsSync(home) && !shared && /[\\/]generated[\\/]/.test(home) && !this.isRoot(home)) {
      const to = join(folder, 'files');
      moveFile(home, to);
      moved.push({ from: home, to });
    } else {
      for (const [index, file] of files.entries()) {
        const to = join(folder, 'files', `${index}_${basename(file)}`);
        mkdirSync(dirname(to), { recursive: true });
        moveFile(file, to);
        moved.push({ from: file, to });
      }
    }
    const record: TrashRecord = { manifest, meta: this.meta_[assetId], moved, deletedAt: new Date().toISOString() };
    writeFileSync(join(folder, 'record.json'), JSON.stringify(record, null, 2), 'utf8');
  }

  private isRoot(path: string): boolean {
    const target = resolve(path);
    return this.allowedRoots.some((root) => resolve(root) === target);
  }

  keepDraft(assetId: string): readonly FoundryAssetView[] {
    const group = this.meta_[assetId]?.draftGroup;
    if (!group) throw new Error('This asset is not one of a set of drafts.');
    const changed: FoundryAssetView[] = [];
    for (const [id, meta] of Object.entries(this.meta_)) {
      if (meta.draftGroup !== group || !this.store.get(id)) continue;
      changed.push(this.setMeta(id, { hidden: id === assetId ? undefined : true, draftGroup: id === assetId ? undefined : group }));
    }
    return changed;
  }

  private toView(manifest: FoundryAssetManifest): FoundryAssetView {
    const meta = this.meta_[manifest.assetId] ?? {};
    return {
      assetId: manifest.assetId,
      type: manifest.type,
      ...(manifest.operation ? { operation: manifest.operation } : {}),
      ...(manifest.generationProvider
        ? { generationProvider: manifest.generationProvider }
        : {}),
      ...(manifest.model ? { model: publicModelLabel(manifest.model) } : {}),
      ...(manifest.outputIndex !== undefined
        ? { outputIndex: manifest.outputIndex }
        : {}),
      ...(manifest.parentAsset ? { parentAsset: manifest.parentAsset } : {}),
      ...(manifest.referenceAssets
        ? { referenceAssets: manifest.referenceAssets }
        : {}),
      ...(manifest.width !== undefined ? { width: manifest.width } : {}),
      ...(manifest.height !== undefined ? { height: manifest.height } : {}),
      ...(manifest.palette ? { palette: manifest.palette } : {}),
      ...(manifest.cost ? { cost: manifest.cost } : {}),
      createdAt: manifest.createdAt,
      ...(manifest.contentHash ? { contentHash: manifest.contentHash } : {}),
      ...(manifest.sourceLicenseIds
        ? { sourceLicenseIds: manifest.sourceLicenseIds }
        : {}),
      ...(this.safePreviewPath(manifest)
        ? {
            previewUrl: `/api/foundry/assets/${encodeURIComponent(
              manifest.assetId,
            )}/preview`,
          }
        : {}),
      ...(manifest.companionFiles?.length || manifest.generationProvider === 'imported'
        ? {
            files: this.assetFiles(manifest)
              .filter((file) => FILE_MIME[extname(file).toLowerCase()] && existsSync(file))
              .map((file) => ({
                name: basename(file),
                role: this.fileRole(manifest, file),
                url: `/api/foundry/assets/${encodeURIComponent(manifest.assetId)}/files/${encodeURIComponent(basename(file))}`,
              })),
          }
        : {}),
      ...(meta.displayName ? { displayName: meta.displayName } : {}),
      ...(meta.prompt ? { prompt: meta.prompt } : {}),
      ...(meta.draftGroup ? { draftGroup: meta.draftGroup } : {}),
      ...(meta.styleId ? { styleId: meta.styleId } : {}),
      ...(meta.hidden ? { hidden: true } : {}),
      ...(meta.source ? { source: meta.source } : {}),
      category: meta.category ?? autoCategory(
        manifest.type,
        [meta.displayName, meta.prompt, manifest.generationProvider === 'mini-rigger' ? 'rigged character' : ''].filter(Boolean).join(' '),
        [manifest.assetId, manifest.localPath ? basename(dirname(manifest.localPath)) : '', manifest.localPath ? basename(manifest.localPath) : ''].filter(Boolean).join(' '),
      ),
      ...(meta.category ? { categorySetByOwner: true } : {}),
    };
  }

  private safePreviewPath(manifest: FoundryAssetManifest): string | undefined {
    const localPath = [manifest.previewPath, this.meta_[manifest.assetId]?.previewPath, manifest.localPath].find(
      (path) => path && isAbsolute(path) && PREVIEW_MIME[extname(path).toLowerCase()] && existsSync(path),
    );
    return localPath ? this.safePath(localPath) : undefined;
  }

  private safePath(localPath: string): string | undefined {
    if (!isAbsolute(localPath) || !existsSync(localPath)) return undefined;

    let candidate: string;
    try {
      candidate = realpathSync(localPath);
    } catch {
      return undefined;
    }

    const allowed = this.allowedRoots.some((root) => {
      let canonicalRoot = root;
      try {
        if (existsSync(root)) canonicalRoot = realpathSync(root);
      } catch {
        return false;
      }
      return candidate === canonicalRoot || candidate.startsWith(canonicalRoot + sep);
    });

    return allowed ? candidate : undefined;
  }
}

interface TrashRecord {
  readonly manifest: FoundryAssetManifest;
  readonly meta?: FoundryAssetMeta;
  readonly moved: readonly { readonly from: string; readonly to: string }[];
  readonly deletedAt: string;
}

/** Rename, or copy-and-remove when the Trash is on another drive. */
function moveFile(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}
