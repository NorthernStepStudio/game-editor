import type {
  NssBuildPlan,
  NssBuildSpec,
  NssTemplateSuggestion,
  NssWorkspaceCapabilityProfile,
} from "../../models/foundation.types.js";

export function createBuildPlan(
  spec: NssBuildSpec,
  profile: NssWorkspaceCapabilityProfile,
): NssBuildPlan {
  const template = chooseTemplateSuggestion(spec, profile);
  const impactedPackages = profile.dependencyGraph
    .filter((entry) => entry.internalLinks.length > 0 || entry.dependencies.some((dependency) => spec.focusAreas.includes(dependency)))
    .map((entry) => entry.app);

  return {
    title: `Build Foundation: ${spec.goal}`,
    summary: buildPlanSummary(spec, profile, template),
    template,
    steps: buildPlanSteps(spec, profile, template),
    validation: buildValidationSteps(profile),
    rollback: buildRollbackNotes(profile),
    memoryCandidates: buildMemoryCandidates(profile),
    impactedPackages: impactedPackages.length > 0 ? impactedPackages : profile.dependencyGraph.map((entry) => entry.app),
  };
}

function chooseTemplateSuggestion(
  spec: NssBuildSpec,
  profile: NssWorkspaceCapabilityProfile,
): NssTemplateSuggestion {
  const goal = spec.goal.toLowerCase();

  if (spec.scope === "migration" || /(migration|schema|database|auth|rls)/.test(goal)) {
    return {
      id: "custom",
      title: "Migration Template",
      description: "Plan the schema, data flow, and rollout path before making any destructive change.",
      rationale: "The goal is data-layer or auth heavy, so the build should start with migration safety.",
    };
  }

  if (spec.scope === "package" || goal.includes("shared package")) {
    return {
      id: "shared-package",
      title: "Shared Package Template",
      description: "Create or extend a reusable package with clear exports and isolated dependencies.",
      rationale: "The requested work is meant to be reused across apps.",
    };
  }

  if (profile.primaryKind === "fullstack" || (profile.frameworks.includes("react") && profile.frameworks.includes("hono"))) {
    return {
      id: "fullstack-app",
      title: "Full-Stack App Template",
      description: "Structure backend, frontend, and shared contracts as distinct layers.",
      rationale: "The workspace already looks like a full-stack monorepo.",
    };
  }

  if (profile.primaryKind === "api" || profile.frameworks.includes("hono")) {
    return {
      id: "api-service",
      title: "API Service Template",
      description: "Start with routes, handlers, contracts, and test coverage for the API surface.",
      rationale: "The workspace is API-oriented.",
    };
  }

  if (profile.primaryKind === "web" || profile.frameworks.includes("react")) {
    return {
      id: "web-app",
      title: "Web App Template",
      description: "Use a component-first scaffold with state, layout, and routing boundaries.",
      rationale: "The workspace is UI-heavy.",
    };
  }

  if (profile.primaryKind === "worker" || profile.runtimes.includes("wrangler") || profile.runtimes.includes("cloudflare")) {
    return {
      id: "worker",
      title: "Worker Template",
      description: "Structure the app for edge/runtime deployment and explicit entrypoints.",
      rationale: "The workspace appears to run in a worker or edge environment.",
    };
  }

  return {
    id: "custom",
    title: "Custom Template",
    description: "Use the current workspace conventions and add the minimum new structure required.",
    rationale: "The workspace is not specific enough to force a template.",
  };
}

function buildPlanSummary(
  spec: NssBuildSpec,
  profile: NssWorkspaceCapabilityProfile,
  template: NssTemplateSuggestion,
): string {
  return [
    `Scope ${spec.scope} build for ${spec.target}.`,
    `Workspace primary kind: ${profile.primaryKind}.`,
    `Template choice: ${template.title}.`,
    `Focus areas: ${spec.focusAreas.length > 0 ? spec.focusAreas.join(", ") : "general implementation quality"}.`,
  ].join(" ");
}

function buildPlanSteps(
  spec: NssBuildSpec,
  profile: NssWorkspaceCapabilityProfile,
  template: NssTemplateSuggestion,
): string[] {
  const steps = [
    "Confirm the goal, target scope, and non-goals before editing.",
    "Map the affected packages, contracts, and likely dependency impact.",
    `Use the ${template.title.toLowerCase()} to scaffold or extend the implementation path.`,
    "Implement the smallest coherent slice and keep shared contracts stable.",
    "Add or update tests so the change can be verified locally.",
    "Review rollback notes and capture any durable project memory or preference.",
  ];

  if (spec.scope === "migration") {
    steps.splice(2, 0, "Draft the migration path and identify any destructive operations before writing code.");
  }

  if (profile.packageCount > 1) {
    steps.splice(1, 0, "Check cross-package ownership and confirm which apps will be touched.");
  }

  return steps;
}

function buildValidationSteps(profile: NssWorkspaceCapabilityProfile): string[] {
  const validation = ["Run the workspace compile step."];

  if (profile.testTools.length > 0) {
    validation.push(`Run the workspace test stack (${profile.testTools.join(", ")}).`);
  } else {
    validation.push("Run the narrowest relevant local validation command.");
  }

  validation.push("Re-open the affected files and review the change summary before merge.");
  return validation;
}

function buildRollbackNotes(profile: NssWorkspaceCapabilityProfile): string[] {
  const notes = [
    "Keep each stage reviewable so a failed step can be reverted without losing unrelated work.",
    "Prefer additive changes before removing old code paths.",
  ];

  if (profile.packageCount > 1) {
    notes.push("Commit shared contract changes separately from app-specific changes.");
  }

  return notes;
}

function buildMemoryCandidates(profile: NssWorkspaceCapabilityProfile): string[] {
  const memories = [
    `Workspace primary kind: ${profile.primaryKind}.`,
    ...profile.frameworks.map((framework) => `Prefer ${framework} patterns when scaffolding new work.`),
    ...profile.testTools.map((tool) => `Use ${tool} for local verification when possible.`),
  ];

  return [...new Set(memories)];
}
