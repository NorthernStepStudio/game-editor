import type { FoundryAssetManifest } from "../provenance/types.js";
import type { FoundryAssetExecution } from "./types.js";

export interface FoundryResolvedAssetReference {
  readonly assetId: string;
  readonly generationProvider?: string;
  readonly providerAssetId?: string;
  readonly providerRequestId?: string;
  readonly localPath?: string;
  readonly sourceUrl?: string;
  readonly contentHash?: string;
}

export class FoundryAssetCatalog {
  private readonly manifests = new Map<string, FoundryAssetManifest>();

  register(manifest: FoundryAssetManifest): void {
    this.registerMany([manifest]);
  }

  registerMany(manifests: readonly FoundryAssetManifest[]): void {
    const incoming = new Set<string>();
    for (const manifest of manifests) {
      validateCatalogManifest(manifest);
      if (incoming.has(manifest.assetId)) {
        throw new Error(
          `Asset catalog batch contains duplicate assetId ${manifest.assetId}.`,
        );
      }
      if (this.manifests.has(manifest.assetId)) {
        throw new Error(
          `Asset catalog already contains assetId ${manifest.assetId}.`,
        );
      }
      incoming.add(manifest.assetId);
    }

    for (const manifest of manifests) {
      this.manifests.set(manifest.assetId, manifest);
    }
  }

  registerExecution(execution: FoundryAssetExecution): void {
    this.registerMany(execution.manifests);
  }

  get(assetId: string): FoundryAssetManifest | undefined {
    return this.manifests.get(assetId);
  }

  require(assetId: string): FoundryAssetManifest {
    const manifest = this.get(assetId);
    if (!manifest) throw new Error(`Unknown assetId: ${assetId}`);
    return manifest;
  }

  list(): readonly FoundryAssetManifest[] {
    return [...this.manifests.values()].sort((a, b) =>
      a.assetId.localeCompare(b.assetId),
    );
  }

  resolve(assetId: string): FoundryResolvedAssetReference {
    const manifest = this.require(assetId);
    return {
      assetId,
      ...(manifest.generationProvider
        ? { generationProvider: manifest.generationProvider }
        : {}),
      ...(manifest.providerAssetId
        ? { providerAssetId: manifest.providerAssetId }
        : {}),
      ...(manifest.providerRequestId
        ? { providerRequestId: manifest.providerRequestId }
        : {}),
      ...(manifest.localPath ? { localPath: manifest.localPath } : {}),
      ...(manifest.sourceUrl ? { sourceUrl: manifest.sourceUrl } : {}),
      ...(manifest.contentHash ? { contentHash: manifest.contentHash } : {}),
    };
  }

  lineage(assetId: string): readonly FoundryAssetManifest[] {
    const lineage: FoundryAssetManifest[] = [];
    const visited = new Set<string>();
    let current: FoundryAssetManifest | undefined = this.require(assetId);

    while (current) {
      if (visited.has(current.assetId)) {
        throw new Error(
          `Asset lineage cycle detected at ${current.assetId}.`,
        );
      }
      visited.add(current.assetId);
      lineage.push(current);
      if (!current.parentAsset) break;
      current = this.manifests.get(current.parentAsset);
      if (!current) {
        throw new Error(
          `Asset lineage for ${assetId} references missing parent ${lineage[lineage.length - 1].parentAsset}.`,
        );
      }
    }

    return lineage.reverse();
  }
}

function validateCatalogManifest(manifest: FoundryAssetManifest): void {
  if (!manifest.assetId.trim()) {
    throw new Error("Asset catalog manifest requires a non-empty assetId.");
  }
  if (!manifest.type.trim()) {
    throw new Error(
      `Asset catalog manifest ${manifest.assetId} requires a type.`,
    );
  }
  if (!manifest.createdAt.trim()) {
    throw new Error(
      `Asset catalog manifest ${manifest.assetId} requires createdAt.`,
    );
  }
}
