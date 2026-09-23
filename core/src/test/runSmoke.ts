import { strict as assert } from "node:assert";

import { resolveAgentForRequest } from "../agents/router.js";
import { createResponseOsRuntime } from "../core/runtime.js";
import type { NssAskRequestPayload } from "../core/types.js";
import { createStudioHandoff, createStudioPlan, validateStudioPlan } from "../studio/orchestrator.js";
import { listStudioSpecialists } from "../studio/specialistRegistry.js";

async function main(): Promise<void> {
  const request = createRequest();

  const mockRuntime = createResponseOsRuntime({
    providerMode: "mock",
    requestTimeoutMs: 30_000,
  });
  const mockResponse = await mockRuntime.run(request);
  assert.equal(mockResponse.title, "Explain extension.ts");
  assert(mockResponse.response.includes("Agent: Matterhorn"));
  assert(mockResponse.response.includes("Active file:"));
  assert(mockResponse.response.includes("Build foundation:"));

  const offRuntime = createResponseOsRuntime({
    providerMode: "off",
    requestTimeoutMs: 30_000,
  });
  const offResponse = await offRuntime.run(request);
  assert(offResponse.response.includes("M-CORE is currently off."));

  const workspaceOpsAgent = resolveAgentForRequest({
    ...request,
    mode: "product",
  });
  assert.equal(workspaceOpsAgent.id, "workspace-ops");

  const preferredAgent = resolveAgentForRequest({
    ...request,
    mode: "product",
    preferredAgentId: "architect",
  });
  assert.equal(preferredAgent.id, "architect");

  const stackByDependencies = resolveAgentForRequest({
    ...request,
    codebase: {
      dependencies: [
        {
          app: "apps/nss-workspace-ai",
          dependencies: ["hono", "@supabase/supabase-js", "react"],
          internalLinks: [],
        },
      ],
    },
  });
  assert.equal(stackByDependencies.id, "stack-expert");

  const stackByContent = resolveAgentForRequest({
    ...request,
    activeFile: {
      ...request.activeFile!,
      content: [
        'import { Hono } from "hono";',
        'import { createClient } from "@supabase/supabase-js";',
        "export function renderApp() {",
        "  return <App />;",
        "}",
      ].join("\n"),
    },
  });
  assert.equal(stackByContent.id, "stack-expert");

  const specialists = listStudioSpecialists();
  assert.equal(specialists.find((specialist) => specialist.id === "matterhorn")?.availability, "available");
  assert.equal(specialists.find((specialist) => specialist.id === "flyrail")?.availability, "available");
  assert.equal(specialists.find((specialist) => specialist.id === "blender-engine")?.availability, "available");

  const studioPlan = createStudioPlan({
    id: "castle-pipeline",
    goal: "Create a castle asset in Blender and integrate it into a Godot game.",
    tasks: [
      {
        id: "create-castle",
        title: "Create castle asset",
        goal: "Create and validate the castle in Blender.",
        domain: "blender",
        acceptanceCriteria: ["A validated game-ready asset is exported."],
      },
      {
        id: "integrate-castle",
        title: "Integrate castle",
        goal: "Import the asset into Godot and validate it in-game.",
        domain: "godot",
        dependsOn: ["create-castle"],
        acceptanceCriteria: ["The asset loads in Godot and passes the project validation checks."],
      },
    ],
    finalAcceptanceCriteria: ["The castle is usable in the target Godot project."],
  });

  assert.equal(studioPlan.tasks[0]?.specialistId, "blender-engine");
  assert.equal(studioPlan.tasks[1]?.specialistId, "flyrail");

  const validation = validateStudioPlan(studioPlan);
  assert.equal(validation.valid, true);
  assert.equal(validation.warnings.length, 0);

  const handoff = createStudioHandoff(studioPlan.tasks[0]!);
  assert.equal(handoff.protocol, "nss.studio-handoff.v1");
  assert.equal(handoff.from, "matterhorn");
  assert.equal(handoff.to, "blender-engine");

  assert.throws(
    () =>
      createStudioPlan({
        goal: "Create an audio cue.",
        tasks: [
          {
            id: "audio-cue",
            title: "Create audio cue",
            goal: "Create a new audio cue.",
            domain: "audio",
            acceptanceCriteria: ["The cue is ready for integration."],
          },
        ],
      }),
    /No default studio specialist is registered for the audio domain yet/,
  );

  assert.throws(
    () =>
      createStudioPlan({
        goal: "Empty plan",
        tasks: [],
      }),
    /Plan must contain at least one task/,
  );
}

function createRequest(): NssAskRequestPayload {
  return {
    prompt: "Explain this file clearly.",
    intent: "explain-file",
    workspace: {
      name: "Northern Step Studio",
      rootPath: "D:\\dev\\Northern Step Studio",
    },
    activeFile: {
      path: "apps/nss-workspace-ai/src/extension.ts",
      languageId: "typescript",
      content: "import * as vscode from 'vscode';\nexport function run() {}\n",
    },
    build: {
      goal: "Add a reusable settings panel",
      scope: "workspace",
      target: "workspace",
      workspaceKind: "fullstack",
      frameworks: ["react", "hono"],
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
      steps: ["Inspect impacted packages", "Implement the change"],
      validation: ["Run the workspace compile step."],
      rollback: ["Commit the shared contract separately."],
      relatedFiles: [
        {
          path: "apps/nss-workspace-ai/src/extension.ts",
          score: 9,
        },
      ],
    },
  };
}

void main();
