import type { NssStudioSpecialistId } from "../types.js";
import type { NssStudioAgentDefinition, NssStudioAgentId, NssStudioAgentRegistryValidation } from "./types.js";

export const STUDIO_AGENTS: readonly NssStudioAgentDefinition[] = [
  {
    id: "matterhorn", title: "Matterhorn", kind: "orchestrator",
    role: "Top-level studio brain for intent, planning, routing, budgets, handoffs, retries, and final completion decisions.",
    availability: "active", canCreateAgents: false, canValidateOwnWork: false, adapters: [],
    skills: [
      { id: "studio.plan", domain: "orchestration", description: "Turn a user goal into specialist-owned tasks, dependencies, and acceptance criteria." },
      { id: "studio.coordinate", domain: "orchestration", description: "Route work across specialists and coordinate retries, budgets, evidence, and handoffs." },
      { id: "studio.acceptance", domain: "qa", description: "Make the final completion decision from Sentinel and specialist evidence." },
    ],
  },
  {
    id: "agent-foundry", title: "Agent Foundry", kind: "factory",
    role: "Control-plane factory for defining, validating, benchmarking, and registering new specialist agents.",
    availability: "active", canCreateAgents: true, canValidateOwnWork: false, adapters: [],
    skills: [
      { id: "agents.blueprint", domain: "orchestration", description: "Create normalized inert blueprints for future agents." },
      { id: "agents.validate", domain: "qa", description: "Validate boundaries, tools, adapter needs, and activation criteria." },
    ],
  },
  {
    id: "flyrail", title: "Flyrail", kind: "specialist",
    role: "Godot specialist for implementation, editor/runtime control, instrumentation, debugging, playtesting, and engine export.",
    availability: "active", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "flyrail.godot", specialistId: "flyrail", status: "bound", description: "Flyrail daemon and Godot execution bridge." }],
    skills: [
      { id: "godot.project", domain: "godot", description: "Create and modify Godot scenes, scripts, resources, gameplay, UI, and levels." },
      { id: "godot.runtime", domain: "godot", description: "Run projects, drive input, inspect runtime state, and execute bounded repair loops." },
      { id: "godot.evidence", domain: "qa", description: "Produce Godot test, playtest, screenshot, runtime, and criterion evidence." },
      { id: "godot.export", domain: "release", description: "Produce Godot engine exports and export evidence." },
    ],
  },
  {
    id: "forge", title: "Forge", kind: "specialist",
    role: "Blender/3D specialist for modeling, cleanup, retopology, UVs, materials, rigging, animation authoring, optimization, collision, and export.",
    availability: "active", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "blender", specialistId: "blender-engine", status: "bound", description: "Current Blender execution adapter." }],
    skills: [
      { id: "blender.create", domain: "blender", description: "Create and refine Blender scenes, meshes, materials, lighting, rigs, and procedural content." },
      { id: "blender.asset", domain: "art", description: "Prepare production 3D assets for engine handoff." },
      { id: "blender.evidence", domain: "qa", description: "Produce render, geometry, rig, material, and export evidence." },
    ],
  },
  {
    id: "canvas", title: "Canvas", kind: "specialist",
    role: "2D art and UI-asset specialist for concepts, sprites, textures, icons, style references, and interface assets.",
    availability: "planned", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "visual-generation", status: "planned", description: "Provider-neutral image and 2D generation adapter." }],
    skills: [{ id: "art.generate", domain: "art", description: "Generate and refine 2D game art, concepts, sprites, textures, icons, and UI assets." }],
  },
  {
    id: "motion", title: "Motion", kind: "specialist",
    role: "Animation specialist for 2D/3D motion, state-driven animation requirements, retargeting, and procedural motion.",
    availability: "planned", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "animation", status: "planned", description: "Animation tooling/provider adapter." }],
    skills: [{ id: "animation.author", domain: "art", description: "Author or refine animation assets and motion specifications." }],
  },
  {
    id: "sentinel", title: "Sentinel", kind: "validator",
    role: "Independent validator that evaluates deterministic criterion evidence and visual/regression evidence without building the work it judges.",
    availability: "active", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "sentinel.evidence", status: "bound", description: "Matterhorn fail-closed evidence validator used independently from builder specialists." }],
    skills: [
      { id: "qa.criteria", domain: "qa", description: "Evaluate criterion-specific deterministic evidence independently from the builder." },
      { id: "qa.visual", domain: "qa", description: "Evaluate screenshots/renders when visual evidence is supplied." },
      { id: "qa.regression", domain: "qa", description: "Detect regressions across repair passes and enforce stop/escalation rules." },
    ],
  },
  {
    id: "repo-build", title: "Repo / Build", kind: "delivery",
    role: "Repository, CI, packaging, and release-delivery specialist separated from engine implementation.",
    availability: "planned", canCreateAgents: false, canValidateOwnWork: false,
    adapters: [{ adapterId: "repository-delivery", status: "planned", description: "Git/GitHub, CI, packaging, and release integration." }],
    skills: [
      { id: "repo.change", domain: "software", description: "Own branch, commit, pull-request, and repository delivery operations." },
      { id: "build.release", domain: "release", description: "Coordinate CI, packaging, release artifacts, and delivery evidence." },
    ],
  },
];

const EXECUTION_SPECIALIST_TO_AGENT: Readonly<Record<NssStudioSpecialistId, NssStudioAgentId>> = {
  matterhorn: "matterhorn", flyrail: "flyrail", "blender-engine": "forge",
};

export function listStudioAgents(): readonly NssStudioAgentDefinition[] { return STUDIO_AGENTS; }
export function getStudioAgent(id: NssStudioAgentId): NssStudioAgentDefinition {
  const agent = STUDIO_AGENTS.find(entry => entry.id === id);
  if (!agent) throw new Error(`Unknown studio agent: ${id}`);
  return agent;
}
export function resolveStudioAgentForExecutionSpecialist(specialistId: NssStudioSpecialistId): NssStudioAgentId {
  return EXECUTION_SPECIALIST_TO_AGENT[specialistId];
}
export function resolveExecutionSpecialistForStudioAgent(agentId: NssStudioAgentId): NssStudioSpecialistId | undefined {
  return getStudioAgent(agentId).adapters.find(adapter => adapter.status === "bound" && adapter.specialistId)?.specialistId;
}
export function validateStudioAgentRegistry(agents: readonly NssStudioAgentDefinition[] = STUDIO_AGENTS): NssStudioAgentRegistryValidation {
  const errors: string[] = [];
  const ids = new Set<string>(); const skills = new Set<string>();
  for (const agent of agents) {
    if (ids.has(agent.id)) errors.push(`Duplicate agent id: ${agent.id}.`); ids.add(agent.id);
    if (!agent.role.trim()) errors.push(`Agent ${agent.id} must define a role.`);
    if (!agent.skills.length) errors.push(`Agent ${agent.id} must own at least one skill.`);
    for (const skill of agent.skills) {
      if (!skill.id.trim()) errors.push(`Agent ${agent.id} has a blank skill id.`);
      else if (skills.has(skill.id)) errors.push(`Duplicate studio skill id: ${skill.id}.`);
      else skills.add(skill.id);
      if (!skill.description.trim()) errors.push(`Skill ${skill.id || "<blank>"} must define a description.`);
    }
    if (agent.canCreateAgents && agent.kind !== "factory") errors.push(`Only factory agents may create agents; ${agent.id} is ${agent.kind}.`);
    if (agent.kind === "validator" && agent.canValidateOwnWork) errors.push(`Validator ${agent.id} cannot validate its own work.`);
    if (agent.availability === "active" && agent.kind === "specialist" && !agent.adapters.some(adapter => adapter.status === "bound")) {
      errors.push(`Active specialist ${agent.id} requires at least one bound adapter.`);
    }
  }
  const orchestrators = agents.filter(agent => agent.kind === "orchestrator");
  if (orchestrators.length !== 1) errors.push(`Studio agent registry must contain exactly one orchestrator; found ${orchestrators.length}.`);
  const factories = agents.filter(agent => agent.kind === "factory");
  if (factories.length !== 1) errors.push(`Studio agent registry must contain exactly one agent factory; found ${factories.length}.`);
  else if (!factories[0].canCreateAgents) errors.push("The agent factory must be allowed to create agent blueprints.");
  return { valid: errors.length === 0, errors };
}
