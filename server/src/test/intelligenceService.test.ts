import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type {
  MatterhornModelDescriptor,
  MatterhornModelProvider,
} from "../../../core/out/index.js";
import type { NssWorkspaceAiServerConfig } from "../config/env.js";
import {
  IntelligenceService,
} from "../services/intelligenceService.js";
import {
  createIntelligenceWorkspaceTools,
} from "../services/intelligenceWorkspaceTools.js";

const localModel: MatterhornModelDescriptor = {
  providerId: "fake-local",
  modelId: "fake-coder",
  label: "Fake local coder",
  roles: ["coding", "reasoning", "fast"],
  capabilities: ["text", "tools"],
  local: true,
  requiresNetwork: false,
  externalCost: false,
};

function config(): NssWorkspaceAiServerConfig {
  return {
    port: 0,
    mCore: {
      providerMode: "mock",
      requestTimeoutMs: 1_000,
    },
  };
}

describe("IntelligenceService", () => {
  it("runs a real model -> workspace tool -> model loop", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-"));
    try {
      await writeFile(
        join(root, "example.ts"),
        'export const answer = 42;\n',
        "utf8",
      );

      let invocations = 0;
      const provider: MatterhornModelProvider = {
        id: "fake-local",
        models: [localModel],
        describe: () => "fake",
        async invoke(_modelId, request) {
          invocations += 1;
          const toolResult = request.messages.find(
            (message) =>
              message.role === "tool" &&
              message.toolCallId === "read-1",
          );
          if (!toolResult) {
            return {
              text: "",
              toolCalls: [
                {
                  id: "read-1",
                  name: "read_file",
                  args: { path: "example.ts" },
                },
              ],
              finishReason: "tool_calls",
            };
          }
          assert.match(toolResult.content, /answer = 42/);
          return {
            text: "example.ts exports answer = 42.",
            toolCalls: [],
            finishReason: "stop",
          };
        },
      };

      const service = new IntelligenceService(
        [{ id: "demo", name: "Demo", path: root }],
        config(),
        { providers: [provider] },
      );

      const result = await service.run({
        projectId: "demo",
        prompt: "What does example.ts export?",
        role: "coding",
        providerId: "fake-local",
        modelId: "fake-coder",
      });

      assert.equal(result.status, "completed");
      assert.equal(result.providerId, "fake-local");
      assert.equal(result.modelId, "fake-coder");
      assert.equal(result.turns, 2);
      assert.equal(result.toolCalls, 1);
      assert.equal(result.text, "example.ts exports answer = 42.");
      assert.equal(invocations, 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not route to a cloud paid model without explicit policy permission", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-"));
    try {
      let called = false;
      const cloudProvider: MatterhornModelProvider = {
        id: "cloud",
        models: [
          {
            ...localModel,
            providerId: "cloud",
            modelId: "cloud-coder",
            label: "Cloud coder",
            local: false,
            requiresNetwork: true,
            externalCost: true,
          },
        ],
        describe: () => "cloud",
        async invoke() {
          called = true;
          return {
            text: "should not run",
            toolCalls: [],
            finishReason: "stop",
          };
        },
      };
      const service = new IntelligenceService(
        [{ id: "demo", name: "Demo", path: root }],
        config(),
        { providers: [cloudProvider] },
      );

      await assert.rejects(
        () =>
          service.run({
            projectId: "demo",
            prompt: "Inspect the project.",
            role: "coding",
            providerId: "cloud",
            modelId: "cloud-coder",
            allowNetwork: false,
            allowExternalCost: false,
          }),
        /No eligible model|network providers disabled|external-cost/i,
      );
      assert.equal(called, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("intelligence workspace tools", () => {
  it("exposes bounded read-only repository tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-"));
    try {
      await writeFile(join(root, "a.ts"), "const alpha = 1;\n", "utf8");
      await writeFile(join(root, "b.ts"), "const beta = alpha;\n", "utf8");

      const tools = createIntelligenceWorkspaceTools(
        [{ id: "demo", name: "Demo", path: root }],
        "demo",
      );
      assert.deepEqual(
        tools.tools.map((tool) => [tool.name, tool.risk]),
        [
          ["list_files", "read"],
          ["read_file", "read"],
          ["search_files", "read"],
        ],
      );

      const listing = await tools.execute({
        id: "list",
        name: "list_files",
        args: {},
      });
      assert.equal(listing.ok, true);
      assert.match(JSON.stringify(listing.output), /a\.ts/);

      const search = await tools.execute({
        id: "search",
        name: "search_files",
        args: { query: "alpha" },
      });
      assert.equal(search.ok, true);
      assert.match(JSON.stringify(search.output), /b\.ts/);

      const traversal = await tools.execute({
        id: "read",
        name: "read_file",
        args: { path: "../outside.txt" },
      });
      assert.equal(traversal.ok, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
