import type {
  MatterhornModelDescriptor,
  MatterhornModelMessage,
  MatterhornModelProvider,
  MatterhornModelRequest,
  MatterhornModelResponse,
  MatterhornToolCall,
} from "../types.js";

export interface AnthropicIntelligenceProviderOptions {
  readonly providerId?: string;
  readonly label?: string;
  readonly modelId: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly roles: MatterhornModelDescriptor["roles"];
  readonly requestTimeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface AnthropicPayload {
  readonly content?: readonly AnthropicContentBlock[];
  readonly stop_reason?: string;
  readonly error?: { readonly message?: string };
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
  };
}

type AnthropicContentBlock =
  | { readonly type?: "text"; readonly text?: string }
  | {
      readonly type?: "tool_use";
      readonly id?: string;
      readonly name?: string;
      readonly input?: unknown;
    }
  | { readonly type?: string; readonly [key: string]: unknown };

export function createAnthropicIntelligenceProvider(
  options: AnthropicIntelligenceProviderOptions,
): MatterhornModelProvider {
  const providerId = options.providerId ?? "anthropic";
  const label = options.label ?? "Anthropic";
  const baseUrl = ensureTrailingSlash(
    options.baseUrl ?? "https://api.anthropic.com/v1/",
  );
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("Anthropic provider URL must use HTTPS.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const model: MatterhornModelDescriptor = {
    providerId,
    modelId: options.modelId,
    label,
    roles: options.roles,
    capabilities: ["text", "tools", "structured_output", "reasoning"],
    local: false,
    requiresNetwork: true,
    externalCost: true,
  };

  return {
    id: providerId,
    models: [model],
    describe() {
      return `${label} Messages API using ${options.modelId}.`;
    },
    async invoke(
      modelId: string,
      request: MatterhornModelRequest,
    ): Promise<MatterhornModelResponse> {
      if (modelId !== options.modelId) {
        throw new Error(`Unknown Anthropic model: ${modelId}`);
      }
      if (!options.apiKey) {
        throw new Error(
          "Anthropic intelligence provider requires a server-side API key.",
        );
      }

      const { system, messages } = toAnthropicMessages(request.messages);
      const response = await fetchImpl(new URL("messages", baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId,
          ...(system ? { system } : {}),
          messages,
          max_tokens: request.maxOutputTokens ?? 4096,
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          ...(request.tools?.length
            ? {
                tools: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  input_schema: tool.inputSchema,
                })),
              }
            : {}),
        }),
        signal: AbortSignal.timeout(options.requestTimeoutMs ?? 300_000),
      });

      if (!response.ok) {
        throw new Error(
          `Anthropic request failed (${response.status}): ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as AnthropicPayload;
      if (payload.error?.message) {
        throw new Error(`Anthropic error: ${payload.error.message}`);
      }
      return normalizeAnthropicResponse(payload);
    },
  };
}

export function toAnthropicMessages(
  messages: readonly MatterhornModelMessage[],
): {
  readonly system?: string;
  readonly messages: readonly unknown[];
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const output: unknown[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "system") continue;

    if (message.role === "tool") {
      const blocks: unknown[] = [];
      let cursor = index;
      while (cursor < messages.length && messages[cursor].role === "tool") {
        const toolMessage = messages[cursor];
        if (!toolMessage.toolCallId) {
          throw new Error(
            "Anthropic tool result is missing toolCallId.",
          );
        }
        blocks.push({
          type: "tool_result",
          tool_use_id: toolMessage.toolCallId,
          content: toolMessage.content,
          ...(toolResultIsError(toolMessage.content)
            ? { is_error: true }
            : {}),
        });
        cursor += 1;
      }
      output.push({ role: "user", content: blocks });
      index = cursor - 1;
      continue;
    }

    if (message.role === "assistant") {
      const blocks: unknown[] = [];
      if (message.content.trim()) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.args,
        });
      }
      output.push({ role: "assistant", content: blocks });
      continue;
    }

    output.push({ role: "user", content: message.content });
  }

  return {
    ...(system ? { system } : {}),
    messages: output,
  };
}

function normalizeAnthropicResponse(
  payload: AnthropicPayload,
): MatterhornModelResponse {
  const text: string[] = [];
  const toolCalls: MatterhornToolCall[] = [];

  for (const block of payload.content ?? []) {
    if (block.type === "text" && block.text) {
      text.push(block.text);
      continue;
    }
    if (block.type === "tool_use") {
      if (!block.id || !block.name) {
        throw new Error("Anthropic returned an incomplete tool_use block.");
      }
      const input =
        block.input &&
        typeof block.input === "object" &&
        !Array.isArray(block.input)
          ? (block.input as Readonly<Record<string, unknown>>)
          : {};
      toolCalls.push({
        id: block.id,
        name: block.name,
        args: input,
      });
    }
  }

  const inputTokens = payload.usage?.input_tokens;
  const outputTokens = payload.usage?.output_tokens;
  return {
    text: text.join("").trim(),
    toolCalls,
    finishReason:
      payload.stop_reason === "tool_use"
        ? "tool_calls"
        : payload.stop_reason === "max_tokens"
          ? "length"
          : payload.stop_reason
            ? "stop"
            : "unknown",
    ...(payload.usage
      ? {
          usage: {
            ...(inputTokens !== undefined
              ? { inputTokens }
              : {}),
            ...(outputTokens !== undefined
              ? { outputTokens }
              : {}),
            ...(inputTokens !== undefined || outputTokens !== undefined
              ? {
                  totalTokens:
                    (inputTokens ?? 0) + (outputTokens ?? 0),
                }
              : {}),
          },
        }
      : {}),
  };
}

function toolResultIsError(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as unknown;
    return Boolean(
      parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        (parsed as Record<string, unknown>).ok === false,
    );
  } catch {
    return false;
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
