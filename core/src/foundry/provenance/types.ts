export type FoundrySourceType =
  | "repository"
  | "documentation"
  | "paper"
  | "post"
  | "asset"
  | "model"
  | "service"
  | "generated";

export type FoundryLicenseClassification =
  | "permissive"
  | "weak-copyleft"
  | "copyleft"
  | "public-domain"
  | "source-available"
  | "proprietary"
  | "unlicensed"
  | "unknown";

export type FoundryReusePolicy =
  | "direct"
  | "adapter-only"
  | "clean-room-reimplement"
  | "reference-only"
  | "blocked"
  | "review-required";

export interface FoundryLicenseRecord {
  readonly name: string;
  readonly spdxId?: string;
  readonly classification: FoundryLicenseClassification;
  readonly reusePolicy: FoundryReusePolicy;
  readonly sourceUrl?: string;
  readonly noticeRequired?: boolean;
  readonly notes?: string;
}

export interface FoundrySourceManifest {
  readonly sourceId: string;
  readonly name: string;
  readonly type: FoundrySourceType;
  readonly url?: string;
  readonly retrievedAt: string;
  readonly contentHash?: string;
  readonly license: FoundryLicenseRecord;
  readonly capabilities?: readonly string[];
}

export interface FoundryAssetCost {
  readonly currency: string;
  readonly amount: number;
}

export interface FoundryAssetManifest {
  readonly assetId: string;
  readonly type: string;
  readonly requestId?: string;
  readonly operation?: string;
  readonly providerRequestId?: string;
  readonly providerAssetId?: string;
  readonly outputIndex?: number;
  readonly sourceUrl?: string;
  readonly sourceIds: readonly string[];
  readonly sourceLicenseIds?: readonly string[];
  readonly generationProvider?: string;
  readonly model?: string;
  readonly promptHash?: string;
  readonly seed?: string | number;
  readonly referenceAssets?: readonly string[];
  readonly parentAsset?: string;
  readonly width?: number;
  readonly height?: number;
  readonly intendedWorldWidth?: number;
  readonly intendedWorldHeight?: number;
  readonly palette?: readonly string[];
  readonly cost?: FoundryAssetCost;
  readonly createdAt: string;
  readonly contentHash?: string;
  readonly localPath?: string;
  /** Image shown in the catalog when the main file is not itself an image (e.g. a GLB). */
  readonly previewPath?: string;
  /** Other files produced with the asset: editable source, generator script, renders, reports. */
  readonly companionFiles?: readonly string[];
  readonly godotResource?: string;
  readonly validationEvidence?: readonly string[];
}
