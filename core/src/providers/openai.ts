import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

interface OpenAIChatResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string };
    readonly delta?: { readonly content?: string };
    readonly finish_reason?: string;
  }>;
  readonly error?: { readonly message?: string };
}

export function createOpenAIProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const baseUrl = ensureTrailingSlash(config.openaiBaseUrl ?? "https://api.openai.com/v1/");
  const model = config.openaiModel ?? "gpt-4o";

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const systemMsg = {
      role: "system" as const,
      content: input.agent.systemInstruction,
    };
    const historyMsgs = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const userMsg = {
      role: "user" as const,
      content: JSON.stringify(
        {
          request: input.request,
          agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
        },
        null,
        2,
      ),
    };
    return [systemMsg, ...historyMsgs, userMsg];
  }

  return {
    id: "openai",
    describe() {
      return `M-CORE OpenAI mode using ${model}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      if (!config.openaiApiKey) throw new Error("OpenAI mode requires OPENAI_API_KEY.");

      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);

      const payload = (await res.json()) as OpenAIChatResponse;
      if (payload.error?.message) throw new Error(`OpenAI error: ${payload.error.message}`);

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("OpenAI returned no content.");

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      if (!config.openaiApiKey) throw new Error("OpenAI mode requires OPENAI_API_KEY.");

      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok || !res.body) throw new Error(`OpenAI stream failed (${res.status})`);

      yield* parseOpenAIStream(res.body);
    },
  };
}

async function* parseOpenAIStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.replace(/^data:\s*/, "").trim();
      if (!trimmed || trimmed === "[DONE]") continue;
      try {
        const chunk = JSON.parse(trimmed) as OpenAIChatResponse;
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {}
    }
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
