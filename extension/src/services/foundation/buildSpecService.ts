import type { NssBuildScope, NssBuildSpec, NssWorkspaceCapabilityProfile } from "../../models/foundation.types.js";

export function createBuildSpec(goal: string, profile: NssWorkspaceCapabilityProfile): NssBuildSpec {
  const normalizedGoal = goal.trim();
  const focusAreas = extractFocusAreas(normalizedGoal, profile);
  const scope = inferScope(normalizedGoal, profile.primaryKind);
  const target = inferTarget(normalizedGoal, profile);

  return {
    goal: normalizedGoal,
    scope,
    target,
    focusAreas,
    acceptanceCriteria: buildAcceptanceCriteria(normalizedGoal, profile),
    constraints: buildConstraints(profile),
  };
}

function inferScope(goal: string, primaryKind: NssWorkspaceCapabilityProfile["primaryKind"]): NssBuildScope {
  const text = goal.toLowerCase();
  if (/(migration|schema|database|auth|rls)/.test(text)) {
    return "migration";
  }

  if (/(package|shared library|shared package)/.test(text)) {
    return "package";
  }

  if (/(workspace|monorepo|cross-app|multi-app)/.test(text)) {
    return "workspace";
  }

  if (/(app|application|site|frontend|backend)/.test(text)) {
    return "app";
  }

  if (primaryKind === "fullstack" || primaryKind === "api" || primaryKind === "web" || primaryKind === "worker") {
    return "app";
  }

  return "feature";
}

function inferTarget(goal: string, profile: NssWorkspaceCapabilityProfile): string {
  const text = goal.toLowerCase();
  if (text.includes("shared package") || text.includes("package")) {
    return "shared package";
  }

  if (text.includes("api") || text.includes("route") || text.includes("endpoint")) {
    return profile.primaryKind === "web" ? "backend service" : "api surface";
  }

  if (text.includes("ui") || text.includes("frontend") || text.includes("component")) {
    return "frontend application";
  }

  if (text.includes("migration") || text.includes("schema") || text.includes("database")) {
    return "data layer";
  }

  return profile.primaryKind === "unknown" ? "workspace" : profile.primaryKind;
}

function extractFocusAreas(goal: string, profile: NssWorkspaceCapabilityProfile): string[] {
  const tokens = new Set<string>();
  const normalized = goal.toLowerCase();
  const keywords = [
    "routing",
    "auth",
    "schema",
    "migration",
    "component",
    "state",
    "validation",
    "testing",
    "refactor",
    "scaffold",
    "template",
    "dependency",
    "api",
    "ui",
  ];

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      tokens.add(keyword);
    }
  }

  for (const framework of profile.frameworks) {
    tokens.add(framework);
  }

  return [...tokens];
}

function buildAcceptanceCriteria(goal: string, profile: NssWorkspaceCapabilityProfile): string[] {
  const criteria = [
    "The change is scoped to the intended app or package.",
    "The implementation compiles in the current workspace.",
    "Tests or validation steps are updated for any behavior change.",
  ];

  if (profile.testTools.length > 0) {
    criteria.push(`Use the workspace test stack (${profile.testTools.join(", ")}) to validate the change.`);
  }

  if (/(migration|schema|database|auth|rls)/i.test(goal)) {
    criteria.push("Any schema or auth change includes a migration or rollout note.");
  }

  return criteria;
}

function buildConstraints(profile: NssWorkspaceCapabilityProfile): string[] {
  const constraints = [
    "Prefer the smallest safe change that satisfies the goal.",
    "Keep shared contracts stable unless the change explicitly requires a break.",
    "Preserve existing workspace conventions and naming patterns.",
  ];

  if (profile.packageCount > 1) {
    constraints.push("Account for dependency impact across affected packages.");
  }

  return constraints;
}
