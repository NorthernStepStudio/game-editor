import { strict as assert } from "node:assert";

import { resolveAgentForRequest } from "../agents/router.js";
import { createResponseOsRuntime } from "../core/runtime.js";
import type { NssAskRequestPayload } from "../core/types.js";

async function main(): Promise<void> {
  const request = createRequest();

  const mockRuntime = createResponseOsRuntime({
    providerMode: "mock",
    requestTimeoutMs: 30_000,
  });
  const mockResponse = await mockRuntime.run(request);
  assert.equal(mockResponse.title, "Explain extension.ts");
  assert(mockResponse.response.includes("Agent: NSS Stack Expert"));
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
