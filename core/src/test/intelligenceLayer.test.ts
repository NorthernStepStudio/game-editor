import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MatterhornAgentRuntime,
  MatterhornModelGateway,
  type MatterhornModelDescriptor,
  type MatterhornModelProvider,
  type MatterhornModelResponse,
  type MatterhornToolExecutor,
} from "../intelligence/index.js";

function descriptor(
  providerId: string,
  modelId: string,
  overrides: Partial<MatterhornModelDescriptor> = {},
): MatterhornModelDescriptor {
  return {
    providerId,
    modelId,
    label: modelId,
    roles: ["reasoning", "coding", "fast"],
    capabilities: ["text", "tools"],
    local: false,
    requiresNetwork: true,
    externalCost: true,
    ...overrides,
  };
}

function provider(
  id: string,
  model: MatterhornModelDescriptor,
  responses: readonly MatterhornModelResponse[],
): MatterhornModelProvider {
  let index = 0;
  return {
    id,
    models: [model],
    describe: () => id,
    async invoke() {
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    },
  };
}

const readTools: MatterhornToolExecutor = {
  tools: [
    {
      name: "read_file",
      description: "Read a file",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      risk: "read",
    },
    {
      name: "stage_edit",
      description: "Stage an edit for review",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      risk: "write",
    },
  ],
  async execute(call) {
    return {
      callId: call.id,
      name: call.name,
      ok: true,
      output: { path: call.args.path, content: "example" },
    };
  },
};

describe("Matterhorn model gateway", () => {
  it("prefers an eligible local no-cost model", () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "cloud",
        descriptor("cloud", "cloud-1"),
        [{ text: "cloud", toolCalls: [], finishReason: "stop" }],
      ),
    );
    gateway.register(
      provider(
        "local",
        descriptor("local", "local-1", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [{ text: "local", toolCalls: [], finishReason: "stop" }],
      ),
    );

    const route = gateway.route(
      { role: "coding", requiredCapabilities: ["text", "tools"] },
      {
        preferLocal: true,
        allowNetwork: true,
        allowExternalCost: true,
        allowFallback: true,
      },
    );
    assert.equal(route.provider.id, "local");
    assert.equal(route.model.modelId, "local-1");
  });

  it("fails closed when only network/paid models are forbidden", () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "cloud",
        descriptor("cloud", "cloud-1"),
        [{ text: "cloud", toolCalls: [], finishReason: "stop" }],
      ),
    );

    assert.throws(
      () =>
        gateway.route(
          { role: "reasoning" },
          {
            preferLocal: true,
            allowNetwork: false,
            allowExternalCost: false,
            allowFallback: true,
          },
        ),
      /No eligible model/i,
    );
  });

  it("does not silently abandon an explicit model when fallback is disabled", () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "local-1", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [{ text: "local", toolCalls: [], finishReason: "stop" }],
      ),
    );

    assert.throws(
      () =>
        gateway.route(
          {
            role: "coding",
            preferredProviderId: "missing",
            preferredModelId: "missing-model",
          },
          {
            preferLocal: true,
            allowNetwork: false,
            allowExternalCost: false,
            allowFallback: false,
          },
        ),
      /No eligible model|Preferred/i,
    );
  });
});

describe("Matterhorn agent runtime", () => {
  it("executes read-only tools automatically and returns the final answer", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "call-1", name: "read_file", args: { path: "a.ts" } },
            ],
            finishReason: "tool_calls",
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
          },
          {
            text: "The file contains example.",
            toolCalls: [],
            finishReason: "stop",
            usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
          },
        ],
      ),
    );

    const runtime = new MatterhornAgentRuntime(gateway);
    const result = await runtime.run({
      route: { role: "coding", requiredCapabilities: ["text", "tools"] },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user", content: "Inspect a.ts" }],
      toolExecutor: readTools,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.text, "The file contains example.");
    assert.equal(result.state.toolCalls, 1);
    assert.equal(result.state.turns, 2);
    assert.equal(result.state.accumulatedUsage.totalTokens, 33);
    assert.equal(
      result.state.messages.some(
        (message) =>
          message.role === "tool" && message.toolCallId === "call-1",
      ),
      true,
    );
  });

  it("stops before a write-risk tool and resumes only after approval", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "write-1", name: "stage_edit", args: { path: "a.ts" } },
            ],
            finishReason: "tool_calls",
          },
          {
            text: "The proposed edit is staged for review.",
            toolCalls: [],
            finishReason: "stop",
          },
        ],
      ),
    );

    const runtime = new MatterhornAgentRuntime(gateway);
    const input = {
      route: { role: "coding" as const, requiredCapabilities: ["text", "tools"] as const },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user" as const, content: "Change a.ts" }],
      toolExecutor: readTools,
    };

    const first = await runtime.run(input);
    assert.equal(first.status, "approval_required");
    assert.equal(first.pendingApprovals?.[0].id, "write-1");
    assert.equal(
      first.state.messages.some((message) => message.role === "tool"),
      false,
    );

    const resumed = await runtime.resume(input, first.state, [
      { callId: "write-1", approved: true },
    ]);
    assert.equal(resumed.status, "completed");
    assert.match(resumed.text, /staged/i);
    assert.equal(
      resumed.state.messages.some(
        (message) =>
          message.role === "tool" && message.toolCallId === "write-1",
      ),
      true,
    );
  });

  it("records a denied approval and lets the model continue", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "write-1", name: "stage_edit", args: { path: "a.ts" } },
            ],
            finishReason: "tool_calls",
          },
          {
            text: "I did not change the file.",
            toolCalls: [],
            finishReason: "stop",
          },
        ],
      ),
    );
    const runtime = new MatterhornAgentRuntime(gateway);
    const input = {
      route: { role: "coding" as const },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user" as const, content: "Change a.ts" }],
      toolExecutor: readTools,
    };
    const first = await runtime.run(input);
    const resumed = await runtime.resume(input, first.state, [
      { callId: "write-1", approved: false },
    ]);
    assert.equal(resumed.status, "completed");
    assert.match(resumed.text, /did not change/i);
    assert.match(
      resumed.state.messages.find(
        (message) => message.toolCallId === "write-1",
      )?.content ?? "",
      /denied/i,
    );
  });

  it("blocks a tool explicitly disabled by policy", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "call-1", name: "read_file", args: { path: "a.ts" } },
            ],
            finishReason: "tool_calls",
          },
        ],
      ),
    );
    const runtime = new MatterhornAgentRuntime(gateway);
    const result = await runtime.run({
      route: { role: "coding" },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user", content: "Inspect a.ts" }],
      toolExecutor: readTools,
      toolPolicies: { read_file: { mode: "disabled" } },
    });
    assert.equal(result.status, "failed");
    assert.match(result.error ?? "", /disabled/i);
  });

  it("fails on unknown model-requested tools", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "call-1", name: "delete_everything", args: {} },
            ],
            finishReason: "tool_calls",
          },
        ],
      ),
    );
    const runtime = new MatterhornAgentRuntime(gateway);
    const result = await runtime.run({
      route: { role: "coding" },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user", content: "Do work" }],
      toolExecutor: readTools,
    });
    assert.equal(result.status, "failed");
    assert.match(result.error ?? "", /unknown tool/i);
  });

  it("stops repeated identical tool calls", async () => {
    const gateway = new MatterhornModelGateway();
    gateway.register(
      provider(
        "local",
        descriptor("local", "model", {
          local: true,
          requiresNetwork: false,
          externalCost: false,
        }),
        [
          {
            text: "",
            toolCalls: [
              { id: "call-1", name: "read_file", args: { path: "a.ts" } },
            ],
            finishReason: "tool_calls",
          },
        ],
      ),
    );
    const runtime = new MatterhornAgentRuntime(gateway);
    const result = await runtime.run({
      route: { role: "coding" },
      routingPolicy: {
        preferLocal: true,
        allowNetwork: false,
        allowExternalCost: false,
        allowFallback: true,
      },
      system: "You are Matterhorn.",
      messages: [{ role: "user", content: "Loop forever" }],
      toolExecutor: readTools,
      limits: { maxRepeatedToolCalls: 2, maxTurns: 10 },
    });
    assert.equal(result.status, "failed");
    assert.match(result.error ?? "", /Repeated tool-call guard/i);
  });
});
