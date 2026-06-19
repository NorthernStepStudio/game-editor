import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

interface OllamaChatResponse {
  readonly message?: { readonly role?: string; readonly content?: string };
  readonly done?: boolean;
  readonly error?: string;
}

interface OllamaTagsResponse {
  readonly models?: ReadonlyArray<{
    readonly name?: string;
    readonly model?: string;
  }>;
}

export function createOllamaProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const baseUrl = ensureTrailingSlash(config.ollamaBaseUrl ?? "http://localhost:11434");
  const requestedModel = config.ollamaModel?.trim();
  const fallbackModel = "qwen2.5-coder:14b";
  let resolvedModel: string | undefined;

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const localInstruction = "You are Matterhorn, the local-first AI agent and workspace assistant for Northern Step Studio / NStep. Your name is Matterhorn. You are not NSS Master Core, M-CORE, NSS Workspace AI, or General NSS Studio Agent. Reply directly to the user in plain conversational text. If you need IDE tools, respond only as JSON with title, response, and toolCalls matching request.ideTools.protocol. After tool results are provided, return the final answer. Do not use markdown code fences unless the user specifically asks for code.";
    
    let systemInstruction = input.agent.systemInstruction;
    systemInstruction = systemInstruction.replace(/Respond as JSON with keys[^.\n]*\.?/gi, "");
    systemInstruction = `${systemInstruction.trim()}\n\n${localInstruction}`;

    const systemMsg = { role: "system", content: systemInstruction };
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

  async function resolveModel(): Promise<string> {
    if (resolvedModel) {
      return resolvedModel;
    }

    const availableModels = await listOllamaModels();
    if (requestedModel && availableModels.includes(requestedModel)) {
      resolvedModel = requestedModel;
      return resolvedModel;
    }

    if (!requestedModel && availableModels.length > 0) {
      resolvedModel = availableModels[0];
      return resolvedModel;
    }

    if (requestedModel && availableModels.length > 0) {
      resolvedModel = availableModels[0];
      return resolvedModel;
    }

    resolvedModel = requestedModel ?? fallbackModel;
    return resolvedModel;
  }

  async function listOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(new URL("api/tags", baseUrl), {
        signal: AbortSignal.timeout(Math.min(config.requestTimeoutMs, 3_000)),
      });
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as OllamaTagsResponse;
      return (
        payload.models
          ?.map((model) => model.name ?? model.model)
          .filter((name): name is string => Boolean(name?.trim())) ?? []
      );
    } catch {
      return [];
    }
  }

  return {
    id: "ollama",
    describe() {
      return `M-CORE Ollama (local) mode at ${baseUrl}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const model = await resolveModel();
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
      const model = await resolveModel();
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
