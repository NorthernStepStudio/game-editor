export type FoundryProjectKind = "game" | "prototype" | "scene" | "asset-pack";

export interface FoundryResolution {
  readonly width: number;
  readonly height: number;
}

export interface FoundryArtBible {
  readonly id: string;
  readonly style: string;
  readonly logicalResolution?: FoundryResolution;
  readonly pixelScale?: number;
  readonly palette?: readonly string[];
  readonly outlineRules?: string;
  readonly lightingDirection?: string;
  readonly contrastHierarchy?: string;
  readonly cameraRules?: string;
  readonly perspective?: string;
  readonly characterProportions?: string;
  readonly animationTiming?: string;
  readonly environmentMotifs?: readonly string[];
  readonly uiGrammar?: string;
  readonly typography?: string;
  readonly vfxGrammar?: string;
  readonly referenceAssets?: readonly string[];
  readonly forbiddenPatterns?: readonly string[];
}

export interface FoundrySceneLayerSpec {
  readonly id: string;
  readonly role: "background" | "midground" | "foreground" | "ui" | "effects";
  readonly parallax?: number;
  readonly notes?: string;
}

export interface FoundrySceneActorSpec {
  readonly id: string;
  readonly role: string;
  readonly assetId?: string;
  readonly initialState?: string;
  readonly requiredStates?: readonly string[];
}

export interface FoundrySceneInteractionSpec {
  readonly id: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly trigger: string;
  readonly result: string;
}

export interface FoundrySceneSpec {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly artBibleId?: string;
  readonly logicalResolution?: FoundryResolution;
  readonly layers?: readonly FoundrySceneLayerSpec[];
  readonly actors?: readonly FoundrySceneActorSpec[];
  readonly interactions?: readonly FoundrySceneInteractionSpec[];
  readonly animationFlow?: readonly string[];
  readonly acceptanceCriteria?: readonly string[];
}

export interface FoundryPerformanceBudget {
  readonly targetFps?: number;
  readonly maxFrameTimeMs?: number;
  readonly maxMemoryMb?: number;
  readonly maxDrawCalls?: number;
  readonly maxParticles?: number;
}

export interface FoundryStudioSpec {
  readonly protocol: "nss.foundry.studio-spec.v1";
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly kind: FoundryProjectKind;
  readonly createdAt: string;
  readonly artBible: FoundryArtBible;
  readonly scenes: readonly FoundrySceneSpec[];
  readonly performanceBudget?: FoundryPerformanceBudget;
  readonly finalAcceptanceCriteria?: readonly string[];
}
