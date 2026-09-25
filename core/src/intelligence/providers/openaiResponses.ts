import type {
  MatterhornModelDescriptor,
  MatterhornModelMessage,
  MatterhornModelProvider,
  MatterhornModelRequest,
  MatterhornModelResponse,
  MatterhornToolCall,
} from "../types.js";

export interface OpenAIResponsesIntelligenceProviderOptions {
  readonly providerId: string;
  readonly label: string;
  readonly modelId: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly local: boolean;
  readonly requiresNetwork: boolean;
  readonly externalCost: boolean;
  readonly roles: MatterhornModelDescriptor["roles"];
  readonly requestTimeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface OpenAIResponsesPayload {
  readonly output?: readonly OpenAIResponseOutput[];
  readonly output_text?: string;
  readonly status?: string;
  readonly error?: {
    readonly message?: string;
  };
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly total_tokens?: number;
  };
}

type OpenAIResponseOutput =
  | {
      readonly type?: "message";
      readonly content?: readonly {
        readonly type?: string;
        readonly text?: string;
        readonly refusal?: string;
      }[];
    }
  | {
      readonly type?: "function_call";
      readonly id?: string;
      readonly call_id?: string;
      readonly name?: string;
      readonly arguments?: string;
    }
  | {
      readonly type?: string;
      readonly [key: string]: unknown;
    };

export function createOpenAIResponsesIntelligenceProvider(
  options: OpenAIResponsesIntelligenceProviderOptions,
): MatterhornModelProvider {
  const baseUrl = ensureTrailingSlash(options.baseUrl);
  validateBaseUrl(baseUrl, options.local);
  const fetchImpl = options.fetchImpl ?? fetch;
  const model: MatterhornModelDescriptor = {
    providerId: options.providerId,
    modelId: options.modelId,
    label: options.label,
    roles: options.roles,
    capabilities: [
      "text",
      "streaming",
      "tools",
      "structured_output",
      "reasoning",
    ],
    local: options.local,
    requiresNetwork: options.requiresNetwork,
    externalCost: options.externalCost,
  };

  return {
    id: options.providerId,
    models: [model],
    describe() {
      return `${options.label} via Responses API at ${baseUrl}`;
    },
    async invoke(
      modelId: string,
      request: MatterhornModelRequest,
    ): Promise<MatterhornModelResponse> {
      if (modelId !== options.modelId) {
        throw new Error(
          `Unknown model for ${options.providerId}: ${modelId}`,
        );
      }
      if (!options.local && !options.apiKey) {
        throw new Error(
          `${options.label} requires a server-side API key.`,
        );
      }

      const { instructions, input } = toResponsesInput(request.messages);
      const response = await fetchImpl(new URL("responses", baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.apiKey
            ? { Authorization: `Bearer ${options.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: modelId,
          ...(instructions ? { instructions } : {}),
          input,
          ...(request.tools?.length
            ? {
                tools: request.tools.map((tool) => ({
                  type: "function",
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema,
                })),
                tool_choice: "auto",
              }
            : {}),
          ...(request.maxOutputTokens !== undefined
            ? { max_output_tokens: request.maxOutputTokens }
            : {}),
        }),
        signal: AbortSignal.timeout(options.requestTimeoutMs ?? 300_000),
      });

      if (!response.ok) {
        throw new Error(
          `${options.label} Responses request failed (${response.status}): ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as OpenAIResponsesPayload;
      if (payload.error?.message) {
        throw new Error(
          `${options.label} Responses error: ${payload.error.message}`,
        );
      }

      return normalizeResponse(payload);
    },
  };
}

export function toResponsesInput(
  messages: readonly MatterhornModelMessage[],
): {
  readonly instructions?: string;
  readonly input: readonly unknown[];
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const input: unknown[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      if (!message.toolCallId) {
        throw new Error("Tool result message is missing toolCallId.");
      }
      input.push({
        type: "function_call_output",
        call_id: message.toolCallId,
        output: message.content,
      });
      continue;
    }

    if (message.content.trim()) {
      input.push({
        role: message.role,
        content: message.content,
      });
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      for (const call of message.toolCalls) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.args),
        });
      }
    }
  }

  return {
    ...(system ? { instructions: system } : {}),
    input,
  };
}

function normalizeResponse(
  payload: OpenAIResponsesPayload,
): MatterhornModelResponse {
  const textParts: string[] = [];
  const toolCalls: MatterhornToolCall[] = [];

  for (const item of payload.output ?? []) {
    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "output_text" && content.text) {
          textParts.push(content.text);
        } else if (content.type === "refusal" && content.refusal) {
          textParts.push(content.refusal);
        }
      }
      continue;
    }

    if (item.type === "function_call") {
      if (!item.name || !(item.call_id ?? item.id)) {
        throw new Error("Responses API returned an incomplete function call.");
      }
      let args: Readonly<Record<string, unknown>> = {};
      if (item.arguments?.trim()) {
        const parsed = JSON.parse(item.arguments) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(
            `Responses function call ${item.name} arguments were not an object.`,
          );
        }
        args = parsed as Readonly<Record<string, unknown>>;
      }
      toolCalls.push({
        id: item.call_id ?? item.id!,
        name: item.name,
        args,
      });
    }
  }

  const text =
    textParts.join("").trim() || payload.output_text?.trim() || "";

  return {
    text,
    toolCalls,
    finishReason: toolCalls.length
      ? "tool_calls"
      : payload.status === "incomplete"
        ? "length"
        : "stop",
    ...(payload.usage
      ? {
          usage: {
            ...(payload.usage.input_tokens !== undefined
              ? { inputTokens: payload.usage.input_tokens }
              : {}),
            ...(payload.usage.output_tokens !== undefined
              ? { outputTokens: payload.usage.output_tokens }
              : {}),
            ...(payload.usage.total_tokens !== undefined
              ? { totalTokens: payload.usage.total_tokens }
              : {}),
          },
        }
      : {}),
  };
}

function validateBaseUrl(value: string, local: boolean): void {
  const url = new URL(value);
  if (local) {
    const host = url.hostname.toLowerCase();
    if (
      host !== "127.0.0.1" &&
      host !== "localhost" &&
      host !== "[::1]" &&
      host !== "::1"
    ) {
      throw new Error(
        "Local Responses providers must use a loopback base URL.",
      );
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(
        "Local Responses provider URL must use HTTP or HTTPS.",
      );
    }
    return;
  }

  if (url.protocol !== "https:") {
    throw new Error("Cloud Responses provider URL must use HTTPS.");
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
