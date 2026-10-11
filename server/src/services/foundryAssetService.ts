import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
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
};

export interface FoundryAssetFileView {
  readonly name: string;
  readonly role: 'main' | 'preview' | 'source' | 'script' | 'render' | 'frame' | 'report' | 'other';
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
}

export interface FoundryAssetMeta {
  readonly displayName?: string;
  readonly prompt?: string;
  readonly draftGroup?: string;
  readonly styleId?: string;
  readonly hidden?: boolean;
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
  private meta: Record<string, FoundryAssetMeta> = {};

  constructor(
    dataDirectory: string,
    projects: readonly StudioProject[],
  ) {
    this.store = new FoundryAssetStore(dataDirectory);
    this.projects = projects;
    this.dataDirectory = resolve(dataDirectory);
    this.metaPath = resolve(dataDirectory, 'foundry-assets', 'meta.json');
    if (existsSync(this.metaPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.metaPath, 'utf8')) as { assets?: Record<string, FoundryAssetMeta> };
        this.meta = parsed.assets && typeof parsed.assets === 'object' ? parsed.assets : {};
      } catch {
        this.meta = {};
      }
    }
    this.allowedRoots = [
      resolve(dataDirectory),
      ...projects.map((project) => resolve(project.path)),
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
    if (name.startsWith('dir_')) return 'frame';
    if (name.endsWith('.json')) return 'report';
    if (file === manifest.previewPath) return 'preview';
    return 'other';
  }

  /** Merges user-facing metadata (name, description, draft group, visibility) for an asset. */
  setMeta(assetId: string, patch: FoundryAssetMeta): FoundryAssetView {
    if (!this.store.get(assetId)) throw new Error('Asset not found.');
    const next: Record<string, unknown> = { ...this.meta[assetId] };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    this.meta[assetId] = next as FoundryAssetMeta;
    mkdirSync(dirname(this.metaPath), { recursive: true });
    const temp = `${this.metaPath}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, assets: this.meta }), 'utf8');
    renameSync(temp, this.metaPath);
    return this.get(assetId)!;
  }

  /** Keeps one draft of a group and hides its siblings (they stay on disk and can be shown again). */
  keepDraft(assetId: string): readonly FoundryAssetView[] {
    const group = this.meta[assetId]?.draftGroup;
    if (!group) throw new Error('This asset is not one of a set of drafts.');
    const changed: FoundryAssetView[] = [];
    for (const [id, meta] of Object.entries(this.meta)) {
      if (meta.draftGroup !== group || !this.store.get(id)) continue;
      changed.push(this.setMeta(id, { hidden: id === assetId ? undefined : true, draftGroup: id === assetId ? undefined : group }));
    }
    return changed;
  }

  private toView(manifest: FoundryAssetManifest): FoundryAssetView {
    const meta = this.meta[manifest.assetId] ?? {};
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
      ...(manifest.companionFiles?.length
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
    };
  }

  private safePreviewPath(manifest: FoundryAssetManifest): string | undefined {
    const localPath = [manifest.previewPath, manifest.localPath].find(
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
