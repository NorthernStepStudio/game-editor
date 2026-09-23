export type NssStudioDomain =
  | "orchestration"
  | "software"
  | "godot"
  | "blender"
  | "art"
  | "audio"
  | "qa"
  | "release";

export type NssStudioSpecialistId = "matterhorn" | "flyrail" | "blender-engine";

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
  | "running"
  | "blocked"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export interface NssStudioArtifactRef {
  readonly kind: string;
  readonly uri: string;
  readonly label?: string;
  readonly producedBy?: NssStudioSpecialistId;
}

export interface NssStudioEvidence {
  readonly kind: "log" | "test" | "render" | "screenshot" | "artifact" | "report";
  readonly summary: string;
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
  readonly inputArtifacts?: readonly NssStudioArtifactRef[];
  readonly outputArtifacts?: readonly NssStudioArtifactRef[];
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
  readonly inputArtifacts?: readonly NssStudioArtifactRef[];
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

export interface NssStudioHandoff {
  readonly protocol: "nss.studio-handoff.v1";
  readonly id: string;
  readonly taskId: string;
  readonly from: NssStudioSpecialistId;
  readonly to: NssStudioSpecialistId;
  readonly goal: string;
  readonly acceptanceCriteria: readonly string[];
  readonly inputArtifacts: readonly NssStudioArtifactRef[];
}

export interface NssStudioExecutionResult {
  readonly taskId: string;
  readonly specialistId: NssStudioSpecialistId;
  readonly status: "completed" | "failed" | "blocked";
  readonly summary: string;
  readonly artifacts?: readonly NssStudioArtifactRef[];
  readonly evidence?: readonly NssStudioEvidence[];
}
