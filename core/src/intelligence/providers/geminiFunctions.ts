import type {
  MatterhornModelDescriptor,
  MatterhornModelMessage,
  MatterhornModelProvider,
  MatterhornModelRequest,
  MatterhornModelResponse,
  MatterhornToolCall,
} from "../types.js";

export interface GeminiIntelligenceProviderOptions {
  readonly providerId?: string;
  readonly label?: string;
  readonly modelId: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly roles: MatterhornModelDescriptor["roles"];
  readonly requestTimeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface GeminiPayload {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly GeminiPart[];
    };
    readonly finishReason?: string;
  }[];
  readonly promptFeedback?: { readonly blockReason?: string };
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly totalTokenCount?: number;
  };
  readonly error?: { readonly message?: string };
}

type GeminiPart =
  | { readonly text?: string }
  | {
      readonly functionCall?: {
        readonly id?: string;
        readonly name?: string;
        readonly args?: unknown;
      };
    }
  | {
      readonly functionResponse?: {
        readonly id?: string;
        readonly name?: string;
        readonly response?: unknown;
      };
    };

export function createGeminiIntelligenceProvider(
  options: GeminiIntelligenceProviderOptions,
): MatterhornModelProvider {
  const providerId = options.providerId ?? "gemini";
  const label = options.label ?? "Gemini";
  const baseUrl = ensureTrailingSlash(
    options.baseUrl ?? "https://generativelanguage.googleapis.com/v1/",
  );
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("Gemini provider URL must use HTTPS.");
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
      return `${label} generateContent API using ${options.modelId}.`;
    },
    async invoke(
      modelId: string,
      request: MatterhornModelRequest,
    ): Promise<MatterhornModelResponse> {
      if (modelId !== options.modelId) {
        throw new Error(`Unknown Gemini model: ${modelId}`);
      }
      if (!options.apiKey) {
        throw new Error(
          "Gemini intelligence provider requires a server-side API key.",
        );
      }

      const { systemInstruction, contents } = toGeminiContents(
        request.messages,
      );
      const response = await fetchImpl(
        new URL(`models/${encodeURIComponent(modelId)}:generateContent`, baseUrl),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": options.apiKey,
          },
          body: JSON.stringify({
            ...(systemInstruction
              ? {
                  system_instruction: {
                    parts: [{ text: systemInstruction }],
                  },
                }
              : {}),
            contents,
            ...(request.tools?.length
              ? {
                  tools: [
                    {
                      functionDeclarations: request.tools.map((tool) => ({
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.inputSchema,
                      })),
                    },
                  ],
                }
              : {}),
            generationConfig: {
              ...(request.temperature !== undefined
                ? { temperature: request.temperature }
                : {}),
              ...(request.maxOutputTokens !== undefined
                ? { maxOutputTokens: request.maxOutputTokens }
                : {}),
            },
          }),
          signal: AbortSignal.timeout(options.requestTimeoutMs ?? 300_000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gemini request failed (${response.status}): ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as GeminiPayload;
      if (payload.error?.message) {
        throw new Error(`Gemini error: ${payload.error.message}`);
      }
      if (payload.promptFeedback?.blockReason) {
        throw new Error(
          `Gemini blocked the request: ${payload.promptFeedback.blockReason}`,
        );
      }
      return normalizeGeminiResponse(payload);
    },
  };
}

export function toGeminiContents(
  messages: readonly MatterhornModelMessage[],
): {
  readonly systemInstruction?: string;
  readonly contents: readonly unknown[];
} {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const contents: unknown[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "system") continue;

    if (message.role === "tool") {
      const parts: unknown[] = [];
      let cursor = index;
      while (cursor < messages.length && messages[cursor].role === "tool") {
        const toolMessage = messages[cursor];
        if (!toolMessage.toolCallId || !toolMessage.name) {
          throw new Error(
            "Gemini tool result requires toolCallId and name.",
          );
        }
        parts.push({
          functionResponse: {
            id: toolMessage.toolCallId,
            name: toolMessage.name,
            response: toolResultObject(toolMessage.content),
          },
        });
        cursor += 1;
      }
      contents.push({ role: "user", parts });
      index = cursor - 1;
      continue;
    }

    if (message.role === "assistant") {
      const parts: unknown[] = [];
      if (message.content.trim()) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        parts.push({
          functionCall: {
            id: call.id,
            name: call.name,
            args: call.args,
          },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    contents.push({
      role: "user",
      parts: [{ text: message.content }],
    });
  }

  return {
    ...(systemInstruction ? { systemInstruction } : {}),
    contents,
  };
}

function normalizeGeminiResponse(
  payload: GeminiPayload,
): MatterhornModelResponse {
  const candidate = payload.candidates?.[0];
  const text: string[] = [];
  const toolCalls: MatterhornToolCall[] = [];

  for (const part of candidate?.content?.parts ?? []) {
    if ("text" in part && part.text) {
      text.push(part.text);
      continue;
    }
    if ("functionCall" in part && part.functionCall) {
      const call = part.functionCall;
      if (!call.name) {
        throw new Error("Gemini returned a function call without a name.");
      }
      const args =
        call.args &&
        typeof call.args === "object" &&
        !Array.isArray(call.args)
          ? (call.args as Readonly<Record<string, unknown>>)
          : {};
      toolCalls.push({
        id: call.id ?? `gemini-${toolCalls.length + 1}`,
        name: call.name,
        args,
      });
    }
  }

  const usage = payload.usageMetadata;
  return {
    text: text.join("").trim(),
    toolCalls,
    finishReason: toolCalls.length
      ? "tool_calls"
      : candidate?.finishReason === "MAX_TOKENS"
        ? "length"
        : candidate?.finishReason
          ? "stop"
          : "unknown",
    ...(usage
      ? {
          usage: {
            ...(usage.promptTokenCount !== undefined
              ? { inputTokens: usage.promptTokenCount }
              : {}),
            ...(usage.candidatesTokenCount !== undefined
              ? { outputTokens: usage.candidatesTokenCount }
              : {}),
            ...(usage.totalTokenCount !== undefined
              ? { totalTokens: usage.totalTokenCount }
              : {}),
          },
        }
      : {}),
  };
}

function toolResultObject(content: string): Readonly<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Readonly<Record<string, unknown>>;
    }
  } catch {
    // Use a text wrapper below.
  }
  return { output: content };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
