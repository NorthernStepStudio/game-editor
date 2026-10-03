import { createHash } from "node:crypto";
import type { FoundryAssetManifest } from "../provenance/types.js";
import type {
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
  FoundryGeneratedAsset,
} from "./types.js";

export interface FoundryAssetManifestOptions {
  readonly assetId: string;
  readonly createdAt?: string;
  readonly providerRequestId?: string;
}

export function createFoundryAssetManifest(
  request: FoundryAssetRequest,
  provider: FoundryAssetProviderDescriptor,
  generated: FoundryGeneratedAsset,
  options: FoundryAssetManifestOptions,
): FoundryAssetManifest {
  if (generated.providerId !== provider.id) {
    throw new Error("Generated asset providerId does not match selected provider.");
  }
  if (generated.requestId !== request.requestId) {
    throw new Error("Generated asset requestId does not match request.");
  }
  if (!Number.isInteger(generated.outputIndex) || generated.outputIndex < 0) {
    throw new Error("Generated asset outputIndex must be a non-negative integer.");
  }

  const width = generated.width ?? request.dimensions?.width;
  const height = generated.height ?? request.dimensions?.height;
  const providerRequestId =
    generated.providerRequestId ?? options.providerRequestId;

  return {
    assetId: options.assetId,
    type: request.kind,
    requestId: request.requestId,
    operation: request.operation,
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(generated.providerAssetId
      ? { providerAssetId: generated.providerAssetId }
      : {}),
    outputIndex: generated.outputIndex,
    ...(generated.sourceUrl ? { sourceUrl: generated.sourceUrl } : {}),
    sourceIds: [`provider:${provider.id}`],
    sourceLicenseIds: [
      provider.outputLicense.spdxId ?? provider.outputLicense.name,
    ],
    generationProvider: provider.id,
    ...(generated.metadata?.model
      ? { model: String(generated.metadata.model) }
      : {}),
    ...(request.prompt
      ? {
          promptHash: createHash("sha256")
            .update(request.prompt)
            .digest("hex"),
        }
      : {}),
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
    ...(request.referenceAssets
      ? { referenceAssets: request.referenceAssets }
      : {}),
    ...(request.parentAsset ? { parentAsset: request.parentAsset } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(request.intendedWorldWidth !== undefined
      ? { intendedWorldWidth: request.intendedWorldWidth }
      : {}),
    ...(request.intendedWorldHeight !== undefined
      ? { intendedWorldHeight: request.intendedWorldHeight }
      : {}),
    ...(request.palette ? { palette: request.palette } : {}),
    ...(generated.cost ? { cost: generated.cost } : {}),
    createdAt: options.createdAt ?? new Date().toISOString(),
    ...(generated.contentHash ? { contentHash: generated.contentHash } : {}),
    ...(generated.localPath ? { localPath: generated.localPath } : {}),
  };
}
