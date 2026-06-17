import * as vscode from "vscode";

import { extractKeywords, searchCodebaseKeywords } from "../codebase/searchIndexingService.js";
import type { NssBuildFoundationReport } from "../../models/foundation.types.js";
import { analyzeWorkspaceCapabilityProfile } from "./workspaceCapabilityScanner.js";
import { createBuildPlan } from "./buildPlanService.js";
import { createBuildSpec } from "./buildSpecService.js";

export async function createBuildFoundationReport(input: {
  readonly goal: string;
  readonly workspaceFolder?: vscode.WorkspaceFolder;
}): Promise<NssBuildFoundationReport> {
  const profile = await analyzeWorkspaceCapabilityProfile(input.workspaceFolder);
  const spec = createBuildSpec(input.goal, profile);
  const plan = createBuildPlan(spec, profile);
  const relatedFiles = await searchCodebaseKeywords(
    extractKeywords([spec.goal, profile.summary, ...spec.focusAreas].join(" ")),
    6,
  );

  return {
    goal: input.goal,
    capabilityProfile: profile,
    buildSpec: spec,
    plan,
    relatedFiles,
    markdown: renderBuildFoundationMarkdown({
      goal: input.goal,
      profile,
      spec,
      plan,
      relatedFiles,
    }),
  };
}

function renderBuildFoundationMarkdown(input: {
  readonly goal: string;
  readonly profile: Awaited<ReturnType<typeof analyzeWorkspaceCapabilityProfile>>;
  readonly spec: ReturnType<typeof createBuildSpec>;
  readonly plan: ReturnType<typeof createBuildPlan>;
  readonly relatedFiles: readonly {
    readonly path: string;
    readonly content: string;
    readonly score: number;
  }[];
}): string {
  const lines = [
    "# Build Foundation",
    "",
    `Goal: ${input.goal}`,
    "",
    "## Capability Profile",
    `- Workspace: ${input.profile.workspaceName}`,
    `- Primary kind: ${input.profile.primaryKind}`,
    `- Packages: ${input.profile.packageCount}`,
    `- Frameworks: ${formatList(input.profile.frameworks)}`,
    `- Runtimes: ${formatList(input.profile.runtimes)}`,
    `- Databases: ${formatList(input.profile.databases)}`,
    `- Test tools: ${formatList(input.profile.testTools)}`,
    "",
    "## Build Spec",
    `- Scope: ${input.spec.scope}`,
    `- Target: ${input.spec.target}`,
    `- Focus areas: ${formatList(input.spec.focusAreas)}`,
    "- Acceptance criteria:",
    ...input.spec.acceptanceCriteria.map((criterion) => `  - ${criterion}`),
    "- Constraints:",
    ...input.spec.constraints.map((constraint) => `  - ${constraint}`),
    "",
    "## Template Suggestion",
    `- ${input.plan.template.title}`,
    `- ${input.plan.template.description}`,
    `- Rationale: ${input.plan.template.rationale}`,
    "",
    "## Plan",
    ...input.plan.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Dependency Impact",
    input.plan.impactedPackages.length > 0
      ? input.plan.impactedPackages.map((pkg) => `- ${pkg}`).join("\n")
      : "- No dependency impact identified from the current graph.",
    "",
    "## Validation",
    ...input.plan.validation.map((step) => `- ${step}`),
    "",
    "## Rollback Notes",
    ...input.plan.rollback.map((note) => `- ${note}`),
    "",
    "## Memory Candidates",
    ...input.plan.memoryCandidates.map((memory) => `- ${memory}`),
  ];

  if (input.relatedFiles.length > 0) {
    lines.push("", "## Related Files");
    lines.push(...input.relatedFiles.map((file) => `- ${file.path} (score ${file.score})`));
  }

  lines.push(
    "",
    "## Future Base",
    "- Spec-to-implementation orchestration can reuse this profile and plan.",
    "- Template selection can become a scaffold generator without changing the report contract.",
    "- Durable project knowledge can promote the memory candidates after user approval.",
  );

  return lines.join("\n");
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none detected";
}
