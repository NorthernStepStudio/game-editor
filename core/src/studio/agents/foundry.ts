import type { NssStudioDomain } from "../types.js";
import { listStudioAgents } from "./registry.js";

export type NssStudioBlueprintKind = "specialist" | "validator" | "delivery";
export interface NssStudioAgentBlueprintSkillInput { readonly id: string; readonly domain: NssStudioDomain; readonly description: string; }
export interface NssStudioAgentBlueprintInput {
  readonly id: string; readonly title: string; readonly kind: NssStudioBlueprintKind; readonly role: string;
  readonly skills: readonly NssStudioAgentBlueprintSkillInput[]; readonly adapterRequirements?: readonly string[];
  readonly acceptanceCriteria: readonly string[];
}
export interface NssStudioAgentBlueprint extends Omit<NssStudioAgentBlueprintInput, "adapterRequirements"> {
  readonly adapterRequirements: readonly string[]; readonly createdBy: "agent-foundry"; readonly status: "draft";
  readonly canCreateAgents: false; readonly canValidateOwnWork: false;
}
export function createStudioAgentBlueprint(input: NssStudioAgentBlueprintInput): NssStudioAgentBlueprint {
  const blueprint: NssStudioAgentBlueprint = {
    id: input.id.trim().toLowerCase(), title: input.title.trim(), kind: input.kind, role: input.role.trim(),
    skills: input.skills.map(skill => ({ id: skill.id.trim(), domain: skill.domain, description: skill.description.trim() })),
    adapterRequirements: (input.adapterRequirements ?? []).map(x => x.trim()),
    acceptanceCriteria: input.acceptanceCriteria.map(x => x.trim()),
    createdBy: "agent-foundry", status: "draft", canCreateAgents: false, canValidateOwnWork: false,
  };
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(blueprint.id)) errors.push("Agent blueprint id must be lowercase kebab-case and start with a letter.");
  if (listStudioAgents().some(agent => agent.id === blueprint.id)) errors.push(`Agent blueprint id ${blueprint.id} collides with a registered studio agent.`);
  if (!blueprint.title || !blueprint.role || !blueprint.skills.length || !blueprint.acceptanceCriteria.length) errors.push("Agent blueprint requires title, role, skills, and activation acceptance criteria.");
  if (blueprint.skills.some(skill => !skill.id || !skill.description) || blueprint.acceptanceCriteria.some(x => !x) || blueprint.adapterRequirements.some(x => !x)) errors.push("Agent blueprint fields cannot contain blank entries.");
  if (errors.length) throw new Error(`Invalid agent blueprint: ${errors.join(" ")}`);
  return blueprint;
}
