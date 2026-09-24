import type {
  FoundryAssetCost,
  FoundryAssetManifest,
  FoundryLicenseRecord,
} from "../provenance/types.js";

export type FoundryAssetKind =
  | "pixel_sprite"
  | "sprite_sheet"
  | "texture"
  | "tile"
  | "tileset"
  | "ui_icon"
  | "ui_atlas"
  | "concept_art"
  | "background"
  | "mesh_3d"
  | "material"
  | "rig"
  | "animation"
  | "audio_sfx"
  | "audio_music"
  | "audio_voice"
  | "other";

export type FoundryAssetOperation =
  | "generate"
  | "edit"
  | "style_reference"
  | "direction_set"
  | "animate"
  | "upscale"
  | "background_remove"
  | "palette_normalize"
  | "pack_sheet"
  | "image_to_3d"
  | "rig"
  | "retarget"
  | "audio_generate"
  | "audio_loop";

export interface FoundryAssetDimensions {
  readonly width: number;
  readonly height: number;
}

export interface FoundryAssetRequest {
  readonly requestId: string;
  readonly assetId: string;
  readonly kind: FoundryAssetKind;
  readonly operation: FoundryAssetOperation;
  readonly prompt?: string;
  readonly artBibleId?: string;
  readonly dimensions?: FoundryAssetDimensions;
  readonly intendedWorldWidth?: number;
  readonly intendedWorldHeight?: number;
  readonly palette?: readonly string[];
  readonly referenceAssets?: readonly string[];
  readonly parentAsset?: string;
  readonly seed?: string | number;
  readonly tags?: readonly string[];
}

export interface FoundryAssetProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly operations: readonly FoundryAssetOperation[];
  readonly kinds: readonly FoundryAssetKind[];
  readonly local: boolean;
  readonly requiresNetwork: boolean;
  readonly externalCost: boolean;
  readonly supportsSeed: boolean;
  readonly supportsReferences: boolean;
  readonly outputLicense: FoundryLicenseRecord;
  readonly modelLicense?: FoundryLicenseRecord;
  readonly commercialUseAllowed: boolean;
  readonly priority?: number;
}

export interface FoundryAssetRoutingPolicy {
  readonly requireLocal?: boolean;
  readonly allowNetwork?: boolean;
  readonly allowExternalCost?: boolean;
  readonly requireCommercialUse?: boolean;
  readonly allowedProviders?: readonly string[];
  readonly blockedProviders?: readonly string[];
  readonly maxEstimatedCost?: FoundryAssetCost;
}

export interface FoundryAssetProviderContext {
  readonly projectId?: string;
  readonly outputRoot?: string;
  readonly maxCost?: FoundryAssetCost;
}

export interface FoundryGeneratedAsset {
  readonly providerId: string;
  readonly requestId: string;
  readonly outputIndex: number;
  readonly providerAssetId?: string;
  readonly providerRequestId?: string;
  readonly localPath?: string;
  readonly contentHash?: string;
  readonly width?: number;
  readonly height?: number;
  readonly seed?: string | number;
  readonly cost?: FoundryAssetCost;
  readonly sourceUrl?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface FoundryAssetProviderResult {
  readonly outputs: readonly FoundryGeneratedAsset[];
  readonly providerRequestId?: string;
  readonly cost?: FoundryAssetCost;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface FoundryAssetProvider {
  readonly descriptor: FoundryAssetProviderDescriptor;
  execute(
    request: FoundryAssetRequest,
    context?: FoundryAssetProviderContext,
  ): Promise<FoundryAssetProviderResult>;
}

export interface FoundryAssetExecution {
  readonly request: FoundryAssetRequest;
  readonly provider: FoundryAssetProviderDescriptor;
  readonly generated: FoundryAssetProviderResult;
  readonly manifests: readonly FoundryAssetManifest[];
}
