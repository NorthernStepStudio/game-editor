import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

/**
 * LM Studio exposes an OpenAI-compatible REST API at http://localhost:1234/v1.
 * Model name is whatever model is currently loaded in LM Studio (can be overridden).
 */
export function createLMStudioProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const baseUrl = ensureTrailingSlash(config.lmstudioBaseUrl ?? "http://localhost:1234/v1/");
  const model = config.lmstudioModel ?? "local-model";

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const systemMsg = { role: "system" as const, content: input.agent.systemInstruction };
    const historyMsgs = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const userContent = JSON.stringify(
      {
        request: input.request,
        agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
      },
      null,
      2,
    );
    return [systemMsg, ...historyMsgs, { role: "user" as const, content: userContent }];
  }

  interface OpenAICompatResponse {
    readonly choices?: ReadonlyArray<{
      readonly message?: { readonly content?: string };
      readonly delta?: { readonly content?: string };
      readonly finish_reason?: string;
    }>;
    readonly error?: { readonly message?: string };
  }

  return {
    id: "lmstudio",
    describe() {
      return `M-CORE LM Studio (local) mode using "${model}" at ${baseUrl}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LM Studio request failed (${res.status}): ${text}. Is LM Studio running at ${baseUrl}?`);
      }

      const payload = (await res.json()) as OpenAICompatResponse;
      if (payload.error?.message) throw new Error(`LM Studio error: ${payload.error.message}`);

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("LM Studio returned no content.");

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok || !res.body) {
        throw new Error(`LM Studio stream failed (${res.status}). Is LM Studio running at ${baseUrl}?`);
      }

      const reader = res.body.getReader();
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
            const chunk = JSON.parse(trimmed) as OpenAICompatResponse;
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) yield token;
          } catch {}
        }
      }
    },
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
