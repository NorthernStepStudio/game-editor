import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  extname,
  isAbsolute,
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

export interface FoundryAssetView {
  readonly assetId: string;
  readonly type: string;
  readonly operation?: string;
  readonly generationProvider?: string;
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
}

export interface FoundryAssetPreview {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly contentLength: number;
  readonly contentHash?: string;
}

export class FoundryAssetService {
  readonly store: FoundryAssetStore;
  private readonly allowedRoots: readonly string[];

  constructor(
    dataDirectory: string,
    projects: readonly StudioProject[],
  ) {
    this.store = new FoundryAssetStore(dataDirectory);
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

    return {
      bytes: readFileSync(path),
      contentType: PREVIEW_MIME[extname(path).toLowerCase()],
      contentLength: info.size,
      ...(manifest.contentHash ? { contentHash: manifest.contentHash } : {}),
    };
  }

  private toView(manifest: FoundryAssetManifest): FoundryAssetView {
    return {
      assetId: manifest.assetId,
      type: manifest.type,
      ...(manifest.operation ? { operation: manifest.operation } : {}),
      ...(manifest.generationProvider
        ? { generationProvider: manifest.generationProvider }
        : {}),
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
    };
  }

  private safePreviewPath(manifest: FoundryAssetManifest): string | undefined {
    const localPath = manifest.localPath;
    if (!localPath || !isAbsolute(localPath)) return undefined;
    if (!PREVIEW_MIME[extname(localPath).toLowerCase()]) return undefined;
    if (!existsSync(localPath)) return undefined;

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
