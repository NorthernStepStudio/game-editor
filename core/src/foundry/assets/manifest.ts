import type { FoundryAssetManifest } from "../provenance/types.js";
import type {
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
  FoundryGeneratedAsset,
} from "./types.js";

export function createFoundryAssetManifest(
  request: FoundryAssetRequest,
  provider: FoundryAssetProviderDescriptor,
  generated: FoundryGeneratedAsset,
  createdAt = new Date().toISOString(),
): FoundryAssetManifest {
  if (generated.providerId !== provider.id) {
    throw new Error("Generated asset providerId does not match selected provider.");
  }
  if (generated.requestId !== request.requestId) {
    throw new Error("Generated asset requestId does not match request.");
  }
  if (generated.assetId !== request.assetId) {
    throw new Error("Generated asset assetId does not match request.");
  }

  return {
    assetId: request.assetId,
    type: request.kind,
    sourceIds: [`provider:${provider.id}`],
    sourceLicenseIds: [
      provider.outputLicense.spdxId ?? provider.outputLicense.name,
    ],
    generationProvider: provider.id,
    ...(generated.metadata?.model
      ? { model: String(generated.metadata.model) }
      : {}),
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
    ...(request.referenceAssets
      ? { referenceAssets: request.referenceAssets }
      : {}),
    ...(request.parentAsset ? { parentAsset: request.parentAsset } : {}),
    ...(generated.width ?? request.dimensions?.width) !== undefined
      ? { width: generated.width ?? request.dimensions?.width }
      : {},
    ...(generated.height ?? request.dimensions?.height) !== undefined
      ? { height: generated.height ?? request.dimensions?.height }
      : {},
    ...(request.intendedWorldWidth !== undefined
      ? { intendedWorldWidth: request.intendedWorldWidth }
      : {}),
    ...(request.intendedWorldHeight !== undefined
      ? { intendedWorldHeight: request.intendedWorldHeight }
      : {}),
    ...(request.palette ? { palette: request.palette } : {}),
    ...(generated.cost ? { cost: generated.cost } : {}),
    createdAt,
    ...(generated.contentHash ? { contentHash: generated.contentHash } : {}),
    ...(generated.localPath ? { localPath: generated.localPath } : {}),
  };
}
