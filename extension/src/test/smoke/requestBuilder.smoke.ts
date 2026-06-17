import { strict as assert } from "node:assert";

import { buildAskRequest } from "../../api/requestBuilder.js";

export function runRequestBuilderSmoke(): void {
  const request = buildAskRequest({
    prompt: "Explain this helper",
    intent: "explain-file",
    workspaceName: "Northern Step Studio",
    workspacePath: "D:\\dev\\Northern Step Studio",
    preferredAgentId: "architect",
    build: {
      goal: "Add a reusable settings panel",
      scope: "workspace",
      target: "workspace",
      workspaceKind: "fullstack",
      frameworks: ["react"],
      runtimes: ["node"],
      databases: ["supabase"],
      testTools: ["vitest"],
      focusAreas: ["state", "testing"],
      template: {
        id: "fullstack-app",
        title: "Full-Stack App Template",
        description: "Structure backend, frontend, and shared contracts as distinct layers.",
        rationale: "The workspace is full-stack.",
      },
      steps: ["Inspect impacted packages"],
      validation: ["Run the workspace compile step."],
      rollback: ["Commit the shared contract separately."],
      relatedFiles: [
        {
          path: "apps/nstep-workspace-ai/src/extension.ts",
          score: 9,
        },
      ],
    },
    activeFile: {
      path: "apps/nstep-workspace-ai/src/extension.ts",
      languageId: "typescript",
      content: "export function test() {}",
      selection: "test",
    },
    project: {
      structureSummary: "- apps\n- docs",
    },
    codebaseSearchResults: [
      {
        path: "packages/m-core/src/agents/router.ts",
        content: "return stackExpertAgent;",
        score: 8,
      },
    ],
  });

  assert.equal(request.prompt, "Explain this helper");
  assert.equal(request.intent, "explain-file");
  assert.equal(request.workspace.name, "Northern Step Studio");
  assert.equal(request.preferredAgentId, "architect");
  assert.equal(request.build?.template.id, "fullstack-app");
  assert.equal(request.activeFile?.selection, "test");
  assert.equal(request.project?.structureSummary, "- apps\n- docs");
  assert.equal(request.codebase?.searchResults?.[0]?.path, "packages/m-core/src/agents/router.ts");
}
