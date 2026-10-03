import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { WorkspaceReviews } from "../workspace/reviews.js";

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
        {
          providers: [provider],
          dataDirectory: join(root, ".matterhorn-test"),
        },
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

  it("stages a model edit as a pending review without changing the source file", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-"));
    const dataDirectory = join(root, ".matterhorn-test");
    const projects = [{ id: "demo", name: "Demo", path: root }];
    const original = "export const answer = 42;\n";
    const proposed = "export const answer = 43;\n";
    try {
      await writeFile(join(root, "example.ts"), original, "utf8");

      const provider: MatterhornModelProvider = {
        id: "fake-local",
        models: [localModel],
        describe: () => "fake",
        async invoke(_modelId, request) {
          const read = request.messages.find(
            (message) =>
              message.role === "tool" &&
              message.toolCallId === "read-1",
          );
          if (!read) {
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

          const proposal = request.messages.find(
            (message) =>
              message.role === "tool" &&
              message.toolCallId === "proposal-1",
          );
          if (!proposal) {
            const parsed = JSON.parse(read.content) as {
              output: { version: string };
            };
            return {
              text: "",
              toolCalls: [
                {
                  id: "proposal-1",
                  name: "propose_file_edit",
                  args: {
                    path: "example.ts",
                    version: parsed.output.version,
                    content: proposed,
                  },
                },
              ],
              finishReason: "tool_calls",
            };
          }

          assert.match(proposal.content, /reviewId/);
          return {
            text: "I staged a review proposal; the file is not applied.",
            toolCalls: [],
            finishReason: "stop",
          };
        },
      };

      const service = new IntelligenceService(
        projects,
        config(),
        {
          providers: [provider],
          dataDirectory,
        },
      );
      const result = await service.run({
        projectId: "demo",
        prompt: "Change answer to 43.",
        role: "coding",
        providerId: "fake-local",
        modelId: "fake-coder",
      });

      assert.equal(result.status, "completed");
      assert.equal(result.toolCalls, 2);
      assert.match(result.text, /staged/i);
      assert.equal(await readFile(join(root, "example.ts"), "utf8"), original);

      const reviews = new WorkspaceReviews(projects, dataDirectory).list("demo");
      assert.equal(reviews.reviews.length, 1);
      assert.equal(reviews.reviews[0].status, "pending");
      assert.equal(reviews.reviews[0].path, "example.ts");
      assert.equal(reviews.reviews[0].after, proposed);
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
        {
          providers: [cloudProvider],
          dataDirectory: join(root, ".matterhorn-test"),
        },
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

describe("durable intelligence sessions", () => {
  it("persists and resumes multi-turn state across service restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-session-"));
    const dataDirectory = join(root, ".matterhorn-test");
    const projects = [{ id: "demo", name: "Demo", path: root }];
    try {
      const makeProvider = (): MatterhornModelProvider => ({
        id: "fake-local",
        models: [localModel],
        describe: () => "fake",
        async invoke(_modelId, request) {
          const users = request.messages.filter(
            (message) => message.role === "user",
          );
          return {
            text: `users=${users.length}; last=${users.at(-1)?.content ?? ""}`,
            toolCalls: [],
            finishReason: "stop",
            usage: {
              inputTokens: 2,
              outputTokens: 1,
              totalTokens: 3,
            },
          };
        },
      });

      const firstService = new IntelligenceService(
        projects,
        config(),
        {
          providers: [makeProvider()],
          dataDirectory,
        },
      );
      const first = await firstService.startSession({
        projectId: "demo",
        prompt: "First question",
        role: "coding",
        providerId: "fake-local",
        modelId: "fake-coder",
      });
      assert.equal(first.status, "completed");
      assert.match(first.text, /users=1/);

      const restarted = new IntelligenceService(
        projects,
        config(),
        {
          providers: [makeProvider()],
          dataDirectory,
        },
      );
      assert.equal(restarted.listSessions().length, 1);
      assert.equal(restarted.getSession(first.id).modelId, "fake-coder");

      const second = await restarted.continueSession(first.id, {
        prompt: "Second question",
      });
      assert.equal(second.status, "completed");
      assert.equal(second.providerId, "fake-local");
      assert.equal(second.modelId, "fake-coder");
      assert.match(second.text, /users=2/);
      assert.match(second.text, /Second question/);
      assert.equal(second.usage.totalTokens, 6);
      assert.ok(second.turns > first.turns);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not expose persisted tool transcript contents in public session metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "matterhorn-intelligence-session-"));
    const dataDirectory = join(root, ".matterhorn-test");
    try {
      await writeFile(
        join(root, "secret-name.ts"),
        "export const nonSecretSource = 'visible-to-project-owner';\n",
        "utf8",
      );
      const provider: MatterhornModelProvider = {
        id: "fake-local",
        models: [localModel],
        describe: () => "fake",
        async invoke(_modelId, request) {
          const result = request.messages.find(
            (message) => message.role === "tool",
          );
          if (!result) {
            return {
              text: "",
              toolCalls: [
                {
                  id: "read-1",
                  name: "read_file",
                  args: { path: "secret-name.ts" },
                },
              ],
              finishReason: "tool_calls",
            };
          }
          return {
            text: "Inspected the requested source file.",
            toolCalls: [],
            finishReason: "stop",
          };
        },
      };
      const service = new IntelligenceService(
        [{ id: "demo", name: "Demo", path: root }],
        config(),
        { providers: [provider], dataDirectory },
      );
      const session = await service.startSession({
        projectId: "demo",
        prompt: "Inspect the source file.",
        providerId: "fake-local",
        modelId: "fake-coder",
      });

      const publicJson = JSON.stringify(service.getSession(session.id));
      assert.doesNotMatch(publicJson, /visible-to-project-owner/);
      assert.doesNotMatch(publicJson, /secret-name\.ts/);
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
