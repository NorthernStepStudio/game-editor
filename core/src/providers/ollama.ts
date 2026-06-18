import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

interface OllamaChatResponse {
  readonly message?: { readonly role?: string; readonly content?: string };
  readonly done?: boolean;
  readonly error?: string;
}

export function createOllamaProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const baseUrl = ensureTrailingSlash(config.ollamaBaseUrl ?? "http://localhost:11434");
  const model = config.ollamaModel ?? "qwen2.5-coder:14b";

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const systemMsg = { role: "system", content: input.agent.systemInstruction };
    const historyMsgs = history.map((m) => ({ role: m.role, content: m.content }));
    const userContent = JSON.stringify(
      {
        request: input.request,
        agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
      },
      null,
      2,
    );
    return [systemMsg, ...historyMsgs, { role: "user", content: userContent }];
  }

  return {
    id: "ollama",
    describe() {
      return `M-CORE Ollama (local) mode using ${model} at ${baseUrl}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const res = await fetch(new URL("api/chat", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          stream: false,
          options: {
            temperature: input.budget.temperature,
            num_predict: input.budget.maxOutputTokens,
          },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama request failed (${res.status}): ${text}. Is Ollama running at ${baseUrl}?`);
      }

      const payload = (await res.json()) as OllamaChatResponse;
      if (payload.error) throw new Error(`Ollama error: ${payload.error}`);

      const content = payload.message?.content?.trim();
      if (!content) throw new Error("Ollama returned no content.");

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      const res = await fetch(new URL("api/chat", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          stream: true,
          options: {
            temperature: input.budget.temperature,
            num_predict: input.budget.maxOutputTokens,
          },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Ollama stream failed (${res.status}). Is Ollama running at ${baseUrl}?`);
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
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as OllamaChatResponse;
            const token = chunk.message?.content;
            if (token) yield token;
            if (chunk.done) return;
          } catch {}
        }
      }
    },
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
