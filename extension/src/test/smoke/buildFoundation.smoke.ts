import { strict as assert } from "node:assert";

import { createBuildPlan } from "../../services/foundation/buildPlanService.js";
import { createBuildSpec } from "../../services/foundation/buildSpecService.js";
import { inferWorkspaceCapabilityProfile } from "../../services/foundation/workspaceCapabilityService.js";

export function runBuildFoundationSmoke(): void {
  const profile = inferWorkspaceCapabilityProfile({
    workspaceName: "Northern Step Studio",
    workspacePath: "D:\\dev\\Northern Step Studio",
    packageSnapshots: [
      {
        path: "apps/nstep-workspace-ai/package.json",
        name: "nss-workspace-ai",
        dependencies: ["hono", "@supabase/supabase-js", "react", "vitest"],
        scripts: ["build", "test"],
      },
    ],
    dependencyGraph: [
      {
        app: "apps/nstep-workspace-ai",
        dependencies: ["hono", "@supabase/supabase-js", "react"],
        internalLinks: ["packages/m-core"],
      },
    ],
  });

  const spec = createBuildSpec("Build a reusable settings panel for the workspace", profile);
  const plan = createBuildPlan(spec, profile);

  assert.equal(profile.primaryKind, "fullstack");
  assert(profile.summary.includes("Northern Step Studio"));
  assert.equal(spec.scope, "workspace");
  assert(plan.template.id === "fullstack-app" || plan.template.id === "api-service");
  assert(plan.steps.length >= 4);
  assert(plan.validation.some((entry) => entry.includes("vitest")));
}
