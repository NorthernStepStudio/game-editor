import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createOpenAIResponsesIntelligenceProvider,
  toResponsesInput,
} from "../intelligence/index.js";

describe("OpenAI Responses intelligence provider", () => {
  it("maps canonical tool turns into Responses input items", () => {
    const mapped = toResponsesInput([
      { role: "system", content: "You are Matterhorn." },
      { role: "user", content: "Read a.ts" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call-1", name: "read_file", args: { path: "a.ts" } },
        ],
      },
      {
        role: "tool",
        name: "read_file",
        toolCallId: "call-1",
        content: '{"ok":true,"output":{"content":"x"}}',
      },
    ]);

    assert.equal(mapped.instructions, "You are Matterhorn.");
    assert.deepEqual(mapped.input, [
      { role: "user", content: "Read a.ts" },
      {
        type: "function_call",
        call_id: "call-1",
        name: "read_file",
        arguments: '{"path":"a.ts"}',
      },
      {
        type: "function_call_output",
        call_id: "call-1",
        output: '{"ok":true,"output":{"content":"x"}}',
      },
    ]);
  });

  it("normalizes Responses function calls and usage", async () => {
    const requests: Array<{ url: string; body?: string; authorization?: string }> = [];
    const provider = createOpenAIResponsesIntelligenceProvider({
      providerId: "openai",
      label: "OpenAI",
      modelId: "test-model",
      baseUrl: "https://api.openai.test/v1/",
      apiKey: "secret",
      local: false,
      requiresNetwork: true,
      externalCost: true,
      roles: ["reasoning", "coding"],
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          body: typeof init?.body === "string" ? init.body : undefined,
          authorization:
            init?.headers && !Array.isArray(init.headers)
              ? (init.headers as Record<string, string>).Authorization
              : undefined,
        });
        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "function_call",
                call_id: "call-1",
                name: "read_file",
                arguments: '{"path":"a.ts"}',
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 3,
              total_tokens: 13,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const result = await provider.invoke("test-model", {
      messages: [
        { role: "system", content: "You are Matterhorn." },
        { role: "user", content: "Read a.ts" },
      ],
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
      ],
    });

    assert.equal(result.finishReason, "tool_calls");
    assert.deepEqual(result.toolCalls, [
      { id: "call-1", name: "read_file", args: { path: "a.ts" } },
    ]);
    assert.equal(result.usage?.totalTokens, 13);
    assert.equal(requests[0].authorization, "Bearer secret");
    assert.match(requests[0].url, /\/v1\/responses$/);

    const body = JSON.parse(requests[0].body ?? "{}");
    assert.equal(body.model, "test-model");
    assert.equal(body.instructions, "You are Matterhorn.");
    assert.equal(body.tools[0].name, "read_file");
  });

  it("normalizes text output", async () => {
    const provider = createOpenAIResponsesIntelligenceProvider({
      providerId: "openai",
      label: "OpenAI",
      modelId: "test-model",
      baseUrl: "https://api.openai.test/v1",
      apiKey: "secret",
      local: false,
      requiresNetwork: true,
      externalCost: true,
      roles: ["fast"],
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "Done." }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const result = await provider.invoke("test-model", {
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.equal(result.text, "Done.");
    assert.equal(result.finishReason, "stop");
  });

  it("requires HTTPS for cloud providers and loopback for local providers", () => {
    assert.throws(
      () =>
        createOpenAIResponsesIntelligenceProvider({
          providerId: "openai",
          label: "OpenAI",
          modelId: "test",
          baseUrl: "http://api.openai.test/v1",
          apiKey: "secret",
          local: false,
          requiresNetwork: true,
          externalCost: true,
          roles: ["coding"],
        }),
      /HTTPS/i,
    );

    assert.throws(
      () =>
        createOpenAIResponsesIntelligenceProvider({
          providerId: "lmstudio",
          label: "LM Studio",
          modelId: "test",
          baseUrl: "http://192.168.1.4:1234/v1",
          local: true,
          requiresNetwork: false,
          externalCost: false,
          roles: ["coding"],
        }),
      /loopback/i,
    );
  });

  it("never sends a cloud request without a server-side API key", async () => {
    const provider = createOpenAIResponsesIntelligenceProvider({
      providerId: "openai",
      label: "OpenAI",
      modelId: "test-model",
      baseUrl: "https://api.openai.test/v1",
      local: false,
      requiresNetwork: true,
      externalCost: true,
      roles: ["coding"],
      fetchImpl: async () => {
        throw new Error("fetch should not be called");
      },
    });

    await assert.rejects(
      () =>
        provider.invoke("test-model", {
          messages: [{ role: "user", content: "Hello" }],
        }),
      /API key/i,
    );
  });
});
