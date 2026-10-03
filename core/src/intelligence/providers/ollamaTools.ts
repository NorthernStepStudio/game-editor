import type {
  MatterhornModelDescriptor,
  MatterhornModelMessage,
  MatterhornModelProvider,
  MatterhornModelRequest,
  MatterhornModelResponse,
  MatterhornToolCall,
} from "../types.js";

export interface OllamaIntelligenceProviderOptions {
  readonly providerId?: string;
  readonly label?: string;
  readonly modelId: string;
  readonly baseUrl?: string;
  readonly roles: MatterhornModelDescriptor["roles"];
  readonly requestTimeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface OllamaChatPayload {
  readonly message?: {
    readonly role?: string;
    readonly content?: string;
    readonly tool_calls?: readonly {
      readonly type?: string;
      readonly function?: {
        readonly index?: number;
        readonly name?: string;
        readonly arguments?: unknown;
      };
    }[];
  };
  readonly done?: boolean;
  readonly prompt_eval_count?: number;
  readonly eval_count?: number;
  readonly error?: string;
}

export function createOllamaIntelligenceProvider(
  options: OllamaIntelligenceProviderOptions,
): MatterhornModelProvider {
  const providerId = options.providerId ?? "ollama";
  const label = options.label ?? "Ollama";
  const baseUrl = ensureTrailingSlash(
    options.baseUrl ?? "http://127.0.0.1:11434/",
  );
  assertLoopbackUrl(baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const model: MatterhornModelDescriptor = {
    providerId,
    modelId: options.modelId,
    label,
    roles: options.roles,
    capabilities: ["text", "tools", "reasoning"],
    local: true,
    requiresNetwork: false,
    externalCost: false,
  };

  return {
    id: providerId,
    models: [model],
    describe() {
      return `${label} local API using ${options.modelId}.`;
    },
    async invoke(
      modelId: string,
      request: MatterhornModelRequest,
    ): Promise<MatterhornModelResponse> {
      if (modelId !== options.modelId) {
        throw new Error(`Unknown Ollama model: ${modelId}`);
      }

      const response = await fetchImpl(new URL("api/chat", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: toOllamaMessages(request.messages),
          stream: false,
          ...(request.tools?.length
            ? {
                tools: request.tools.map((tool) => ({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  },
                })),
              }
            : {}),
          ...(request.temperature !== undefined ||
          request.maxOutputTokens !== undefined
            ? {
                options: {
                  ...(request.temperature !== undefined
                    ? { temperature: request.temperature }
                    : {}),
                  ...(request.maxOutputTokens !== undefined
                    ? { num_predict: request.maxOutputTokens }
                    : {}),
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(options.requestTimeoutMs ?? 300_000),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama request failed (${response.status}): ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as OllamaChatPayload;
      if (payload.error) {
        throw new Error(`Ollama error: ${payload.error}`);
      }

      return normalizeOllamaResponse(payload);
    },
  };
}

export function toOllamaMessages(
  messages: readonly MatterhornModelMessage[],
): readonly unknown[] {
  const output: unknown[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      if (!message.name) {
        throw new Error("Ollama tool result requires a tool name.");
      }
      output.push({
        role: "tool",
        tool_name: message.name,
        content: message.content,
      });
      continue;
    }

    if (message.role === "assistant") {
      output.push({
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call, index) => ({
                type: "function",
                function: {
                  index,
                  name: call.name,
                  arguments: call.args,
                },
              })),
            }
          : {}),
      });
      continue;
    }

    output.push({
      role: message.role,
      content: message.content,
    });
  }

  return output;
}

function normalizeOllamaResponse(
  payload: OllamaChatPayload,
): MatterhornModelResponse {
  const toolCalls: MatterhornToolCall[] = [];
  for (const [index, raw] of (
    payload.message?.tool_calls ?? []
  ).entries()) {
    const fn = raw.function;
    if (!fn?.name) {
      throw new Error("Ollama returned a tool call without a name.");
    }
    const args =
      fn.arguments &&
      typeof fn.arguments === "object" &&
      !Array.isArray(fn.arguments)
        ? (fn.arguments as Readonly<Record<string, unknown>>)
        : {};
    toolCalls.push({
      id: `ollama-${fn.index ?? index}`,
      name: fn.name,
      args,
    });
  }

  const inputTokens = payload.prompt_eval_count;
  const outputTokens = payload.eval_count;
  return {
    text: payload.message?.content?.trim() ?? "",
    toolCalls,
    finishReason: toolCalls.length
      ? "tool_calls"
      : payload.done
        ? "stop"
        : "unknown",
    ...(inputTokens !== undefined || outputTokens !== undefined
      ? {
          usage: {
            ...(inputTokens !== undefined ? { inputTokens } : {}),
            ...(outputTokens !== undefined ? { outputTokens } : {}),
            totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
          },
        }
      : {}),
  };
}

function assertLoopbackUrl(value: string): void {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    host !== "127.0.0.1" &&
    host !== "localhost" &&
    host !== "[::1]" &&
    host !== "::1"
  ) {
    throw new Error("Ollama intelligence provider must use loopback.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Ollama URL must use HTTP or HTTPS.");
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
