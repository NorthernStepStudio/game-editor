export type NssStudioDomain =
  | "orchestration"
  | "software"
  | "godot"
  | "blender"
  | "art"
  | "audio"
  | "qa"
  | "release";

export type NssStudioSpecialistId = "matterhorn" | "flyrail" | "blender-engine" | "foundry";

export type NssStudioSpecialistAvailability = "available" | "integration-pending" | "planned";

export type NssStudioExecutionMode = "orchestrator" | "executor";

export interface NssStudioCapability {
  readonly id: string;
  readonly domain: NssStudioDomain;
  readonly description: string;
}

export interface NssStudioSpecialist {
  readonly id: NssStudioSpecialistId;
  readonly title: string;
  readonly role: string;
  readonly executionMode: NssStudioExecutionMode;
  readonly availability: NssStudioSpecialistAvailability;
  readonly capabilities: readonly NssStudioCapability[];
}

export type NssStudioTaskStatus =
  | "planned"
  | "ready"
  | "accepted"
  | "running"
  | "blocked"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export interface NssStudioArtifactRef {
  readonly kind: string;
  readonly uri: string;
  readonly label?: string;
  readonly producedBy?: NssStudioSpecialistId;
  readonly assetId?: string;
  readonly provenance?: {
    readonly requestId?: string;
    readonly providerId?: string;
    readonly contentHash?: string;
    readonly parentAsset?: string;
    readonly referenceAssets?: readonly string[];
  };
}

export interface NssStudioFoundryTaskSpec {
  readonly protocol: "nss.studio-task-spec.v1";
  readonly specialist: "foundry";
  readonly action: "generate_asset";
  readonly projectId: string;
  readonly assetId: string;
  readonly kind: import("../foundry/assets/types.js").FoundryAssetKind;
  readonly operation: import("../foundry/assets/types.js").FoundryAssetOperation;
  readonly prompt: string;
  readonly parentAsset?: string;
  readonly referenceAssets?: readonly string[];
  readonly width?: number;
  readonly height?: number;
  readonly providerId?: string;
  /** Per-run approval. Persisted routing preferences never set these to true. */
  readonly allowNetwork: boolean;
  readonly approveExternalCost: boolean;
  readonly maxCost?: import("../foundry/provenance/types.js").FoundryAssetCost;
  readonly requireCommercialUse: boolean;
}

export interface NssStudioBlenderTaskSpec {
  readonly protocol: "nss.studio-task-spec.v1";
  readonly specialist: "blender-engine";
  readonly action: "execute_spec";
  readonly prompt: string;
  readonly sourceAssetIds?: readonly string[];
  readonly specification?: import("./adapters/blender/blenderTaskSpec.js").BlenderTaskSpec;
}

export interface NssStudioQaTaskSpec {
  readonly protocol: "nss.studio-task-spec.v1";
  readonly specialist: "matterhorn";
  readonly action: "aggregate_evidence";
  readonly dependencyTaskIds: readonly string[];
  readonly criteria: readonly string[];
}

export type NssStudioTaskSpec =
  | NssStudioFoundryTaskSpec
  | NssStudioBlenderTaskSpec
  | NssStudioQaTaskSpec;

export interface NssStudioTaskDisclosure {
  readonly networkMayBeRequired: boolean;
  readonly externalCostMayBeIncurred: boolean;
  readonly explicitApprovalRequired: boolean;
  readonly providerId?: string;
  readonly estimatedCost?: import("../foundry/provenance/types.js").FoundryAssetCost;
}

export interface NssStudioEvidence {
  readonly kind: "log" | "test" | "render" | "screenshot" | "artifact" | "report";
  readonly summary: string;
  readonly outcome?: "passed" | "failed" | "blocked" | "unknown";
  readonly uri?: string;
}

export interface NssStudioTask {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly domain: NssStudioDomain;
  readonly specialistId: NssStudioSpecialistId;
  readonly status: NssStudioTaskStatus;
  readonly dependsOn: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly inputArtifacts?: readonly NssStudioArtifactRef[];
  readonly outputArtifacts?: readonly NssStudioArtifactRef[];
  readonly taskSpec?: NssStudioTaskSpec;
  readonly disclosure?: NssStudioTaskDisclosure;
}

export interface NssStudioPlan {
  readonly id: string;
  readonly goal: string;
  readonly createdAt: string;
  readonly tasks: readonly NssStudioTask[];
  readonly finalAcceptanceCriteria: readonly string[];
}

export interface NssStudioPlanTaskInput {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly domain: NssStudioDomain;
  readonly specialistId?: NssStudioSpecialistId;
  readonly dependsOn?: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly inputArtifacts?: readonly NssStudioArtifactRef[];
  readonly outputArtifacts?: readonly NssStudioArtifactRef[];
  readonly taskSpec?: NssStudioTaskSpec;
  readonly disclosure?: NssStudioTaskDisclosure;
}

export interface NssStudioPlanInput {
  readonly id?: string;
  readonly goal: string;
  readonly tasks: readonly NssStudioPlanTaskInput[];
  readonly finalAcceptanceCriteria?: readonly string[];
}

export interface NssStudioPlanValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export type NssStudioCheckType =
  | 'property_equals'
  | 'property_range'
  | 'node_exists'
  | 'movement_position'
  | 'health_damage'
  | 'timed_scenario'
  | 'generic';

export interface NssStudioCriterionResult {
  readonly criterionId?: string;
  readonly description?: string;
  readonly checkType?: NssStudioCheckType;
  readonly target?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly outcome: 'passed' | 'failed' | 'blocked' | 'unknown';
  readonly evidenceUri?: string;
  readonly executionId?: string;
  readonly sourceExecutionId?: string;
  readonly sourceExecutionIds?: readonly string[];
  readonly timestamp?: string;
  readonly criterion?: string;
}

export interface NssStudioHandoff {
  readonly protocol: "nss.studio-handoff.v1";
  readonly id: string;
  readonly taskId: string;
  readonly from: NssStudioSpecialistId;
  readonly to: NssStudioSpecialistId;
  readonly goal: string;
  readonly acceptanceCriteria: readonly string[];
  readonly inputArtifacts: readonly NssStudioArtifactRef[];
  readonly taskSpec?: NssStudioTaskSpec;
  readonly dependencyResults?: readonly NssStudioExecutionResult[];
}

export interface NssStudioExecutionResult {
  readonly taskId: string;
  readonly specialistId: NssStudioSpecialistId;
  readonly status: "completed" | "failed" | "blocked";
  readonly summary: string;
  readonly artifacts?: readonly NssStudioArtifactRef[];
  readonly evidence?: readonly NssStudioEvidence[];
  readonly criterionResults?: readonly NssStudioCriterionResult[];
}

