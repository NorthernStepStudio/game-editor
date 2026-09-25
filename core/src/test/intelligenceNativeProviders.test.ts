import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAnthropicIntelligenceProvider,
  createGeminiIntelligenceProvider,
  createOllamaIntelligenceProvider,
  toAnthropicMessages,
  toGeminiContents,
  toOllamaMessages,
} from "../intelligence/index.js";

const transcript = [
  { role: "system" as const, content: "You are Matterhorn." },
  { role: "user" as const, content: "Read a.ts" },
  {
    role: "assistant" as const,
    content: "",
    toolCalls: [
      { id: "call-1", name: "read_file", args: { path: "a.ts" } },
    ],
  },
  {
    role: "tool" as const,
    toolCallId: "call-1",
    name: "read_file",
    content: '{"ok":true,"output":{"content":"x"}}',
  },
];

describe("Anthropic intelligence provider", () => {
  it("maps assistant tool_use and immediate user tool_result blocks", () => {
    const mapped = toAnthropicMessages(transcript);
    assert.equal(mapped.system, "You are Matterhorn.");
    assert.deepEqual(mapped.messages, [
      { role: "user", content: "Read a.ts" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "read_file",
            input: { path: "a.ts" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call-1",
            content: '{"ok":true,"output":{"content":"x"}}',
          },
        ],
      },
    ]);
  });

  it("normalizes tool_use blocks from Messages API", async () => {
    let body: Record<string, unknown> | undefined;
    const provider = createAnthropicIntelligenceProvider({
      modelId: "claude-test",
      apiKey: "secret",
      roles: ["coding"],
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                id: "toolu_1",
                name: "read_file",
                input: { path: "a.ts" },
              },
            ],
            usage: { input_tokens: 7, output_tokens: 2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const result = await provider.invoke("claude-test", {
      messages: transcript.slice(0, 2),
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
          risk: "read",
        },
      ],
    });

    assert.equal(result.finishReason, "tool_calls");
    assert.deepEqual(result.toolCalls, [
      { id: "toolu_1", name: "read_file", args: { path: "a.ts" } },
    ]);
    assert.equal(result.usage?.totalTokens, 9);
    assert.equal(body?.model, "claude-test");
    const tools = body?.tools as Array<Record<string, unknown>>;
    assert.equal(tools[0].name, "read_file");
    assert.ok(tools[0].input_schema);
  });
});

describe("Gemini intelligence provider", () => {
  it("maps canonical tool calls and results into Gemini parts", () => {
    const mapped = toGeminiContents(transcript);
    assert.equal(mapped.systemInstruction, "You are Matterhorn.");
    assert.deepEqual(mapped.contents, [
      { role: "user", parts: [{ text: "Read a.ts" }] },
      {
        role: "model",
        parts: [
          {
            functionCall: {
              id: "call-1",
              name: "read_file",
              args: { path: "a.ts" },
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              id: "call-1",
              name: "read_file",
              response: {
                ok: true,
                output: { content: "x" },
              },
            },
          },
        ],
      },
    ]);
  });

  it("normalizes functionCall responses", async () => {
    const provider = createGeminiIntelligenceProvider({
      modelId: "gemini-test",
      apiKey: "secret",
      roles: ["coding"],
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      functionCall: {
                        id: "gem-1",
                        name: "read_file",
                        args: { path: "a.ts" },
                      },
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 5,
              candidatesTokenCount: 3,
              totalTokenCount: 8,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    const result = await provider.invoke("gemini-test", {
      messages: transcript.slice(0, 2),
    });
    assert.equal(result.finishReason, "tool_calls");
    assert.deepEqual(result.toolCalls, [
      { id: "gem-1", name: "read_file", args: { path: "a.ts" } },
    ]);
    assert.equal(result.usage?.totalTokens, 8);
  });
});

describe("Ollama intelligence provider", () => {
  it("maps tool calls/results into Ollama chat messages", () => {
    assert.deepEqual(toOllamaMessages(transcript), [
      { role: "system", content: "You are Matterhorn." },
      { role: "user", content: "Read a.ts" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            type: "function",
            function: {
              index: 0,
              name: "read_file",
              arguments: { path: "a.ts" },
            },
          },
        ],
      },
      {
        role: "tool",
        tool_name: "read_file",
        content: '{"ok":true,"output":{"content":"x"}}',
      },
    ]);
  });

  it("normalizes local Ollama tool calls", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const provider = createOllamaIntelligenceProvider({
      modelId: "qwen3",
      roles: ["coding"],
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        return new Response(
          JSON.stringify({
            done: true,
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  type: "function",
                  function: {
                    index: 0,
                    name: "read_file",
                    arguments: { path: "a.ts" },
                  },
                },
              ],
            },
            prompt_eval_count: 6,
            eval_count: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const result = await provider.invoke("qwen3", {
      messages: transcript.slice(0, 2),
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
          },
          risk: "read",
        },
      ],
    });

    assert.deepEqual(result.toolCalls, [
      { id: "ollama-0", name: "read_file", args: { path: "a.ts" } },
    ]);
    assert.equal(result.usage?.totalTokens, 8);
    assert.equal(requestBody?.model, "qwen3");
    assert.equal(requestBody?.stream, false);
  });

  it("rejects non-loopback Ollama endpoints", () => {
    assert.throws(
      () =>
        createOllamaIntelligenceProvider({
          modelId: "qwen3",
          baseUrl: "http://192.168.1.5:11434",
          roles: ["coding"],
        }),
      /loopback/i,
    );
  });
});
