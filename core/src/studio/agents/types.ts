import type { NssStudioDomain, NssStudioSpecialistId } from "../types.js";

export type NssStudioAgentId =
  | "matterhorn"
  | "agent-foundry"
  | "flyrail"
  | "forge"
  | "canvas"
  | "motion"
  | "sentinel"
  | "repo-build";

export type NssStudioAgentKind = "orchestrator" | "factory" | "specialist" | "validator" | "delivery";
export type NssStudioAgentAvailability = "active" | "integration-pending" | "planned";

export interface NssStudioAgentSkill {
  readonly id: string;
  readonly domain: NssStudioDomain;
  readonly description: string;
}

export interface NssStudioAgentAdapterBinding {
  readonly adapterId: string;
  readonly specialistId?: NssStudioSpecialistId;
  readonly status: "bound" | "planned";
  readonly description: string;
}

export interface NssStudioAgentDefinition {
  readonly id: NssStudioAgentId;
  readonly title: string;
  readonly kind: NssStudioAgentKind;
  readonly role: string;
  readonly availability: NssStudioAgentAvailability;
  readonly skills: readonly NssStudioAgentSkill[];
  readonly adapters: readonly NssStudioAgentAdapterBinding[];
  readonly canCreateAgents: boolean;
  readonly canValidateOwnWork: boolean;
}

export interface NssStudioAgentRegistryValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
