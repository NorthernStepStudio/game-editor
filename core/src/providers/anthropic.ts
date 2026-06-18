import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

interface AnthropicResponse {
  readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }>;
  readonly error?: { readonly message?: string };
}

interface AnthropicStreamEvent {
  readonly type?: string;
  readonly delta?: { readonly type?: string; readonly text?: string };
  readonly index?: number;
}

export function createAnthropicProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const model = config.anthropicModel ?? "claude-3-5-sonnet-20241022";
  const BASE = "https://api.anthropic.com/v1/";

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const historyMsgs = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const userContent = JSON.stringify(
      {
        request: input.request,
        agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
      },
      null,
      2,
    );
    return [...historyMsgs, { role: "user" as const, content: userContent }];
  }

  function makeHeaders() {
    if (!config.anthropicApiKey) throw new Error("Anthropic mode requires ANTHROPIC_API_KEY.");
    return {
      "Content-Type": "application/json",
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  return {
    id: "anthropic",
    describe() {
      return `M-CORE Anthropic mode using ${model}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const res = await fetch(new URL("messages", BASE), {
        method: "POST",
        headers: makeHeaders(),
        body: JSON.stringify({
          model,
          system: input.agent.systemInstruction,
          messages: buildMessages(input),
          max_tokens: input.budget.maxOutputTokens,
          temperature: input.budget.temperature,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok) throw new Error(`Anthropic request failed (${res.status}): ${await res.text()}`);

      const payload = (await res.json()) as AnthropicResponse;
      if (payload.error?.message) throw new Error(`Anthropic error: ${payload.error.message}`);

      const content = payload.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();

      if (!content) throw new Error("Anthropic returned no content.");

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      const res = await fetch(new URL("messages", BASE), {
        method: "POST",
        headers: { ...makeHeaders(), Accept: "text/event-stream" },
        body: JSON.stringify({
          model,
          system: input.agent.systemInstruction,
          messages: buildMessages(input),
          max_tokens: input.budget.maxOutputTokens,
          temperature: input.budget.temperature,
          stream: true,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok || !res.body) throw new Error(`Anthropic stream failed (${res.status})`);

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
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            const event = JSON.parse(data) as AnthropicStreamEvent;
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              const token = event.delta.text;
              if (token) yield token;
            }
          } catch {}
        }
      }
    },
  };
}
